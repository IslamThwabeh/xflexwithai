import { ACADEMY_TIME_ZONE } from '../../../shared/academyLocale';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ACADEMY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatApprovalDateTime(value: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Parse the labelled Palestine wall time independently of the admin device's timezone. */
export function parseApprovalDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN);
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = wall + delta;
    const parts = formatApprovalDateTime(new Date(sample)).split(/[-T:]/).map(Number);
    const offset = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]) - sample;
    const instant = wall - offset;
    if (formatApprovalDateTime(new Date(instant)) === value) candidates.add(instant);
  }
  // Do not silently choose a cash timestamp within skipped/repeated seasonal-clock hours.
  return new Date(candidates.size === 1 ? [...candidates][0] : NaN);
}
