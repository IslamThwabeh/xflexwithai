import { describe, expect, it } from "vitest";

import { canRedeemRenewalPackageKey } from "../backend/services/package-key.service";

describe("canRedeemRenewalPackageKey", () => {
  it("allows renewal when the user has no in-system package subscriptions yet", () => {
    expect(canRedeemRenewalPackageKey([], 1)).toBe(true);
  });

  it("allows renewal when a matching package exists even if the package ID types differ", () => {
    expect(
      canRedeemRenewalPackageKey(
        [{ packageId: "1", isActive: true }],
        1,
      ),
    ).toBe(true);
  });

  it("rejects renewal when in-system active subscriptions exist but none match the renewal package", () => {
    expect(
      canRedeemRenewalPackageKey(
        [{ packageId: 2, isActive: true }],
        1,
      ),
    ).toBe(false);
  });

  it("allows renewal when one of several active packages matches", () => {
    expect(
      canRedeemRenewalPackageKey(
        [
          { packageId: 2, isActive: true },
          { packageId: 1, isActive: true },
        ],
        1,
      ),
    ).toBe(true);
  });
});
