/** Academy business defaults. Use these for new customer messages and emails. */
export const ACADEMY_COUNTRY_AR = 'فلسطين';
export const ACADEMY_COUNTRY_EN = 'Palestine';
// Ramallah / West Bank: IANA rules include Palestine's seasonal clock changes.
export const ACADEMY_TIME_ZONE = 'Asia/Hebron';
export const ACADEMY_TIME_LABEL_AR = `بتوقيت ${ACADEMY_COUNTRY_AR}`;
export const ACADEMY_TIME_LABEL_EN = `${ACADEMY_COUNTRY_EN} time`;

export function formatAcademyDateTime(value: string | Date, language: 'ar' | 'en') {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: ACADEMY_TIME_ZONE,
  }).format(new Date(value));
}
