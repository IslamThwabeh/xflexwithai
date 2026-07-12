import { describe, expect, it } from "vitest";
import {
  canPostponeStudentSurvey,
  getStudentSurveyAccessState,
  isStudentSurveysEnabled,
  isValidSurveyDateTime,
  nextPostponedDueAt,
} from "../backend/services/student-surveys.service";

describe("student survey feature flag", () => {
  it("is disabled unless the stored value is explicitly true", () => {
    expect(isStudentSurveysEnabled(null)).toBe(false);
    expect(isStudentSurveysEnabled("false")).toBe(false);
    expect(isStudentSurveysEnabled("1")).toBe(false);
    expect(isStudentSurveysEnabled(" TRUE ")).toBe(true);
  });
});

describe("student survey dates and access state", () => {
  it("accepts ISO timestamps only", () => {
    expect(isValidSurveyDateTime("2026-07-10T12:00:00.000Z")).toBe(true);
    expect(isValidSurveyDateTime("2026-07-10")).toBe(false);
    expect(isValidSurveyDateTime("not-a-date")).toBe(false);
  });

  it("computes clear, due, and blocked access states", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(getStudentSurveyAccessState({
      status: "pending",
      dueAt: "2026-07-11T12:00:00.000Z",
      blockAt: "2026-07-12T12:00:00.000Z",
      now,
    })).toBe("clear");
    expect(getStudentSurveyAccessState({
      status: "pending",
      dueAt: "2026-07-10T10:00:00.000Z",
      blockAt: "2026-07-12T12:00:00.000Z",
      now,
    })).toBe("survey_due");
    expect(getStudentSurveyAccessState({
      status: "postponed",
      dueAt: "2026-07-10T10:00:00.000Z",
      blockAt: "2026-07-10T11:00:00.000Z",
      now,
    })).toBe("blocked");
  });
});

describe("student survey postponement", () => {
  it("allows pending/postponed assignments until limits or blocking time", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(canPostponeStudentSurvey({
      status: "pending",
      postponementsUsed: 1,
      maxPostponements: 2,
      blockAt: "2026-07-11T12:00:00.000Z",
      now,
    })).toBe(true);
    expect(canPostponeStudentSurvey({
      status: "pending",
      postponementsUsed: 2,
      maxPostponements: 2,
      blockAt: "2026-07-11T12:00:00.000Z",
      now,
    })).toBe(false);
    expect(canPostponeStudentSurvey({
      status: "submitted",
      postponementsUsed: 0,
      maxPostponements: 2,
      now,
    })).toBe(false);
  });

  it("does not postpone beyond the blocking timestamp", () => {
    expect(nextPostponedDueAt({
      currentDueAt: "2026-07-10T12:00:00.000Z",
      postponeHours: 48,
      blockAt: "2026-07-11T12:00:00.000Z",
      now: new Date("2026-07-10T12:00:00.000Z"),
    })).toBe("2026-07-11T12:00:00.000Z");
  });
});
