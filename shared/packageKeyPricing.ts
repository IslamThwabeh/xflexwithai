export type PackageKeyPricingPackage = {
  id: number;
  price: number;
  slug?: string | null;
  includesLexai?: boolean | null;
};

export const PACKAGE_KEY_USD_TO_ILS_RATE = 3.5;

type PackageKeyPricingOptions = {
  isRenewal?: boolean;
  isUpgrade?: boolean;
};

function getCanonicalPackageKeyPricing(
  selectedPackage: PackageKeyPricingPackage,
  options?: PackageKeyPricingOptions,
) {
  const isComprehensive = selectedPackage.slug === 'comprehensive'
    || selectedPackage.includesLexai === true;
  const isBasic = selectedPackage.slug === 'basic'
    || selectedPackage.includesLexai === false;

  if (options?.isRenewal) {
    if (isComprehensive) return { usd: 100, ils: 350 };
    if (isBasic) return { usd: 50, ils: 175 };
  }

  if (options?.isUpgrade && isComprehensive) {
    return { usd: 300, ils: 1000 };
  }

  if (isComprehensive) return { usd: 500, ils: 1700 };
  if (isBasic) return { usd: 200, ils: 700 };
  return null;
}

export function getSuggestedPackageKeyPrice(
  packages: PackageKeyPricingPackage[],
  packageId: number | null,
  options?: PackageKeyPricingOptions,
) {
  if (!packageId) return 0;

  const selectedPackage = packages.find((pkg) => pkg.id === packageId);
  if (!selectedPackage) return 0;

  if (options?.isRenewal) {
    return selectedPackage.includesLexai ? 100 : 50;
  }

  if (options?.isUpgrade) {
    if (!selectedPackage.includesLexai) {
      return Math.round(selectedPackage.price / 100);
    }

    const comprehensive = packages.find((pkg) => pkg.includesLexai);
    const basic = packages.find((pkg) => !pkg.includesLexai);
    if (comprehensive && basic) {
      return Math.round((comprehensive.price - basic.price) / 100);
    }

    return 300;
  }

  return Math.round(selectedPackage.price / 100);
}

/**
 * Returns the staff-facing package-key price in ILS. Package prices are fixed
 * commercial amounts, so Comprehensive must remain ₪1,700 instead of being
 * derived as $500 × 3.5 = ₪1,750.
 */
export function getSuggestedPackageKeyPriceIls(
  packages: PackageKeyPricingPackage[],
  packageId: number | null,
  options?: PackageKeyPricingOptions,
) {
  if (!packageId) return 0;

  const selectedPackage = packages.find((pkg) => pkg.id === packageId);
  if (!selectedPackage) return 0;

  const canonicalPricing = getCanonicalPackageKeyPricing(selectedPackage, options);
  if (canonicalPricing) return canonicalPricing.ils;

  return getSuggestedPackageKeyPrice(packages, packageId, options) * PACKAGE_KEY_USD_TO_ILS_RATE;
}

/**
 * Normalizes both historic USD package keys and new ILS package keys to the
 * exact staff-facing ILS amount. Historic keys at a canonical USD price use
 * the matching fixed ILS package price; custom USD prices still use the
 * standard conversion rate.
 */
export function getPackageKeyPriceIls(input: {
  price?: number | null;
  currency?: string | null;
  packageSlug?: string | null;
  includesLexai?: boolean | null;
  isRenewal?: boolean | null;
  isUpgrade?: boolean | null;
}) {
  const price = Number(input.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;

  const currency = input.currency?.trim().toUpperCase() || 'USD';
  if (currency === 'ILS' || currency === 'NIS') return price;

  const canonicalPricing = getCanonicalPackageKeyPricing({
    id: 0,
    price: 0,
    slug: input.packageSlug,
    includesLexai: input.includesLexai,
  }, {
    isRenewal: !!input.isRenewal,
    isUpgrade: !!input.isUpgrade,
  });

  if (canonicalPricing && Math.abs(price - canonicalPricing.usd) < 0.005) {
    return canonicalPricing.ils;
  }

  return price * PACKAGE_KEY_USD_TO_ILS_RATE;
}
