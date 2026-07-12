import { describe, expect, it } from "vitest";
import {
  STUDENT_JOB_ELIGIBILITY_FEATURE_FLAG,
  STUDENT_JOB_ELIGIBILITY_REVIEW_STATUSES,
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
      "eligible",
      "ineligible",
    ]);
  });

  it("recognizes unique constraint failures", () => {
    expect(isUniqueStudentJobEligibilityConstraintError(new Error("UNIQUE constraint failed"))).toBe(true);
    expect(isUniqueStudentJobEligibilityConstraintError(new Error("network failed"))).toBe(false);
  });
});
