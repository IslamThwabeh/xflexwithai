import { describe, expect, it } from "vitest";
import {
  getOrderDisplayAmountsIls,
  getOrderDisplayTotalIls,
} from "../shared/orderPricing";

const minor = (value: number) => Math.round(value * 100);
describe("order component display allocation", () => {
  it("fixes the reviewed Basic one-agora discrepancy without changing the commercial total", () => {
    const result = getOrderDisplayAmountsIls({
      subtotal: 17241,
      discountAmount: 0,
      vatAmount: 2759,
      totalAmount: 20000,
      currency: "USD",
      packageSlug: "basic",
    });
    expect(result).toEqual({
      displaySubtotalIls: 603.44,
      displayDiscountIls: 0,
      displayVatIls: 96.56,
      displayTotalIls: 700,
      displayPricingDifferenceIls: 0,
    });
  });

  it.each([
    { currency: "ILS", packageSlug: "basic", isUpgrade: false },
    { currency: "NIS", packageSlug: "comprehensive", isUpgrade: false },
    { currency: "USD", packageSlug: "basic", isUpgrade: false },
    { currency: "USD", packageSlug: "comprehensive", isUpgrade: false },
    { currency: "USD", packageSlug: "comprehensive", isUpgrade: true },
    { currency: "USD", packageSlug: "other", isUpgrade: false },
  ])(
    "keeps exact displayed totals and bounded components for $currency / $packageSlug / upgrade=$isUpgrade",
    policy => {
      for (let amount = 1; amount <= 1000; amount++) {
        const input = {
          subtotal: amount * 43,
          discountAmount: amount % 29,
          vatAmount: amount * 7,
          totalAmount: amount * 50 - (amount % 29),
          ...policy,
        };
        const original = { ...input };
        const result = getOrderDisplayAmountsIls(input);
        expect(
          minor(result.displaySubtotalIls) -
            minor(result.displayDiscountIls) +
            minor(result.displayVatIls)
        ).toBe(minor(result.displayTotalIls));
        expect(result.displayPricingDifferenceIls).toBe(0);
        const ratio =
          policy.currency === "ILS" || policy.currency === "NIS"
            ? [1n, 1n]
            : policy.isUpgrade
              ? [10n, 3n]
              : policy.packageSlug === "comprehensive"
                ? [17n, 5n]
                : [7n, 2n];
        const expected =
          (BigInt(input.totalAmount) * ratio[0] + ratio[1] / 2n) / ratio[1];
        expect(minor(result.displayTotalIls)).toBe(Number(expected));
        for (const [field, value] of [
          ["subtotal", result.displaySubtotalIls],
          ["discountAmount", result.displayDiscountIls],
          ["vatAmount", result.displayVatIls],
        ] as const) {
          const exact =
            getOrderDisplayTotalIls({ ...policy, totalAmount: input[field] }) *
            100;
          expect(Math.abs(minor(value) - exact)).toBeLessThanOrEqual(
            1.00000001
          );
        }
        expect(input).toEqual(original);
      }
    }
  );

  it.each([
    [1, 0.04],
    [20001, 700.04],
    [-1, -0.04],
  ] as const)(
    "rounds exact half-agora totals symmetrically for %s cents",
    (amount, expected) => {
      const result = getOrderDisplayAmountsIls({
        subtotal: amount,
        vatAmount: 0,
        totalAmount: amount,
        currency: "USD",
        packageSlug: "basic",
      });
      expect(result.displayTotalIls).toBe(expected);
      expect(result.displaySubtotalIls).toBe(expected);
      expect(result.displayPricingDifferenceIls).toBe(0);
    }
  );

  it("reports a real source discrepancy rather than disguising it as converted VAT", () => {
    const result = getOrderDisplayAmountsIls({
      subtotal: 100,
      vatAmount: 16,
      totalAmount: 200,
      currency: "ILS",
    });
    expect(result).toEqual({
      displaySubtotalIls: 1,
      displayDiscountIls: 0,
      displayVatIls: 0.16,
      displayTotalIls: 2,
      displayPricingDifferenceIls: 0.84,
    });
  });
});
