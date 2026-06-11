import { ENV } from "./env";

export type EmailCategory = "transactional" | "service_lifecycle" | "marketing";

const SUPPRESSIBLE_EMAIL_CATEGORIES = new Set<EmailCategory>(["service_lifecycle", "marketing"]);

type UnsubscribePayload = {
  v: 1;
  email: string;
  category: Exclude<EmailCategory, "transactional">;
  iat: number;
};

function normalizeBase64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBase64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return normalizeBase64Url(btoa(binary));
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function hmacSha256(message: string) {
  const secret = ENV.emailUnsubscribeSecret || ENV.jwtSecret || "xflex-email-unsubscribe-fallback";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256Base64Url(message: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(digest));
}

export function isSuppressibleEmailCategory(category?: EmailCategory | null) {
  return !!category && SUPPRESSIBLE_EMAIL_CATEGORIES.has(category);
}

export function getBusinessPostalAddress() {
  return ENV.businessPostalAddress;
}

export async function buildUnsubscribeToken(
  email: string,
  category: Exclude<EmailCategory, "transactional">,
) {
  const payload: UnsubscribePayload = {
    v: 1,
    email: email.trim().toLowerCase(),
    category,
    iat: Math.floor(Date.now() / 1000),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function buildUnsubscribeUrl(
  email: string,
  category: Exclude<EmailCategory, "transactional">,
) {
  const token = await buildUnsubscribeToken(email, category);
  const baseUrl = ENV.siteUrl.replace(/\/+$/, "");
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<UnsubscribePayload | null> {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;
  const expected = await hmacSha256(encodedPayload);
  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<UnsubscribePayload>;
    if (
      payload.v !== 1 ||
      !payload.email ||
      (payload.category !== "service_lifecycle" && payload.category !== "marketing")
    ) {
      return null;
    }
    return {
      v: 1,
      email: String(payload.email).trim().toLowerCase(),
      category: payload.category,
      iat: Number(payload.iat || 0),
    };
  } catch {
    return null;
  }
}

export async function hashUnsubscribeToken(token: string) {
  return sha256Base64Url(token);
}
