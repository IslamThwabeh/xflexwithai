import { PACKAGE_KEY_USD_TO_ILS_RATE } from "./packageKeyPricing";

const CANONICAL_PACKAGE_PRICES: Record<string, { usd: number; ils: number }> = {
  basic: { usd: 200, ils: 700 },
  comprehensive: { usd: 500, ils: 1700 },
};

/**
 * Converts an order total to its commercial ILS display amount. Historic
 * orders remain stored in USD cents, but Comprehensive uses the fixed
 * ₪1,700 commercial price rather than the generic $500 × 3.5 = ₪1,750.
 * Percentage discounts preserve the same commercial-price ratio.
 */
export function getOrderDisplayTotalIls(input: {
  totalAmount: number;
  currency?: string | null;
  packageSlug?: string | null;
  fromCents?: boolean;
  isUpgrade?: boolean;
}) {
  const amount = Number(input.totalAmount ?? 0);
  if (!Number.isFinite(amount)) return 0;
  const major = input.fromCents === false ? amount : amount / 100;
  const currency = input.currency?.trim().toUpperCase() || "USD";
  if (currency === "ILS" || currency === "NIS") return major;

  if (input.isUpgrade && input.packageSlug === "comprehensive") {
    return (major / 300) * 1000;
  }

  const canonical = CANONICAL_PACKAGE_PRICES[input.packageSlug ?? ""];
  if (canonical && canonical.usd > 0) {
    return (major / canonical.usd) * canonical.ils;
  }
  return major * PACKAGE_KEY_USD_TO_ILS_RATE;
}

function orderMinorRatio(input: {
  currency?: string | null;
  packageSlug?: string | null;
  isUpgrade?: boolean;
}) {
  const currency = input.currency?.trim().toUpperCase() || "USD";
  if (currency === "ILS" || currency === "NIS") return [1, 1] as const;
  if (input.isUpgrade && input.packageSlug === "comprehensive")
    return [1000, 300] as const;
  const canonical = CANONICAL_PACKAGE_PRICES[input.packageSlug ?? ""];
  if (canonical) return [canonical.ils, canonical.usd] as const;
  const [whole, fraction = ""] = String(PACKAGE_KEY_USD_TO_ILS_RATE).split(".");
  return [Number(whole + fraction), 10 ** fraction.length] as const;
}

/** Half away from zero, using an exact integer numerator/remainder. */
function roundedRatio(numerator: number, denominator: number) {
  const truncated = Math.trunc(numerator / denominator);
  const remainder = numerator % denominator;
  const result =
    truncated +
    (Math.abs(remainder) * 2 >= denominator ? Math.sign(numerator) : 0);
  return result === 0 ? 0 : result;
}

