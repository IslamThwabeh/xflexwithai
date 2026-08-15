import { describe, expect, it } from "vitest";
import {
  buildStudentSurveyNotificationContent,
  buildStudentSurveyNotificationDedupeKey,
  getNextStudentSurveyNotificationAt,
  getStudentSurveyNotificationLanguage,
  getStudentSurveyNotificationStage,
} from "../backend/services/student-survey-notifications.service";

describe("student survey notification cadence", () => {
  const now = new Date("2026-08-15T08:00:00.000Z");

  it("schedules assignment, pre-due, due, then 24-hour reminders", () => {
    const dueAt = "2026-08-17T08:00:00.000Z";
    expect(getStudentSurveyNotificationStage({ dueAt, notificationCount: 0, now })).toBe("assigned");
    expect(getNextStudentSurveyNotificationAt({ dueAt, stage: "assigned", now }))
      .toBe("2026-08-16T08:00:00.000Z");
    expect(getStudentSurveyNotificationStage({ dueAt, notificationCount: 1, lastStage: "assigned", now: new Date("2026-08-16T08:00:00.000Z") }))
      .toBe("pre_due");
    expect(getNextStudentSurveyNotificationAt({ dueAt, stage: "pre_due", now })).toBe(dueAt);
    expect(getStudentSurveyNotificationStage({ dueAt, notificationCount: 2, lastStage: "pre_due", now: new Date(dueAt) }))
      .toBe("due");
    expect(getNextStudentSurveyNotificationAt({ dueAt, stage: "due", now: new Date(dueAt) }))
      .toBe("2026-08-18T08:00:00.000Z");
    expect(getStudentSurveyNotificationStage({ dueAt, notificationCount: 3, lastStage: "due", now: new Date("2026-08-18T08:00:00.000Z") }))
      .toBe("overdue");
  });

  it("defaults to Arabic and groups only identical language/content variants", () => {
    expect(getStudentSurveyNotificationLanguage(null)).toBe("ar");
    expect(getStudentSurveyNotificationLanguage('{"language":"en"}')).toBe("en");
    const ar = buildStudentSurveyNotificationContent({
      surveyTitle: "تقييم الخدمة",
      dueAt: "2026-08-17T08:00:00.000Z",
      stage: "assigned",
      language: "ar",
      surveyUrl: "https://xflexacademy.com/surveys",
    });
    const en = buildStudentSurveyNotificationContent({
      surveyTitle: "تقييم الخدمة",
      dueAt: "2026-08-17T08:00:00.000Z",
      stage: "assigned",
      language: "en",
      surveyUrl: "https://xflexacademy.com/surveys",
    });
    expect(ar.subject).not.toBe(en.subject);
    expect(ar.html).toContain('dir="rtl"');
    expect(en.html).toContain('dir="ltr"');
  });

  it("dedupes fixed stages per assignment and due date", () => {
    expect(buildStudentSurveyNotificationDedupeKey({
      assignmentId: 7,
      stage: "due",
      dueAt: "2026-08-17T08:00:00.000Z",
    })).toBe("student_survey:7:due:2026-08-17T08:00:00.000Z");
  });
});
