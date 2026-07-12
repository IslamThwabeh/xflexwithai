export const STUDENT_SURVEYS_FEATURE_FLAG = "student_surveys_enabled";
export const STUDENT_SURVEYS_BLOCKING_FEATURE_FLAG = "student_surveys_blocking_enabled";

export const STUDENT_SURVEY_ASSIGNMENT_STATUSES = [
  "pending",
  "postponed",
  "submitted",
  "blocked",
] as const;

export type StudentSurveyAssignmentStatus = (typeof STUDENT_SURVEY_ASSIGNMENT_STATUSES)[number];

export const STUDENT_SURVEY_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "rating",
] as const;

export type StudentSurveyQuestionType = (typeof STUDENT_SURVEY_QUESTION_TYPES)[number];
export type StudentSurveyAccessState = "clear" | "survey_due" | "blocked";

const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T/;

export function isStudentSurveysEnabled(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isStudentSurveyBlockingEnabled(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isValidSurveyDateTime(value: string): boolean {
  if (!ISO_DATE_TIME_RE.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export function getStudentSurveyAccessState(input: {
  status: StudentSurveyAssignmentStatus;
  dueAt?: string | null;
  blockAt?: string | null;
  now?: Date;
}): StudentSurveyAccessState {
  if (input.status === "submitted") return "clear";

  const nowMs = (input.now ?? new Date()).getTime();
  const blockAtMs = input.blockAt ? new Date(input.blockAt).getTime() : Number.NaN;
  const dueAtMs = input.dueAt ? new Date(input.dueAt).getTime() : Number.NaN;

  if (input.status === "blocked" || (!Number.isNaN(blockAtMs) && blockAtMs <= nowMs)) {
    return "blocked";
  }

  if (!Number.isNaN(dueAtMs) && dueAtMs <= nowMs) {
    return "survey_due";
  }

  return "clear";
}

export function canPostponeStudentSurvey(input: {
  status: StudentSurveyAssignmentStatus;
  postponementsUsed: number;
  maxPostponements: number;
  blockAt?: string | null;
  now?: Date;
}): boolean {
  if (!["pending", "postponed"].includes(input.status)) return false;
  if (input.postponementsUsed >= input.maxPostponements) return false;

  const blockAtMs = input.blockAt ? new Date(input.blockAt).getTime() : Number.NaN;
  if (!Number.isNaN(blockAtMs) && blockAtMs <= (input.now ?? new Date()).getTime()) {
    return false;
  }

  return true;
}

export function nextPostponedDueAt(input: {
  currentDueAt?: string | null;
  postponeHours: number;
  blockAt?: string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const currentDue = input.currentDueAt ? new Date(input.currentDueAt) : now;
  const base = Number.isNaN(currentDue.getTime()) || currentDue < now ? now : currentDue;
  const nextDue = new Date(base.getTime() + input.postponeHours * 60 * 60 * 1000);

  if (input.blockAt) {
    const blockAt = new Date(input.blockAt);
    if (!Number.isNaN(blockAt.getTime()) && nextDue > blockAt) {
      return blockAt.toISOString();
    }
  }

  return nextDue.toISOString();
}

export function isUniqueSurveyConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint|constraint failed|already exists/i.test(message);
}
