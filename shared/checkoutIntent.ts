import { normalizeEmailAddress } from "./emailValidation";

export const CHECKOUT_FLOWS = [
  "package",
  "upgrade",
  "renewal",
  "copier",
] as const;
export type CheckoutFlow = (typeof CHECKOUT_FLOWS)[number];
export type CheckoutIntentPayload = {
  paymentMethod: string;
  items?: Array<{ itemType: string; packageId?: number; courseId?: number }>;
  targetPackageId?: number;
  isGift?: boolean;
  giftEmail?: string;
  giftMessage?: string;
  notes?: string | null;
  couponCode?: string;
  termsAcceptedVersion?: string;
};

/** Deliberately excludes retry timestamps, request IP/device and the intent key.
 * This canonical form stays identical in browser and Worker. */
export function canonicalCheckoutRequest(
  userId: number,
  flow: CheckoutFlow,
  input: CheckoutIntentPayload
) {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !CHECKOUT_FLOWS.includes(flow)
  )
    throw new Error("Invalid checkout identity or flow.");
  return JSON.stringify({
    version: 1,
    userId,
    flow,
    paymentMethod: input.paymentMethod,
    items:
      input.items?.map(item => ({
        itemType: item.itemType,
        packageId:
          item.itemType === "package" ? (item.packageId ?? null) : null,
        courseId: item.itemType === "package" ? null : (item.courseId ?? null),
      })) ?? [],
    targetPackageId: input.targetPackageId ?? null,
    isGift: !!input.isGift,
    giftEmail: input.isGift
      ? normalizeEmailAddress(input.giftEmail ?? "")
      : null,
    giftMessage: input.isGift ? input.giftMessage?.trim() || null : null,
    notes: input.notes?.trim() || null,
    couponCode: input.couponCode?.trim().toUpperCase() || null,
    termsAcceptedVersion: input.termsAcceptedVersion ?? null,
  });
}

export async function hashCheckoutRequest(
  userId: number,
  flow: CheckoutFlow,
  input: CheckoutIntentPayload
) {
  const bytes = new TextEncoder().encode(
    canonicalCheckoutRequest(userId, flow, input)
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function defaultCheckoutIntentKey(requestHash: string) {
  if (!/^[a-f0-9]{64}$/.test(requestHash))
    throw new Error("Invalid checkout request hash.");
  return `checkout:v1:${requestHash}`;
}

export function isCheckoutIntentKey(value: string) {
  return /^[A-Za-z0-9:_-]{16,128}$/.test(value);
}
