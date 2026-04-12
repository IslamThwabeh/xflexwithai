import { describe, expect, it } from "vitest";

import { getSuggestedPackageKeyPrice } from "../shared/packageKeyPricing";

const packages = [
  { id: 1, price: 20000, includesLexai: false },
  { id: 2, price: 50000, includesLexai: true },
];

describe("getSuggestedPackageKeyPrice", () => {
  it("returns the renewal price for the selected basic package", () => {
    expect(getSuggestedPackageKeyPrice(packages, 1, { isRenewal: true })).toBe(50);
  });

  it("returns the renewal price for the selected comprehensive package", () => {
    expect(getSuggestedPackageKeyPrice(packages, 2, { isRenewal: true })).toBe(100);
  });

  it("keeps renewal pricing correct when the package is chosen after renewal is enabled", () => {
    expect(getSuggestedPackageKeyPrice(packages, 1, { isRenewal: true, isUpgrade: false })).toBe(50);
  });

  it("returns the upgrade price for the comprehensive package", () => {
    expect(getSuggestedPackageKeyPrice(packages, 2, { isUpgrade: true })).toBe(300);
  });

  it("falls back to the package list price for a normal new key", () => {
    expect(getSuggestedPackageKeyPrice(packages, 1)).toBe(200);
  });
});