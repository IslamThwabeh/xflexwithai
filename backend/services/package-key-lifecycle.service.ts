export type PackageSlug = "basic" | "comprehensive" | string;

export type StudentHistorySnapshot = {
  packageSubscriptionCount?: number | null;
  timedSubscriptionCount?: number | null;
  activatedPackageKeyCount?: number | null;
};

export type ReadinessSnapshot = {
  courseCompleted?: boolean | null;
  courseAdminSkipped?: boolean | null;
  brokerCompleted?: boolean | null;
};

export type RenewalTransitionInput = {
  targetPackageSlug: PackageSlug;
  activePackageSlugs: PackageSlug[];
  hasActiveLexai: boolean;
};

export function hasExistingStudentHistory(history: StudentHistorySnapshot) {
  return Boolean(
    (history.packageSubscriptionCount ?? 0) > 0
      || (history.timedSubscriptionCount ?? 0) > 0
      || (history.activatedPackageKeyCount ?? 0) > 0,
  );
}

export function isStudentReadyForTimedServices(readiness: ReadinessSnapshot) {
  const courseReady = Boolean(readiness.courseCompleted || readiness.courseAdminSkipped);
  const brokerReady = Boolean(readiness.brokerCompleted);
  return courseReady && brokerReady;
}

export function shouldBlockFreshKeyForExistingStudent(input: {
  isRenewal?: boolean | null;
  isUpgrade?: boolean | null;
  history: StudentHistorySnapshot;
}) {
  if (input.isRenewal || input.isUpgrade) return false;
  return hasExistingStudentHistory(input.history);
}

export function validateRenewalPackageTransition(input: RenewalTransitionInput):
  | { allowed: true }
  | { allowed: false; reason: "comprehensive_to_basic_active" | "different_package" } {
  const target = input.targetPackageSlug;
  const active = new Set(input.activePackageSlugs);

  if (target === "basic" && input.hasActiveLexai) {
    return { allowed: false, reason: "comprehensive_to_basic_active" };
  }

  if (active.size === 0) return { allowed: true };
  if (active.has(target)) return { allowed: true };
  if (active.has("basic") && target === "comprehensive") return { allowed: true };

  return { allowed: false, reason: "different_package" };
}

export function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

export function getRemainingTimedServiceDays(endDateInput: string | null | undefined, fromDate: Date) {
  if (!endDateInput) return 0;
  const endDate = new Date(endDateInput);
  if (Number.isNaN(endDate.getTime()) || endDate <= fromDate) return 0;
  return Math.ceil((endDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

export function getServiceDaysForPackageTransition(input: {
  sourcePackageSlug?: PackageSlug | null;
  targetPackageSlug: PackageSlug;
  keyDays: number;
  remainingRecommendationDays: number;
}) {
  const isBasicToComprehensive = input.sourcePackageSlug === "basic" && input.targetPackageSlug === "comprehensive";
  return {
    recommendationDays: input.keyDays + (isBasicToComprehensive ? Math.max(0, input.remainingRecommendationDays) : 0),
    lexaiDays: input.keyDays,
  };
}

export function derivePendingServiceDays(input: {
  maxActivationDate?: string | null;
  placeholderEndDate?: string | null;
  fallbackDays: number;
}) {
  if (!input.maxActivationDate || !input.placeholderEndDate) return input.fallbackDays;

  const maxActivationDate = new Date(input.maxActivationDate);
  const placeholderEndDate = new Date(input.placeholderEndDate);
  if (Number.isNaN(maxActivationDate.getTime()) || Number.isNaN(placeholderEndDate.getTime())) {
    return input.fallbackDays;
  }

  const days = Math.ceil((placeholderEndDate.getTime() - maxActivationDate.getTime()) / (24 * 60 * 60 * 1000));
  return Number.isFinite(days) && days > 0 ? days : input.fallbackDays;
}
