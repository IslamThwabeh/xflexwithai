import { describe, expect, it } from "vitest";
import {
  STUDENT_COMMUNITY_FEATURE_FLAG,
  isStudentCommunityEnabled,
} from "../backend/services/student-community.service";

describe("student community feature flag", () => {
  it("uses a dedicated disabled-by-default flag name", () => {
    expect(STUDENT_COMMUNITY_FEATURE_FLAG).toBe("student_community_enabled");
  });

  it("only enables community for explicit true", () => {
    expect(isStudentCommunityEnabled(null)).toBe(false);
    expect(isStudentCommunityEnabled("false")).toBe(false);
    expect(isStudentCommunityEnabled("1")).toBe(false);
    expect(isStudentCommunityEnabled(" TRUE ")).toBe(true);
  });
});
