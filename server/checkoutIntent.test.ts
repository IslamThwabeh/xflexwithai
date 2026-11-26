import { describe, expect, it } from "vitest";
import {
  canonicalCheckoutRequest,
  hashCheckoutRequest,
  defaultCheckoutIntentKey,
  isCheckoutIntentKey,
} from "../shared/checkoutIntent";
const purchase = {
  paymentMethod: "bank_transfer",
  items: [{ itemType: "package", packageId: 1 }],
  isGift: true,
  giftEmail: "Gift@Example.Test",
  giftMessage: " Thank you ",
  notes: " transfer ",
  couponCode: "SAVE10",
  termsAcceptedVersion: "terms-v1",
};
describe("checkout intent identity", () => {
  it("keeps one intent across retries and normalizes the fields the order actually stores", async () => {
    const original = await hashCheckoutRequest(7, "package", purchase);
    const retried = await hashCheckoutRequest(7, "package", {
      ...purchase,
      giftEmail: "gift@example.test",
      giftMessage: "Thank you",
      notes: "transfer",
      couponCode: " save10 ",
      items: [{ itemType: "package", packageId: 1, courseId: 99 }],
      termsAcceptedAt: "later timestamp",
    } as any);
    expect(retried).toBe(original);
    expect(defaultCheckoutIntentKey(original)).toBe(
      defaultCheckoutIntentKey(retried)
    );
    expect(isCheckoutIntentKey(defaultCheckoutIntentKey(original))).toBe(true);
    expect(canonicalCheckoutRequest(7, "package", purchase)).not.toContain(
      "termsAcceptedAt"
    );
  });
  it("distinguishes accounts, workflows, products, gifts, coupons, notes and legal versions", async () => {
    const original = await hashCheckoutRequest(7, "package", purchase);
    const hashes = await Promise.all([
      hashCheckoutRequest(8, "package", purchase),
      hashCheckoutRequest(7, "upgrade", purchase),
      ...[
        { items: [{ itemType: "package", packageId: 2 }] },
        { giftEmail: "another@example.test" },
        { giftMessage: "Different gift" },
        { isGift: false },
        { couponCode: "SAVE20" },
        { notes: "Different request" },
        { termsAcceptedVersion: "terms-v2" },
      ].map(change =>
        hashCheckoutRequest(7, "package", { ...purchase, ...change })
      ),
    ]);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const hash of hashes) expect(hash).not.toBe(original);
  });
  it("does not treat unused gift fields as a new non-gift purchase", async () => {
    expect(
      await hashCheckoutRequest(7, "package", { ...purchase, isGift: false })
    ).toBe(
      await hashCheckoutRequest(7, "package", {
        ...purchase,
        isGift: false,
        giftEmail: "ignored@example.test",
        giftMessage: "ignored",
      })
    );
  });
  it("bounds external keys and rejects invalid identity/hash input", () => {
    for (const key of [
      "short",
      "../path",
      "x".repeat(129),
      "a key with spaces",
    ])
      expect(isCheckoutIntentKey(key)).toBe(false);
    expect(() => defaultCheckoutIntentKey("not a hash")).toThrow();
    expect(() => canonicalCheckoutRequest(0, "package", purchase)).toThrow();
  });
});
