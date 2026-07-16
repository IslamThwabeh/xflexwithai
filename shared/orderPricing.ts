import { PACKAGE_KEY_USD_TO_ILS_RATE } from './packageKeyPricing';

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
  const currency = input.currency?.trim().toUpperCase() || 'USD';
  if (currency === 'ILS' || currency === 'NIS') return major;

  if (input.isUpgrade && input.packageSlug === 'comprehensive') {
    return (major / 300) * 1000;
  }

  const canonical = CANONICAL_PACKAGE_PRICES[input.packageSlug ?? ''];
  if (canonical && canonical.usd > 0) {
    return (major / canonical.usd) * canonical.ils;
  }
  return major * PACKAGE_KEY_USD_TO_ILS_RATE;
}

export function formatOrderTotalIls(amountIls: number) {
  return `₪${amountIls.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amountIls) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
