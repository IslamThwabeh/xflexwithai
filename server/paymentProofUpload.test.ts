import { describe, expect, it, vi } from "vitest";

import {
  PAYMENT_PROOF_MAX_BYTES,
  PaymentProofUploadError,
  detectPaymentProofFileType,
  processPaymentProofUpload,
} from "../backend/services/payment-proof-upload.service";

const jpeg = (size = 32) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
};

const pendingOrder = {
  id: 42,
  userId: 7,
  status: "pending",
  paymentMethod: "bank_transfer",
  paymentProofUrl: null,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    getOrder: vi.fn(async () => pendingOrder),
    putObject: vi.fn(async (key: string) => ({
      key,
      url: `https://videos.xflexacademy.com/${key}`,
    })),
    submitOrderProof: vi.fn(async (input: { paymentProofUrl: string }) => ({
      ...pendingOrder,
      status: "awaiting_confirmation",
      paymentProofUrl: input.paymentProofUrl,
    })),
    deleteObject: vi.fn(async () => undefined),
    recordEvent: vi.fn(async () => undefined),
    recordStatusTransition: vi.fn(async () => undefined),
    now: () => new Date("2026-08-21T12:00:00.000Z"),
    randomId: () => "test-upload-id",
    ...overrides,
  };
}

describe("payment-proof binary upload", () => {
  it("detects supported receipt signatures instead of trusting the filename", () => {
    expect(detectPaymentProofFileType(jpeg())).toEqual({ contentType: "image/jpeg", extension: "jpg" });
    expect(detectPaymentProofFileType(Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]))).toEqual({ contentType: "image/png", extension: "png" });
    expect(detectPaymentProofFileType(new TextEncoder().encode("%PDF-1.7"))).toEqual({
      contentType: "application/pdf",
      extension: "pdf",
    });
    expect(detectPaymentProofFileType(new TextEncoder().encode("not an image"))).toBeNull();
  });

  it("stores an opaque key, updates the order, and records the client transition", async () => {
    const deps = dependencies();
    const result = await processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
      declaredContentType: "image/jpeg",
      paymentReference: "  BANK-123  ",
    }, deps);

    expect(result.key).toBe("payment-proofs/42/1787313600000-test-upload-id.jpg");
    expect(deps.putObject).toHaveBeenCalledWith(result.key, expect.any(Uint8Array), "image/jpeg");
    expect(deps.submitOrderProof).toHaveBeenCalledWith({
      orderId: 42,
      userId: 7,
      paymentProofUrl: `https://videos.xflexacademy.com/${result.key}`,
      paymentReference: "BANK-123",
    });
    expect(deps.recordStatusTransition).toHaveBeenCalledWith({
      orderId: 42,
      userId: 7,
      previousStatus: "pending",
      newStatus: "awaiting_confirmation",
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment_proof_upload_succeeded",
      orderId: 42,
      metadata: expect.objectContaining({
        detectedContentType: "image/jpeg",
        objectKey: result.key,
        outcome: "succeeded",
      }),
    }));
  });

  it("deletes the new R2 object when linking it to the order fails", async () => {
    const deps = dependencies({ submitOrderProof: vi.fn(async () => null) });

    await expect(processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
    }, deps)).rejects.toMatchObject({
      status: 500,
      code: "order_update_failed",
    });

    expect(deps.deleteObject).toHaveBeenCalledWith(
      "payment-proofs/42/1787313600000-test-upload-id.jpg",
    );
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment_proof_upload_failed",
      metadata: expect.objectContaining({ stage: "database" }),
    }));
  });

  it("preserves the existing proof when replacement storage fails", async () => {
    const existing = {
      ...pendingOrder,
      status: "awaiting_confirmation",
      paymentProofUrl: "https://videos.xflexacademy.com/payment-proofs/42/old.jpg",
    };
    const deps = dependencies({
      getOrder: vi.fn(async () => existing),
      putObject: vi.fn(async () => { throw new Error("R2 unavailable"); }),
    });

    await expect(processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
    }, deps)).rejects.toMatchObject({ code: "storage_failed" });

    expect(deps.submitOrderProof).not.toHaveBeenCalled();
    expect(deps.deleteObject).not.toHaveBeenCalled();
  });

  it("removes the previous R2 object only after a replacement succeeds", async () => {
    const deps = dependencies({
      getOrder: vi.fn(async () => ({
        ...pendingOrder,
        status: "awaiting_confirmation",
        paymentProofUrl: "https://videos.xflexacademy.com/payment-proofs/42/old.jpg",
      })),
    });

    await processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
    }, deps);

    expect(deps.deleteObject).toHaveBeenCalledWith("payment-proofs/42/old.jpg");
    expect(deps.recordStatusTransition).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment_proof_cleanup_succeeded",
      metadata: expect.objectContaining({
        previousObjectKey: "payment-proofs/42/old.jpg",
        attempts: 1,
      }),
    }));
  });

  it("retries replacement cleanup and records the eventual success", async () => {
    const deleteObject = vi.fn()
      .mockRejectedValueOnce(new Error("transient R2 failure"))
      .mockResolvedValue(undefined);
    const deps = dependencies({
      getOrder: vi.fn(async () => ({
        ...pendingOrder,
        status: "awaiting_confirmation",
        paymentProofUrl: "https://videos.xflexacademy.com/payment-proofs/42/old.jpg",
      })),
      deleteObject,
    });

    await processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
    }, deps);

    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment_proof_cleanup_succeeded",
      metadata: expect.objectContaining({ attempts: 2 }),
    }));
  });

  it("keeps the successful replacement authoritative and reports exhausted cleanup", async () => {
    const deps = dependencies({
      getOrder: vi.fn(async () => ({
        ...pendingOrder,
        status: "awaiting_confirmation",
        paymentProofUrl: "https://videos.xflexacademy.com/payment-proofs/42/old.jpg",
      })),
      deleteObject: vi.fn(async () => { throw new Error("persistent R2 failure"); }),
    });

    const result = await processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(),
    }, deps);

    expect(result.order.status).toBe("awaiting_confirmation");
    expect(deps.deleteObject).toHaveBeenCalledTimes(3);
    expect(deps.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment_proof_cleanup_failed",
      metadata: expect.objectContaining({ attempts: 3, outcome: "failed" }),
    }));
  });

  it("rejects oversized and unsupported payloads before storage", async () => {
    const oversizedDeps = dependencies();
    await expect(processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: jpeg(PAYMENT_PROOF_MAX_BYTES + 1),
    }, oversizedDeps)).rejects.toBeInstanceOf(PaymentProofUploadError);
    expect(oversizedDeps.putObject).not.toHaveBeenCalled();

    const invalidDeps = dependencies();
    await expect(processPaymentProofUpload({
      userId: 7,
      orderId: 42,
      bytes: new TextEncoder().encode("plain text"),
    }, invalidDeps)).rejects.toMatchObject({
      status: 415,
      code: "unsupported_file_type",
    });
    expect(invalidDeps.putObject).not.toHaveBeenCalled();
  });

  it("uses one binary request in the order page and removes the Base64 two-step flow", async () => {
    const source = await import("node:fs").then(({ readFileSync }) => readFileSync(
      new URL("../frontend/src/pages/OrderDetail.tsx", import.meta.url),
      "utf8",
    ));

    expect(source).toContain("/api/uploads/payment-proof?");
    expect(source).toContain("body: proofFile");
    expect(source).toContain('data-testid="payment-proof-submit"');
    expect(source).not.toContain("readAsDataURL");
    expect(source).not.toContain("upload.paymentProof.useMutation");
    expect(source).not.toContain("orders.uploadProof.useMutation");
    expect(source).toContain("['pending', 'awaiting_confirmation'].includes(order.status)");
    expect(source).toContain("Replace Payment Proof");
  });

  it("disables both legacy payment-proof write routes", async () => {
    const source = await import("node:fs").then(({ readFileSync }) => readFileSync(
      new URL("../backend/routers.ts", import.meta.url),
      "utf8",
    ));

    expect(source).toContain("Legacy payment-proof uploads are disabled");
    expect(source).toContain("Legacy payment-proof linking is disabled");
    expect(source).not.toContain("payment-proofs/legacy/");
  });
});
