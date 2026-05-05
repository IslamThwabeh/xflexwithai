type LocalePreference = 'ar' | 'en' | boolean | null | undefined;

function normalizeDate(value: string | number | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getLocalizedDateLocale(preference?: LocalePreference) {
  return preference === true || preference === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatLocalizedDate(
  value: string | number | Date,
  preference?: LocalePreference,
  options?: Intl.DateTimeFormatOptions,
) {
  const parsed = normalizeDate(value);
  return parsed ? parsed.toLocaleDateString(getLocalizedDateLocale(preference), options) : '';
}

export function formatLocalizedDateTime(
  value: string | number | Date,
  preference?: LocalePreference,
  options?: Intl.DateTimeFormatOptions,
) {
  const parsed = normalizeDate(value);
  return parsed ? parsed.toLocaleString(getLocalizedDateLocale(preference), options) : '';
}

export function formatLocalizedTime(
  value: string | number | Date,
  preference?: LocalePreference,
  options?: Intl.DateTimeFormatOptions,
) {
  const parsed = normalizeDate(value);
  return parsed ? parsed.toLocaleTimeString(getLocalizedDateLocale(preference), options) : '';
}