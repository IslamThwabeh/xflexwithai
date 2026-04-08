export type PendingActivationLike = {
  maxActivationDate?: string | null;
  studyPeriodDays?: number | null;
  entitlementDays?: number | null;
};

export function getPendingActivationWindow(status?: PendingActivationLike | null) {
  const rawStudyPeriodDays = Number(status?.studyPeriodDays ?? 14);
  const rawEntitlementDays = Number(status?.entitlementDays ?? 30);

  return {
    studyPeriodDays: Number.isFinite(rawStudyPeriodDays) && rawStudyPeriodDays > 0 ? rawStudyPeriodDays : 14,
    entitlementDays: Number.isFinite(rawEntitlementDays) && rawEntitlementDays > 0 ? rawEntitlementDays : 30,
  };
}

export function formatPendingActivationDate(value: string | null | undefined, isArabic: boolean) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getPendingActivationDaysLeft(value: string | null | undefined) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const diff = parsed.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}