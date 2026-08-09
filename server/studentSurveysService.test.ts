import { describe, expect, it } from "vitest";
import {
  MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY,
  MAX_STUDENT_SURVEY_BULK_RECIPIENTS,
  areStudentSurveyRecipientIdsSubset,
  canPostponeStudentSurvey,
  getStudentSurveyAccessState,
  getStudentSurveyBlockingAccessState,
  haveSameStudentSurveyRecipientIds,
  haveSameStudentSurveyAnswers,
  isStudentSurveysEnabled,
  isValidSurveyDateTime,
  nextPostponedDueAt,
  resolveStudentSurveyAudience,
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

  it("only lets active required unresolved surveys affect global access", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(getStudentSurveyBlockingAccessState([
      {
        status: "pending",
        dueAt: "2026-07-09T12:00:00.000Z",
        blockAt: "2026-07-10T10:00:00.000Z",
        surveyIsActive: false,
        surveyIsRequired: true,
      },
      {
        status: "pending",
        dueAt: "2026-07-09T12:00:00.000Z",
        blockAt: "2026-07-10T10:00:00.000Z",
        surveyIsActive: true,
        surveyIsRequired: false,
      },
      {
        status: "submitted",
        dueAt: "2026-07-09T12:00:00.000Z",
        blockAt: "2026-07-10T10:00:00.000Z",
        surveyIsActive: true,
        surveyIsRequired: true,
      },
    ], now)).toBe("clear");

    expect(getStudentSurveyBlockingAccessState([
      {
        status: "pending",
        dueAt: "2026-07-09T12:00:00.000Z",
        blockAt: "2026-07-10T10:00:00.000Z",
        surveyIsActive: true,
        surveyIsRequired: true,
      },
    ], now)).toBe("blocked");
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

describe("student survey audience resolution", () => {
  const students = [
    { id: 10, name: "Active", email: "active@example.com", hasActivePackage: true },
    { id: 11, name: "Inactive", email: "inactive@example.com", hasActivePackage: false },
    { id: 12, name: "Existing", email: "existing@example.com", hasActivePackage: true },
    { id: 10, name: "Duplicate", email: "duplicate@example.com", hasActivePackage: true },
  ];

  it("filters package audiences, removes duplicate students, and separates assignments", () => {
    const result = resolveStudentSurveyAudience({
      students,
      mode: "active_package",
      assignedUserIds: [12],
    });

    expect(result.matchedStudents.map((student) => student.id)).toEqual([10, 12]);
    expect(result.recipients.map((student) => student.id)).toEqual([10]);
    expect(result.alreadyAssigned.map((student) => student.id)).toEqual([12]);
    expect(result.invalidRequestedIds).toEqual([]);
  });

  it("ignores unknown ids and treats selected ids as a set", () => {
    const result = resolveStudentSurveyAudience({
      students,
      mode: "selected",
      userIds: [11, 11, 999],
    });

    expect(result.recipients.map((student) => student.id)).toEqual([11]);
    expect(result.invalidRequestedIds).toEqual([999]);
  });

  it("compares confirmed recipient snapshots without depending on order", () => {
    expect(haveSameStudentSurveyRecipientIds([12, 10], [10, 12])).toBe(true);
    expect(haveSameStudentSurveyRecipientIds([10, 12], [10])).toBe(false);
    expect(haveSameStudentSurveyRecipientIds([10, 10], [10, 10])).toBe(false);
  });

  it("recognizes safe retry subsets while rejecting additions and duplicate ids", () => {
    expect(areStudentSurveyRecipientIdsSubset([10], [10, 11])).toBe(true);
    expect(areStudentSurveyRecipientIdsSubset([10, 12], [10, 11])).toBe(false);
    expect(areStudentSurveyRecipientIdsSubset([10, 10], [10, 11])).toBe(false);
  });

  it("enforces both the reviewed batch limit and the total survey limit", () => {
    const batchStudents = Array.from(
      { length: MAX_STUDENT_SURVEY_BULK_RECIPIENTS + 1 },
      (_, index) => ({
        id: index + 1,
        name: `Student ${index + 1}`,
        email: `student${index + 1}@example.com`,
        hasActivePackage: true,
      }),
    );
    expect(resolveStudentSurveyAudience({
      students: batchStudents,
      mode: "all",
    })).toMatchObject({
      exceedsBatchLimit: true,
      exceedsTotalLimit: false,
      exceedsSafeLimit: true,
    });

    const capacityResult = resolveStudentSurveyAudience({
      students: [{ id: 999, name: "New", email: "new@example.com", hasActivePackage: true }],
      mode: "all",
      assignedUserIds: Array.from(
        { length: MAX_STUDENT_SURVEY_ASSIGNMENTS_PER_SURVEY },
        (_, index) => index + 1,
      ),
    });
    expect(capacityResult).toMatchObject({
      remainingAssignmentCapacity: 0,
      exceedsTotalLimit: true,
      exceedsSafeLimit: true,
    });
  });
});

describe("student survey submission retries", () => {
  it("matches the same normalized answers regardless of order", () => {
    expect(haveSameStudentSurveyAnswers([
      { questionId: 12, answerText: null, answerJson: '["A"]' },
      { questionId: 11, answerText: "Helpful" },
    ], [
      { questionId: 11, answerText: "Helpful", answerJson: null },
      { questionId: 12, answerJson: '["A"]' },
    ])).toBe(true);
    expect(haveSameStudentSurveyAnswers(
      [{ questionId: 11, answerText: "Original" }],
      [{ questionId: 11, answerText: "Changed" }],
    )).toBe(false);
    expect(haveSameStudentSurveyAnswers(
      [{ questionId: 11, answerText: "A" }, { questionId: 11, answerText: "A" }],
      [{ questionId: 11, answerText: "A" }, { questionId: 11, answerText: "A" }],
    )).toBe(false);
  });
});
