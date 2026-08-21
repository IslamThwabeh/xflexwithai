export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;

export type PaymentProofFileType = {
  contentType: string;
  extension: string;
};

export type PaymentProofOrderRecord = {
  id: number;
  userId: number;
  status: string;
  paymentMethod: string | null;
  paymentProofUrl?: string | null;
};

export type PaymentProofUploadEvent = {
  eventType:
    | "payment_proof_upload_succeeded"
    | "payment_proof_upload_failed"
    | "payment_proof_cleanup_succeeded"
    | "payment_proof_cleanup_failed";
  orderId: number;
  metadata: Record<string, unknown>;
};

export class PaymentProofUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaymentProofUploadError";
  }
}

export type PaymentProofUploadDependencies<TOrder extends PaymentProofOrderRecord> = {
  getOrder: (orderId: number) => Promise<TOrder | null | undefined>;
  putObject: (
    key: string,
    body: Uint8Array,
    contentType: string,
  ) => Promise<{ key: string; url: string }>;
  submitOrderProof: (input: {
    orderId: number;
    userId: number;
    paymentProofUrl: string;
    paymentReference: string | null;
  }) => Promise<TOrder | null | undefined>;
  deleteObject: (key: string) => Promise<void>;
  recordEvent?: (event: PaymentProofUploadEvent) => Promise<void>;
  recordStatusTransition?: (input: {
    orderId: number;
    userId: number;
    previousStatus: string;
    newStatus: string;
  }) => Promise<void>;
  now?: () => Date;
  randomId?: () => string;
};

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectPaymentProofFileType(bytes: Uint8Array): PaymentProofFileType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= PNG_SIGNATURE.length && startsWithBytes(bytes, PNG_SIGNATURE)) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12
    && ascii(bytes, 0, 4) === "RIFF"
    && ascii(bytes, 8, 4) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (bytes.length >= PDF_SIGNATURE.length && startsWithBytes(bytes, PDF_SIGNATURE)) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (HEIF_BRANDS.has(brand)) {
      return { contentType: "image/heic", extension: "heic" };
    }
  }
  return null;
}

export function getPaymentProofObjectKeyFromUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return key.startsWith("payment-proofs/") ? key : null;
  } catch {
    return null;
  }
}

function normalizeReference(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > 120) {
    throw new PaymentProofUploadError(
      400,
      "reference_too_long",
      "Payment reference must be 120 characters or fewer.",
    );
  }
  return normalized || null;
}

async function safelyRecordEvent(
  recordEvent: PaymentProofUploadDependencies<PaymentProofOrderRecord>["recordEvent"],
  event: PaymentProofUploadEvent,
) {
  if (!recordEvent) return;
  try {
    await recordEvent(event);
  } catch {
    // Diagnostic telemetry must never block a customer's payment submission.
  }
}

async function deleteObjectWithRetry(
  deleteObject: PaymentProofUploadDependencies<PaymentProofOrderRecord>["deleteObject"],
  key: string,
  maxAttempts = 3,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await deleteObject(key);
      return { deleted: true as const, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 75));
      }
    }
  }
  return {
    deleted: false as const,
    attempts: maxAttempts,
    error: lastError instanceof Error ? lastError.message : "Unknown cleanup error",
  };
}

