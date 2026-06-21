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
