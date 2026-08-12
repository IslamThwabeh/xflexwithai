function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getPendingServiceWindow(input: {
  fallbackDate: Date;
  registrationKeyActivatedAt?: string | null;
  studyPeriodDays: number;
  entitlementDays: number;
}) {
  const parsedKeyActivationDate = input.registrationKeyActivatedAt
    ? new Date(input.registrationKeyActivatedAt)
    : null;
  const activationAnchor = parsedKeyActivationDate && !Number.isNaN(parsedKeyActivationDate.getTime())
    ? parsedKeyActivationDate
    : input.fallbackDate;

  return {
    activationAnchor,
    maxActivationDate: addDays(activationAnchor, input.studyPeriodDays),
    placeholderEndDate: addDays(activationAnchor, input.entitlementDays),
  };
}

export function shouldAutoActivateTimedServices(input: {
  now: Date;
  brokerComplete: boolean;
  courseReady?: boolean;
  lexaiMaxActivationDate?: string | null;
  recommendationMaxActivationDate?: string | null;
}) {
  if ((input.courseReady ?? true) && input.brokerComplete) {
    return true;
  }

  const dueDates = [input.lexaiMaxActivationDate, input.recommendationMaxActivationDate]
    .filter((value): value is string => !!value)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  return dueDates.some((value) => value <= input.now);
}

export type TimedServiceActivationReason =
  | "requirements_completed"
  | "protection_expired"
  | "manual"
  | "renewal"
  | "legacy";

export type TimedServiceReminderStage = "three_days" | "one_day";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the single reminder that is currently actionable. The wider windows
 * let a delayed cron recover without emitting a stale three-day reminder after
 * the one-day window has already started.
 */
export function getTimedServiceReminderStage(input: {
  now: Date;
  maxActivationDate?: string | null;
}): TimedServiceReminderStage | null {
  if (!input.maxActivationDate) return null;
  const deadline = new Date(input.maxActivationDate);
  if (Number.isNaN(deadline.getTime())) return null;
  const remainingMs = deadline.getTime() - input.now.getTime();
  if (remainingMs <= 0) return null;
  if (remainingMs <= DAY_MS) return "one_day";
  if (remainingMs <= 3 * DAY_MS) return "three_days";
  return null;
}

export function shouldNotifyLegacyTimedServiceAutoActivation(input: {
  activationReason: TimedServiceActivationReason;
  hasPendingTimedService: boolean;
  hasActivatedPackageKey: boolean;
}) {
  return input.activationReason === "protection_expired"
    && input.hasPendingTimedService
    && !input.hasActivatedPackageKey;
}

export function getTimedServiceActivationWindow(input: {
  processedAt: Date;
  maxActivationDate?: string | null;
  entitlementDays: number;
  reason: TimedServiceActivationReason;
}) {
  const deadline = input.maxActivationDate ? new Date(input.maxActivationDate) : null;
  const useDeadline = input.reason === "protection_expired"
    && deadline
    && !Number.isNaN(deadline.getTime())
    && deadline <= input.processedAt;
  const effectiveStart = useDeadline ? deadline : input.processedAt;
  return {
    effectiveStart,
    endDate: addDays(effectiveStart, input.entitlementDays),
  };
}