export async function processPaymentProofUpload<TOrder extends PaymentProofOrderRecord>(input: {
  userId: number;
  orderId: number;
  bytes: Uint8Array;
  declaredContentType?: string | null;
  paymentReference?: string | null;
}, dependencies: PaymentProofUploadDependencies<TOrder>) {
  const startedAt = Date.now();
  const order = await dependencies.getOrder(input.orderId);
  if (!order) {
    throw new PaymentProofUploadError(404, "order_not_found", "Order not found.");
  }
  if (order.userId !== input.userId) {
    throw new PaymentProofUploadError(403, "order_forbidden", "You cannot update this order.");
  }
  if (order.paymentMethod !== "bank_transfer") {
    throw new PaymentProofUploadError(
      400,
      "invalid_payment_method",
      "Payment proof is only available for bank-transfer orders.",
    );
  }
  if (!new Set(["pending", "awaiting_confirmation"]).has(order.status)) {
    throw new PaymentProofUploadError(
      409,
      "invalid_order_status",
      "This order no longer accepts payment-proof uploads.",
    );
  }

  const metadataBase = {
    bytes: input.bytes.byteLength,
    declaredContentType: input.declaredContentType || null,
  };
  const fail = async (error: PaymentProofUploadError, stage: string) => {
    await safelyRecordEvent(dependencies.recordEvent, {
      eventType: "payment_proof_upload_failed",
      orderId: order.id,
      metadata: {
        ...metadataBase,
        outcome: "failed",
        stage,
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
      },
    });
    throw error;
  };

  if (!input.bytes.byteLength) {
    return fail(new PaymentProofUploadError(400, "empty_file", "Choose a receipt file."), "validation");
  }
  if (input.bytes.byteLength > PAYMENT_PROOF_MAX_BYTES) {
    return fail(
      new PaymentProofUploadError(413, "file_too_large", "Payment proof must be 10 MB or smaller."),
      "validation",
    );
  }

  const detectedType = detectPaymentProofFileType(input.bytes);
  if (!detectedType) {
    return fail(
      new PaymentProofUploadError(
        415,
        "unsupported_file_type",
        "Use a JPEG, PNG, WebP, HEIC, or PDF receipt.",
      ),
      "validation",
    );
  }

  let paymentReference: string | null;
  try {
    paymentReference = normalizeReference(input.paymentReference);
  } catch (error) {
    return fail(error as PaymentProofUploadError, "validation");
  }

  const now = dependencies.now?.() ?? new Date();
  const randomId = dependencies.randomId?.() ?? crypto.randomUUID();
  const objectKey = `payment-proofs/${order.id}/${now.getTime()}-${randomId}.${detectedType.extension}`;
  let uploaded: { key: string; url: string };
  try {
    uploaded = await dependencies.putObject(objectKey, input.bytes, detectedType.contentType);
  } catch {
    return fail(
      new PaymentProofUploadError(502, "storage_failed", "The receipt could not be stored. Please retry."),
      "storage",
    );
  }

  let updatedOrder: TOrder | null | undefined;
  try {
    updatedOrder = await dependencies.submitOrderProof({
      orderId: order.id,
      userId: input.userId,
      paymentProofUrl: uploaded.url,
      paymentReference,
    });
  } catch {
    updatedOrder = null;
  }

  if (!updatedOrder) {
    await deleteObjectWithRetry(dependencies.deleteObject, uploaded.key);
    return fail(
      new PaymentProofUploadError(500, "order_update_failed", "The order could not be updated. Please retry."),
      "database",
    );
  }

  if (order.status !== "awaiting_confirmation" && dependencies.recordStatusTransition) {
    try {
      await dependencies.recordStatusTransition({
        orderId: order.id,
        userId: input.userId,
        previousStatus: order.status,
        newStatus: "awaiting_confirmation",
      });
    } catch {
      // Order submission succeeded; missing audit telemetry must not reverse it.
    }
  }

  await safelyRecordEvent(dependencies.recordEvent, {
    eventType: "payment_proof_upload_succeeded",
    orderId: order.id,
    metadata: {
      ...metadataBase,
      detectedContentType: detectedType.contentType,
      outcome: "succeeded",
      stage: "complete",
      objectKey: uploaded.key,
      replacedExistingProof: Boolean(order.paymentProofUrl),
      durationMs: Date.now() - startedAt,
    },
  });

  const previousObjectKey = getPaymentProofObjectKeyFromUrl(order.paymentProofUrl);
  if (previousObjectKey && previousObjectKey !== uploaded.key) {
    const cleanup = await deleteObjectWithRetry(dependencies.deleteObject, previousObjectKey);
    await safelyRecordEvent(dependencies.recordEvent, {
      eventType: cleanup.deleted
        ? "payment_proof_cleanup_succeeded"
        : "payment_proof_cleanup_failed",
      orderId: order.id,
      metadata: {
        outcome: cleanup.deleted ? "succeeded" : "failed",
        stage: "replacement_cleanup",
        previousObjectKey,
        replacementObjectKey: uploaded.key,
        attempts: cleanup.attempts,
        ...(cleanup.deleted ? {} : { error: cleanup.error }),
      },
    });
  }

  return {
    order: updatedOrder,
    key: uploaded.key,
    url: uploaded.url,
    contentType: detectedType.contentType,
    sizeBytes: input.bytes.byteLength,
  };
}
