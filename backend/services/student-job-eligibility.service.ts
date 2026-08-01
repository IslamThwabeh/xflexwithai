import { isSqliteUniqueConstraintError } from "../_core/databaseErrors";

export const STUDENT_JOB_ELIGIBILITY_FEATURE_FLAG = "student_job_eligibility_enabled";

export const STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES = [
  "submitted",
  "returned",
  "resubmitted",
  "eligible",
  "ineligible",
] as const;

export type StudentJobEligibilityReviewStatus =
  typeof STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES[number];

export const STUDENT_JOB_ELIGIBILITY_ERROR_CODES = [
  "job_not_available",
  "rule_not_available",
  "review_not_found",
  "review_already_pending",
  "review_already_decided",
  "invalid_review_transition",
] as const;

export type StudentJobEligibilityErrorCode =
  typeof STUDENT_JOB_ELIGIBILITY_ERROR_CODES[number];

export class StudentJobEligibilityError extends Error {
  constructor(public readonly reason: StudentJobEligibilityErrorCode) {
    super(reason);
    this.name = "StudentJobEligibilityError";
  }
}

export function canSubmitStudentJobEligibilityReview(
  currentStatus: StudentJobEligibilityReviewStatus | null | undefined,
) {
  return currentStatus == null || currentStatus === "returned";
}

export function canDecideStudentJobEligibilityReview(
  currentStatus: StudentJobEligibilityReviewStatus,
) {
  return currentStatus === "submitted" || currentStatus === "resubmitted";
}

export function isStudentJobEligibilityEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isUniqueStudentJobEligibilityConstraintError(error: unknown) {
  return isSqliteUniqueConstraintError(error);
}
