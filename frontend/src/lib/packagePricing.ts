export const PACKAGE_DISPLAY_ILS: Record<string, number> = {
  basic: 700,
  comprehensive: 1700,
};

export const PACKAGE_RENEWAL_DISPLAY_ILS: Record<string, number> = {
  basic: 175,
  comprehensive: 350,
};

export const PACKAGE_DISPLAY_USD: Record<string, number> = {
  basic: 200,
  comprehensive: 500,
};

export const PACKAGE_RENEWAL_DISPLAY_USD: Record<string, number> = {
  basic: 50,
  comprehensive: 100,
};

const UPGRADE_DISPLAY_ILS: Record<string, number> = {
  'basic:comprehensive': 1000,
};

const UPGRADE_DISPLAY_USD: Record<string, number> = {
  'basic:comprehensive': 300,
};

const formatDisplayAmount = (symbol: string, amount: number, alwaysTwoDecimals = false) => {
  const showDecimals = alwaysTwoDecimals || Math.abs(amount % 1) > Number.EPSILON;
  return `${symbol}${amount.toFixed(showDecimals ? 2 : 0)}`;
};

export const formatIlsAmount = (amount: number, alwaysTwoDecimals = false) => {
  return formatDisplayAmount('₪', amount, alwaysTwoDecimals);
};

export const formatUsdAmount = (amount: number, alwaysTwoDecimals = false) => {
  return formatDisplayAmount('$', amount, alwaysTwoDecimals);
};

export function getPackageDisplayPricing(
  slug?: string | null,
  fallbackPriceCents = 0,
  fallbackRenewalCents?: number | null,
) {
  const key = slug ?? '';
  const hasRenewal = typeof fallbackRenewalCents === 'number' && fallbackRenewalCents > 0;

  return {
    ilsPrice: PACKAGE_DISPLAY_ILS[key] ?? Math.round((fallbackPriceCents / 100) * 3.5),
    usdPrice: PACKAGE_DISPLAY_USD[key] ?? fallbackPriceCents / 100,
    ilsRenewal: hasRenewal
      ? (PACKAGE_RENEWAL_DISPLAY_ILS[key] ?? Math.round(((fallbackRenewalCents ?? 0) / 100) * 3.5))
      : null,
    usdRenewal: hasRenewal
      ? (PACKAGE_RENEWAL_DISPLAY_USD[key] ?? (fallbackRenewalCents ?? 0) / 100)
      : null,
  };
}

export function getUpgradeDisplayPricing(
  currentSlug?: string | null,
  targetSlug?: string | null,
  fallbackUpgradeCents = 0,
  fallbackRenewalCents?: number | null,
) {
  const key = `${currentSlug ?? ''}:${targetSlug ?? ''}`;
  const targetPricing = getPackageDisplayPricing(targetSlug, 0, fallbackRenewalCents);

  return {
    ilsPrice: UPGRADE_DISPLAY_ILS[key] ?? Math.round((fallbackUpgradeCents / 100) * 3.5),
    usdPrice: UPGRADE_DISPLAY_USD[key] ?? fallbackUpgradeCents / 100,
    ilsRenewal: targetPricing.ilsRenewal,
    usdRenewal: targetPricing.usdRenewal,
  };
}