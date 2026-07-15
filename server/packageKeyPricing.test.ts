import { describe, expect, it } from "vitest";

import {
  getPackageKeyPriceIls,
  getSuggestedPackageKeyPrice,
  getSuggestedPackageKeyPriceIls,
} from "../shared/packageKeyPricing";

const packages = [
  { id: 1, slug: 'basic', price: 20000, includesLexai: false },
  { id: 2, slug: 'comprehensive', price: 50000, includesLexai: true },
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

  it("uses the fixed ILS prices for new Comprehensive and Basic keys", () => {
    expect(getSuggestedPackageKeyPriceIls(packages, 2)).toBe(1700);
    expect(getSuggestedPackageKeyPriceIls(packages, 1)).toBe(700);
  });

  it("uses the fixed ILS prices for upgrades and renewals", () => {
    expect(getSuggestedPackageKeyPriceIls(packages, 2, { isUpgrade: true })).toBe(1000);
    expect(getSuggestedPackageKeyPriceIls(packages, 2, { isRenewal: true })).toBe(350);
    expect(getSuggestedPackageKeyPriceIls(packages, 1, { isRenewal: true })).toBe(175);
  });
});

describe("getPackageKeyPriceIls", () => {
  it("normalizes historic standard USD keys to the fixed ILS package price", () => {
    expect(getPackageKeyPriceIls({ price: 500, currency: 'USD', packageSlug: 'comprehensive' })).toBe(1700);
    expect(getPackageKeyPriceIls({ price: 200, currency: 'USD', packageSlug: 'basic' })).toBe(700);
    expect(getPackageKeyPriceIls({ price: 300, currency: 'USD', packageSlug: 'comprehensive', isUpgrade: true })).toBe(1000);
    expect(getPackageKeyPriceIls({ price: 100, currency: 'USD', packageSlug: 'comprehensive', isRenewal: true })).toBe(350);
    expect(getPackageKeyPriceIls({ price: 50, currency: 'USD', packageSlug: 'basic', isRenewal: true })).toBe(175);
  });

  it("keeps exact ILS prices and converts custom USD prices normally", () => {
    expect(getPackageKeyPriceIls({ price: 1700, currency: 'ILS', packageSlug: 'comprehensive' })).toBe(1700);
    expect(getPackageKeyPriceIls({ price: 450, currency: 'USD', packageSlug: 'comprehensive' })).toBe(1575);
  });
});
