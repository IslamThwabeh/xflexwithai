export type PackageKeyPricingPackage = {
  id: number;
  price: number;
  includesLexai?: boolean | null;
};

export function getSuggestedPackageKeyPrice(
  packages: PackageKeyPricingPackage[],
  packageId: number | null,
  options?: {
    isRenewal?: boolean;
    isUpgrade?: boolean;
  },
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