export function getOrderDisplayAmountsIls(input: {
  subtotal: number;
  discountAmount?: number | null;
  vatAmount: number;
  totalAmount: number;
  currency?: string | null;
  packageSlug?: string | null;
  isUpgrade?: boolean;
}) {
  const convert = (amount: number) =>
    getOrderDisplayTotalIls({
      totalAmount: amount,
      currency: input.currency,
      packageSlug: input.packageSlug,
      isUpgrade: input.isUpgrade,
    });

  const source = [
    input.subtotal,
    -(input.discountAmount ?? 0),
    input.vatAmount,
    input.totalAmount,
  ];
  const [numerator, denominator] = orderMinorRatio(input);
  const sourceIntegers = source.every(Number.isSafeInteger);
  // Current ILS orders already store integer agorot. Avoid conversion and
  // allocation work entirely, while retaining genuine source discrepancies.
  if (numerator === 1 && denominator === 1 && sourceIntegers) {
    return {
      displaySubtotalIls: source[0] / 100,
      displayDiscountIls: source[1] === 0 ? 0 : -source[1] / 100,
      displayVatIls: source[2] / 100,
      displayTotalIls: source[3] / 100,
      displayPricingDifferenceIls:
        (source[3] - source[0] - source[1] - source[2]) / 100,
    };
  }
  const scaled = source.map(value => value * numerator);
  const exactIntegers =
    sourceIntegers &&
    scaled.every(Number.isSafeInteger) &&
    Number.isSafeInteger(denominator) &&
    denominator > 0;
  // Legacy invalid/out-of-range values retain conversion behavior and remain
  // separately reviewable; they never become a new stored amount or cash value.
  const roundLegacy = (value: number) =>
    value < 0 ? -Math.round(-value) : Math.round(value);
  const totalMinor = exactIntegers
    ? roundedRatio(scaled[3], denominator)
    : roundLegacy(convert(input.totalAmount) * 100);
  let components = exactIntegers
    ? scaled.slice(0, 3).map(value => roundedRatio(value, denominator))
    : [
        convert(input.subtotal) * 100,
        -convert(input.discountAmount ?? 0) * 100,
        convert(input.vatAmount) * 100,
      ].map(roundLegacy);

  if (exactIntegers && source[0] + source[1] + source[2] === source[3]) {
    // Largest remainder uses integer remainders, so equal conversion pennies
    // stay equal. VAT keeps its recorded basis rather than being recalculated.
    const parts = scaled.slice(0, 3).map((value, index) => {
      const remainder = value % denominator;
      return {
        index,
        floor: Math.trunc(value / denominator) - (remainder < 0 ? 1 : 0),
        remainder: remainder < 0 ? remainder + denominator : remainder,
      };
    });
    const remaining =
      totalMinor - parts.reduce((sum, part) => sum + part.floor, 0);
    if (remaining >= 0 && remaining <= parts.length) {
      components = parts.map(part => part.floor);
      const ranked = [...parts].sort(
        (left, right) =>
          right.remainder - left.remainder || left.index - right.index
      );
      for (let index = 0; index < remaining; index++)
        components[ranked[index].index]++;
    }
  }
  const differenceMinor =
    totalMinor - components.reduce((sum, value) => sum + value, 0);
  return {
    displaySubtotalIls: components[0] / 100,
    displayDiscountIls: components[1] === 0 ? 0 : -components[1] / 100,
    displayVatIls: components[2] / 100,
    displayTotalIls: totalMinor / 100,
    // A genuine source mismatch must remain visible for review, never be
    // silently absorbed into VAT or used to modify recorded cash.
    displayPricingDifferenceIls: differenceMinor / 100,
  };
}

/** Extra context exists only for explicitly snapshotted future invoices.
 * Legacy rows keep their original display and discrepancy behavior. */
export function getOrderInvoiceContextIls(
  input: {
    totalAmount: number;
    currency?: string | null;
    packageSlug?: string | null;
    isUpgrade?: boolean;
  },
  snapshot?: {
    formatVersion: number;
    grossSubtotalMinor: number;
    grossDiscountMinor: number;
  } | null
) {
  if (!snapshot) return {};
  const { formatVersion, grossSubtotalMinor, grossDiscountMinor } = snapshot;
  const [numerator, denominator] = orderMinorRatio(input);
  if (
    formatVersion !== 2 ||
    ![
      grossSubtotalMinor,
      grossDiscountMinor,
      input.totalAmount,
      grossSubtotalMinor * numerator,
      input.totalAmount * numerator,
    ].every(Number.isSafeInteger) ||
    grossSubtotalMinor < 0 ||
    grossDiscountMinor < 0 ||
    grossDiscountMinor > grossSubtotalMinor ||
    grossSubtotalMinor - grossDiscountMinor !== input.totalAmount
  )
    return { displayPricingSnapshotInvalid: true };
  const originalMinor = roundedRatio(
    grossSubtotalMinor * numerator,
    denominator
  );
  const totalMinor = roundedRatio(input.totalAmount * numerator, denominator);
  return {
    pricingFormatVersion: 2 as const,
    displaySavingsIls: (originalMinor - totalMinor) / 100,
  };
}

export function formatOrderTotalIls(amountIls: number) {
  return `₪${amountIls.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amountIls) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
