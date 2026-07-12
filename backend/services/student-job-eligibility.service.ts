export const STUDENT_JOB_ELIGIBILITY_FEATURE_FLAG = "student_job_eligibility_enabled";

export const STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES = [
  "submitted",
  "returned",
  "eligible",
  "ineligible",
] as const;

export type StudentJobEligibilityReviewStatus =
  typeof STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES[number];

export function isStudentJobEligibilityEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isUniqueStudentJobEligibilityConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("unique")
    || message.toLowerCase().includes("constraint");
}
