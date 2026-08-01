import { describe, expect, it } from "vitest";
import {
  STUDENT_JOB_ELIGIBILITY_FEATURE_FLAG,
  STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES,
  canDecideStudentJobEligibilityReview,
  canSubmitStudentJobEligibilityReview,
  isStudentJobEligibilityEnabled,
  isUniqueStudentJobEligibilityConstraintError,
} from "../backend/services/student-job-eligibility.service";

describe("student job eligibility service", () => {
  it("defines a disabled-by-default feature flag contract", () => {
    expect(STUDENT_JOB_ELIGIBILITY_FEATURE_FLAG).toBe("student_job_eligibility_enabled");
    expect(isStudentJobEligibilityEnabled(null)).toBe(false);
    expect(isStudentJobEligibilityEnabled("false")).toBe(false);
    expect(isStudentJobEligibilityEnabled("1")).toBe(false);
    expect(isStudentJobEligibilityEnabled(" TRUE ")).toBe(true);
  });

  it("keeps review statuses explicit", () => {
    expect(STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES).toEqual([
      "submitted",
      "returned",
      "resubmitted",
      "eligible",
      "ineligible",
    ]);
  });

  it("enforces the returned-to-resubmitted review lifecycle", () => {
    expect(canSubmitStudentJobEligibilityReview(null)).toBe(true);
    expect(canSubmitStudentJobEligibilityReview("returned")).toBe(true);
    expect(canSubmitStudentJobEligibilityReview("submitted")).toBe(false);
    expect(canSubmitStudentJobEligibilityReview("resubmitted")).toBe(false);
    expect(canSubmitStudentJobEligibilityReview("eligible")).toBe(false);
    expect(canDecideStudentJobEligibilityReview("submitted")).toBe(true);
    expect(canDecideStudentJobEligibilityReview("resubmitted")).toBe(true);
    expect(canDecideStudentJobEligibilityReview("returned")).toBe(false);
    expect(canDecideStudentJobEligibilityReview("ineligible")).toBe(false);
  });

  it("recognizes unique constraint failures", () => {
    expect(isUniqueStudentJobEligibilityConstraintError(new Error("UNIQUE constraint failed"))).toBe(true);
    expect(isUniqueStudentJobEligibilityConstraintError(
      new Error("Failed query: insert into student_job_eligibility_reviews", {
        cause: new Error("UNIQUE constraint failed: student_job_eligibility_reviews.user_id"),
      }),
    )).toBe(true);
    expect(isUniqueStudentJobEligibilityConstraintError(new Error("network failed"))).toBe(false);
  });
});
