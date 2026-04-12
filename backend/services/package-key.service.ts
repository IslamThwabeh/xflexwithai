export type RenewalEligibilityPackageSubscription = {
  packageId: number | string | null | undefined;
  isActive?: boolean | null;
};

export function canRedeemRenewalPackageKey(
  existingSubscriptions: RenewalEligibilityPackageSubscription[],
  packageId: number | string | null | undefined,
) {
  const normalizedPackageId = Number(packageId);
  if (!Number.isFinite(normalizedPackageId)) return false;

  const activeSubscriptions = existingSubscriptions.filter(
    (subscription) => subscription.isActive !== false,
  );

  // Imported or outside-system users may not have an in-system package row yet.
  if (activeSubscriptions.length === 0) {
    return true;
  }

  return activeSubscriptions.some(
    (subscription) => Number(subscription.packageId) === normalizedPackageId,
  );
}
