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
    placeholderEndDate: addDays(activationAnchor, input.studyPeriodDays + input.entitlementDays),
  };
}

export function shouldAutoActivateTimedServices(input: {
  now: Date;
  brokerComplete: boolean;
  lexaiMaxActivationDate?: string | null;
  recommendationMaxActivationDate?: string | null;
}) {
  if (input.brokerComplete) {
    return true;
  }

  const dueDates = [input.lexaiMaxActivationDate, input.recommendationMaxActivationDate]
    .filter((value): value is string => !!value)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  return dueDates.some((value) => value <= input.now);
}