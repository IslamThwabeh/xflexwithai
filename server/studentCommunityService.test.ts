import { describe, expect, it } from "vitest";
import {
  STUDENT_COMMUNITY_FEATURE_FLAG,
  isStudentCommunityBanActive,
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

  it("treats permanent and unexpired bans as active", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    expect(isStudentCommunityBanActive({ status: "banned", now })).toBe(true);
    expect(isStudentCommunityBanActive({
      status: "banned",
      expiresAt: "2026-07-24T12:00:00.000Z",
      now,
    })).toBe(true);
  });

  it("automatically allows expired or restored access controls", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    expect(isStudentCommunityBanActive({
      status: "banned",
      expiresAt: "2026-07-22T12:00:00.000Z",
      now,
    })).toBe(false);
    expect(isStudentCommunityBanActive({ status: "allowed", now })).toBe(false);
  });
});
