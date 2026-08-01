import { isSqliteUniqueConstraintError } from "../_core/databaseErrors";

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

export const STUDENT_SURVEY_AUDIENCE_MODES = [
  "single",
  "selected",
  "active_package",
  "inactive_package",
  "all",
] as const;

export type StudentSurveyAudienceMode = (typeof STUDENT_SURVEY_AUDIENCE_MODES)[number];

export type StudentSurveyAudienceStudent = {
  id: number;
  name: string | null;
  email: string;
  hasActivePackage: boolean;
};

// Keep one confirmed distribution comfortably below D1's per-request query
// ceiling. Larger audiences can be distributed in reviewed batches while the
// per-survey cap keeps every assignment review/export complete and bounded.
export const MAX_STUDENT_SURVEY_BULK_RECIPIENTS = 20;
export const MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY = 500;

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

export function getStudentSurveyBlockingAccessState(assignments: Array<{
  status: StudentSurveyAssignmentStatus;
  dueAt?: string | null;
  blockAt?: string | null;
  surveyIsActive: boolean;
  surveyIsRequired: boolean;
}>, now = new Date()): StudentSurveyAccessState {
  let hasDueSurvey = false;
  for (const assignment of assignments) {
    if (!assignment.surveyIsActive || !assignment.surveyIsRequired || assignment.status === "submitted") {
      continue;
    }
    const state = getStudentSurveyAccessState({ ...assignment, now });
    if (state === "blocked") return "blocked";
    if (state === "survey_due") hasDueSurvey = true;
  }
  return hasDueSurvey ? "survey_due" : "clear";
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
  return isSqliteUniqueConstraintError(error);
}

/**
 * Resolve an admin audience from the same student snapshot used by both the
 * preview query and the confirmed mutation. This keeps bulk distribution
 * deterministic, excludes staff/unknown ids at the source, and makes repeat
 * submissions idempotent by separating existing assignments.
 */
export function resolveStudentSurveyAudience(input: {
  students: StudentSurveyAudienceStudent[];
  mode: StudentSurveyAudienceMode;
  userIds?: number[];
  assignedUserIds?: Iterable<number>;
}) {
  const requestedIds = new Set(
    (input.userIds ?? []).filter((id) => Number.isInteger(id) && id > 0),
  );
  const assignedIds = new Set(input.assignedUserIds ?? []);
  const seen = new Set<number>();

  const matchedStudents = input.students.filter((student) => {
    if (seen.has(student.id)) return false;
    seen.add(student.id);

    switch (input.mode) {
      case "single":
      case "selected":
        return requestedIds.has(student.id);
      case "active_package":
        return student.hasActivePackage;
      case "inactive_package":
        return !student.hasActivePackage;
      case "all":
        return true;
    }
  });

  const alreadyAssigned = matchedStudents.filter((student) => assignedIds.has(student.id));
  const recipients = matchedStudents.filter((student) => !assignedIds.has(student.id));

  return {
    matchedStudents,
    alreadyAssigned,
    recipients,
    invalidRequestedIds: [...requestedIds].filter(
      (id) => !matchedStudents.some((student) => student.id === id),
    ),
    currentAssignmentCount: assignedIds.size,
    remainingAssignmentCapacity: Math.max(
      MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY - assignedIds.size,
      0,
    ),
    exceedsBatchLimit: recipients.length > MAX_STUDENT_SURVEY_BULK_RECIPIENTS,
    exceedsTotalLimit:
      assignedIds.size + recipients.length > MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY,
    exceedsSafeLimit:
      recipients.length > MAX_STUDENT_SURVEY_BULK_RECIPIENTS
      || assignedIds.size + recipients.length > MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY,
  };
}

export function haveSameStudentSurveyRecipientIds(actual: number[], expected: number[]): boolean {
  if (actual.length !== expected.length) return false;
  const normalizedActual = [...new Set(actual)].sort((a, b) => a - b);
  const normalizedExpected = [...new Set(expected)].sort((a, b) => a - b);
  if (normalizedActual.length !== actual.length || normalizedExpected.length !== expected.length) return false;
  if (normalizedActual.length !== normalizedExpected.length) return false;
  return normalizedActual.every((id, index) => id === normalizedExpected[index]);
}

export function areStudentSurveyRecipientIdsSubset(actual: number[], expected: number[]): boolean {
  if (new Set(actual).size !== actual.length || new Set(expected).size !== expected.length) return false;
  const expectedIds = new Set(expected);
  return actual.every((id) => expectedIds.has(id));
}

export function haveSameStudentSurveyAnswers(
  actual: Array<{ questionId: number; answerText?: string | null; answerJson?: string | null }>,
  expected: Array<{ questionId: number; answerText?: string | null; answerJson?: string | null }>,
): boolean {
  if (actual.length !== expected.length) return false;
  const normalize = (answers: typeof actual) => answers
    .map((answer) => ({
      questionId: answer.questionId,
      answerText: answer.answerText ?? null,
      answerJson: answer.answerJson ?? null,
    }))
    .sort((left, right) => left.questionId - right.questionId);
  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);
  if (new Set(normalizedActual.map((answer) => answer.questionId)).size !== normalizedActual.length) return false;
  if (new Set(normalizedExpected.map((answer) => answer.questionId)).size !== normalizedExpected.length) return false;
  return normalizedActual.every((answer, index) => (
    answer.questionId === normalizedExpected[index]?.questionId
    && answer.answerText === normalizedExpected[index]?.answerText
    && answer.answerJson === normalizedExpected[index]?.answerJson
  ));
}
