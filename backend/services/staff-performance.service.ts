export const STAFF_PERFORMANCE_FEATURE_FLAG = "staff_performance_enabled";

export const STAFF_PERFORMANCE_ROLES = [
  "staff_performance_employee",
  "staff_performance_manager",
] as const;

export type StaffPerformanceRole = (typeof STAFF_PERFORMANCE_ROLES)[number];

export const STAFF_PERFORMANCE_STATUSES = [
  "draft",
  "submitted",
  "returned",
  "approved",
  "locked",
] as const;

export type StaffPerformanceStatus = (typeof STAFF_PERFORMANCE_STATUSES)[number];
export type StaffPerformanceActor = "employee" | "manager";

const EDITABLE_STATUSES = new Set<StaffPerformanceStatus>(["draft", "returned"]);

const STATUS_TRANSITIONS: Record<
  StaffPerformanceActor,
  Partial<Record<StaffPerformanceStatus, readonly StaffPerformanceStatus[]>>
> = {
  employee: {
    draft: ["submitted"],
    returned: ["submitted"],
  },
  manager: {
    draft: ["submitted"],
    submitted: ["returned", "approved"],
    returned: ["submitted"],
    approved: ["locked"],
  },
};

const ISO_DATE_RE = /^\d{4}-(\d{2})-(\d{2})$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isStaffPerformanceEnabled(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isEditableStaffPerformanceStatus(status: StaffPerformanceStatus): boolean {
  return EDITABLE_STATUSES.has(status);
}

export function canTransitionStaffPerformanceStatus(
  actor: StaffPerformanceActor,
  from: StaffPerformanceStatus,
  to: StaffPerformanceStatus,
): boolean {
  return STATUS_TRANSITIONS[actor][from]?.includes(to) ?? false;
}

export function isValidPerformanceMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

export function parseIsoCalendarDate(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(match[1]);
  const day = Number(match[2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function isValidIsoCalendarDate(value: string): boolean {
  return parseIsoCalendarDate(value) !== null;
}

export function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function isValidPerformanceWeek(weekStart: string, weekEnd: string): boolean {
  const start = parseIsoCalendarDate(weekStart);
  const end = parseIsoCalendarDate(weekEnd);
  if (!start || !end) return false;

  const dayMs = 24 * 60 * 60 * 1000;
  return start.getUTCDay() === 1
    && end.getUTCDay() === 0
    && (end.getTime() - start.getTime()) / dayMs === 6;
}

export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint|constraint failed|already exists/i.test(message);
}
