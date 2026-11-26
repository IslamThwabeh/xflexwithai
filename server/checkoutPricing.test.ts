import { describe, expect, it } from "vitest";
import { getCheckoutInvoiceAmounts } from "../shared/checkoutPricing";
import {
  getOrderDisplayAmountsIls,
  getOrderInvoiceContextIls,
} from "../shared/orderPricing";

describe("VAT-inclusive checkout invoice components", () => {
  it("keeps Comprehensive savings on its existing commercial ratio rather than the generic 3.5 rate", () => {
    const native = getCheckoutInvoiceAmounts(50000, 5000);
    const input = { ...native, currency: "USD", packageSlug: "comprehensive" };
    expect(getOrderDisplayAmountsIls(input)).toMatchObject({
      displaySubtotalIls: 1465.5,
      displayDiscountIls: 146.54,
      displayVatIls: 211.04,
      displayTotalIls: 1530,
      displayPricingDifferenceIls: 0,
    });
    expect(getOrderInvoiceContextIls(input, native)).toEqual({
      pricingFormatVersion: 2,
      displaySavingsIls: 170,
    });
    expect(getOrderInvoiceContextIls(input)).toEqual({});
    expect(
      getOrderInvoiceContextIls(input, { ...native, grossDiscountMinor: 1 })
    ).toEqual({ displayPricingSnapshotInvalid: true });
  });
  it("preserves the approved payable amount and VAT while separating net discount and gross savings", () => {
    expect(getCheckoutInvoiceAmounts(10000, 1000)).toEqual({
      subtotal: 8621,
      discountAmount: 862,
      vatRate: 16,
      vatAmount: 1241,
      totalAmount: 9000,
      grossSubtotalMinor: 10000,
      grossDiscountMinor: 1000,
      formatVersion: 2,
    });
    expect(getCheckoutInvoiceAmounts(20000, 2000)).toMatchObject({
      subtotal: 17241,
      discountAmount: 1724,
      vatAmount: 2483,
      totalAmount: 18000,
    });
    expect(getCheckoutInvoiceAmounts(70000, 7000)).toMatchObject({
      subtotal: 60345,
      discountAmount: 6035,
      vatAmount: 8690,
      totalAmount: 63000,
    });
  });
  it("matches an independent integer oracle including zero/full discounts and tax rounding boundaries", () => {
    const round = (value: bigint, divisor: bigint) =>
      Number((2n * value + divisor) / (2n * divisor));
    let seed = 1729;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let index = 0; index < 6000; index++) {
      const gross = index < 500 ? index : next() % 1_000_000_000;
      const discount = index % 5 === 0 ? gross : next() % (gross + 1),
        rate = index % 101;
      const actual = getCheckoutInvoiceAmounts(gross, discount, rate);
      const tax = round(
        BigInt(gross - discount) * BigInt(rate),
        BigInt(100 + rate)
      );
      const originalTax = round(
        BigInt(gross) * BigInt(rate),
        BigInt(100 + rate)
      );
      expect(actual.totalAmount).toBe(gross - discount);
      expect(actual.vatAmount).toBe(tax);
      expect(actual.subtotal).toBe(gross - originalTax);
      expect(actual.subtotal - actual.discountAmount + actual.vatAmount).toBe(
        actual.totalAmount
      );
      expect(actual.discountAmount).toBeGreaterThanOrEqual(0);
      expect(actual.grossDiscountMinor).toBe(discount);
    }
  });
  it.each([
    [-1, 0, 16],
    [100, 101, 16],
    [100, -1, 16],
    [100, 1.5, 16],
    [100, 0, -1],
    [100, 0, 101],
    [Number.MAX_SAFE_INTEGER, 0, 16],
  ])(
    "rejects invalid native amounts/rate %s/%s/%s",
    (gross, discount, rate) => {
      expect(() => getCheckoutInvoiceAmounts(gross, discount, rate)).toThrow(
        "Invalid checkout"
      );
    }
  );
});
