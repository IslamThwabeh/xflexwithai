import * as db from "../db";
import { normalizeEmailAddress } from "../../shared/emailValidation";

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const STATIC_SECRET_HEADER = "x-xflex-zeptomail-secret";

export type ZeptoMailDeliveryStatus =
  | "delivered"
  | "bounced_soft"
  | "bounced_hard"
  | "complained";

export type ParsedZeptoMailWebhookEvent = {
  providerEventId: string;
  providerRequestId: string;
  eventName: string;
  deliveryStatus: ZeptoMailDeliveryStatus | null;
  recipientEmail: string | null;
  subject: string | null;
  diagnostic: string | null;
  eventAt: string | null;
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decodeFormComponent(value: string) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

export function extractZeptoMailSignedPayload(rawBody: string, contentType = "") {
  if (contentType.toLowerCase().includes("application/json") || rawBody.trimStart().startsWith("{")) {
    return rawBody.trim();
  }
  const separator = rawBody.indexOf("=");
  if (separator < 0) throw new Error("Webhook form payload is missing its value");
  return decodeFormComponent(rawBody.slice(separator + 1));
}

function parseProducerSignature(header: string) {
  const fields = new Map<string, string>();
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    fields.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }
  const timestamp = Number(fields.get("ts"));
  const signature = fields.get("s");
  const algorithm = fields.get("s-algorithm")?.toLowerCase();
  if (!Number.isFinite(timestamp) || !signature || algorithm !== "hmacsha256") {
    throw new Error("Malformed producer signature");
  }
  return { timestamp, signature: decodeFormComponent(signature) };
}

function decodeBase64(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyZeptoMailWebhookSignature(input: {
  rawBody: string;
  contentType?: string;
  producerSignature: string;
  secret: string;
  now?: number;
}) {
  if (!input.secret) throw new Error("ZeptoMail webhook secret is not configured");
  const signature = parseProducerSignature(input.producerSignature);
  const now = input.now ?? Date.now();
  const age = now - signature.timestamp;
  if (age < -60_000 || age > MAX_WEBHOOK_AGE_MS) throw new Error("Webhook timestamp is outside the accepted window");

  const payload = extractZeptoMailSignedPayload(input.rawBody, input.contentType);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (!constantTimeEqual(digest, decodeBase64(signature.signature))) throw new Error("Webhook signature is invalid");
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEventName(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getRecipientEmail(emailInfo: Record<string, unknown> | null) {
  const recipients = Array.isArray(emailInfo?.to) ? emailInfo?.to : [];
  for (const recipient of recipients) {
    const record = asRecord(recipient);
    const nestedAddress = asString(asRecord(record?.email_address)?.address);
    const directAddress = asString(record?.address);
    const address = nestedAddress ?? directAddress;
    if (address) return normalizeEmailAddress(address);
  }
  return null;
}

function normalizeEventTimestamp(value: unknown) {
  const raw = typeof value === "number" ? value : asString(value);
  if (raw == null) return null;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  const parsed = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getDeliveryStatus(eventName: string): ZeptoMailDeliveryStatus | null {
  if (eventName.includes("hard") && eventName.includes("bounce")) return "bounced_hard";
  if (eventName.includes("soft") && eventName.includes("bounce")) return "bounced_soft";
  if (eventName.includes("feedback") || eventName.includes("complaint") || eventName.includes("fbl")) return "complained";
  if (eventName.includes("deliver") || eventName.includes("open") || eventName.includes("click")) return "delivered";
  return null;
}

export function parseZeptoMailWebhookEvent(payloadText: string): ParsedZeptoMailWebhookEvent {
  const payload = asRecord(JSON.parse(payloadText));
  if (!payload) throw new Error("Webhook payload must be an object");
  const eventMessage = asRecord(firstValue(payload.event_message));
  const emailInfo = asRecord(eventMessage?.email_info);
  const eventData = asRecord(firstValue(eventMessage?.event_data));
  const details = asRecord(firstValue(eventData?.details));
  const providerEventId = asString(payload.webhook_request_id);
  const providerRequestId = asString(eventMessage?.request_id);
  const rawEventName = asString(firstValue(payload.event_name)) ?? asString(eventData?.object);
  if (!providerEventId || !providerRequestId || !rawEventName) {
    throw new Error("Webhook payload is missing its event or request identifier");
  }
  const eventName = normalizeEventName(rawEventName);
  const reason = asString(details?.reason);
  const diagnosticMessage = asString(details?.diagnostic_message);
  return {
    providerEventId,
    providerRequestId,
    eventName,
    deliveryStatus: getDeliveryStatus(eventName),
    recipientEmail: normalizeEmailAddress(asString(details?.bounced_recipient) ?? getRecipientEmail(emailInfo) ?? "") || null,
    subject: asString(emailInfo?.subject),
    diagnostic: diagnosticMessage ?? reason,
    eventAt: normalizeEventTimestamp(details?.time ?? details?.modified_time ?? emailInfo?.processed_time),
  };
}

export async function handleZeptoMailWebhookRequest(request: Request, secret: string) {
  if (request.method !== "POST") return jsonResponse(405, { status: "method_not_allowed" });
  const rawBody = await request.text();
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse(400, { status: "invalid_payload" });
  }
  const producerSignature = request.headers.get("producer-signature");
  const staticSecret = request.headers.get(STATIC_SECRET_HEADER);
  const staticSecretMatches = Boolean(
    secret
    && staticSecret
    && constantTimeEqual(
      new TextEncoder().encode(secret),
      new TextEncoder().encode(staticSecret),
    ),
  );
  if (!producerSignature && !staticSecretMatches) {
    return jsonResponse(401, { status: "invalid_signature" });
  }

  try {
    const payload = producerSignature
      ? await verifyZeptoMailWebhookSignature({
          rawBody,
          contentType: request.headers.get("content-type") ?? "",
          producerSignature,
          secret,
        })
      : extractZeptoMailSignedPayload(rawBody, request.headers.get("content-type") ?? "");
    const event = parseZeptoMailWebhookEvent(payload);
    const result = await db.recordZeptoMailWebhookEvent(event);
    return jsonResponse(200, {
      status: result.duplicate ? "duplicate" : "accepted",
      matchedLogCount: result.matchedLogCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuthenticationFailure = /signature|timestamp|secret/i.test(message);
    return jsonResponse(isAuthenticationFailure ? 401 : 400, {
      status: isAuthenticationFailure ? "invalid_signature" : "invalid_payload",
    });
  }
}
