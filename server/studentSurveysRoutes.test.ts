import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    getUserById: vi.fn(),
    logStaffAction: vi.fn(),
    listStudentSurveyAssignmentsForUser: vi.fn(),
    createStudentSurvey: vi.fn(),
    getStudentSurvey: vi.fn(),
    createStudentSurveyQuestion: vi.fn(),
    assignStudentSurvey: vi.fn(),
    listStudentSurveyAssignmentsForAdmin: vi.fn(),
    getStudentSurveyAssignment: vi.fn(),
    sendStudentSurveyAssignmentReminder: vi.fn(),
    postponeStudentSurveyAssignment: vi.fn(),
    submitStudentSurveyAssignment: vi.fn(),
    listStudentSurveyAuditLogs: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(userId = 9, email = `student${userId}@example.com`) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/studentSurveys" },
    user: {
      id: userId,
      email,
      passwordHash: "",
      name: "Student",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: false,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

const activeAssignment = {
  id: 7,
  surveyId: 3,
  userId: 9,
  status: "pending",
  dueAt: "2026-07-10T10:00:00.000Z",
  blockAt: "2026-07-12T10:00:00.000Z",
  postponementsUsed: 0,
  maxPostponements: 2,
  postponeHours: 24,
  questions: [
    { id: 11, isRequired: true, questionType: "short_text", optionsJson: null },
  ],
};

describe("student survey routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "true";
      if (key === "student_surveys_blocking_enabled") return "false";
      return null;
    });
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    vi.mocked(db.listStudentSurveyAssignmentsForUser).mockResolvedValue([]);
  });

  it("rejects protected survey routes while the feature flag is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "false";
      return null;
    });

    await expect(createCaller().studentSurveys.featureInfo()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Student surveys are disabled",
    });
    expect(db.getAdminByEmail).not.toHaveBeenCalled();
  });

  it("reports disabled availability without checking admin state", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().studentSurveys.availability()).resolves.toEqual({
      enabled: false,
      blockingEnabled: false,
      access: null,
      accessState: "clear",
    });
    expect(db.getAdminByEmail).not.toHaveBeenCalled();
  });

  it("summarizes blocked assignment state in availability", async () => {
    vi.mocked(db.listStudentSurveyAssignmentsForUser).mockResolvedValue([
      { accessState: "survey_due" },
      { accessState: "blocked" },
    ] as any);

    await expect(createCaller().studentSurveys.availability()).resolves.toMatchObject({
      enabled: true,
      blockingEnabled: false,
      access: "student",
      accessState: "blocked",
    });
  });

  it("reports admin access in availability for student survey managers", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId: number, roles: string[]) =>
      roles.includes("student_surveys_manager")
    );

    await expect(createCaller(44, "survey-manager@example.com").studentSurveys.availability())
      .resolves.toMatchObject({
        enabled: true,
        access: "admin",
      });
  });

  it("reports route blocking only when the separate enforcement flag is enabled", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "true";
      if (key === "student_surveys_blocking_enabled") return "true";
      return null;
    });

    await expect(createCaller().studentSurveys.availability()).resolves.toMatchObject({
      enabled: true,
      blockingEnabled: true,
      access: "student",
      accessState: "clear",
    });
  });

  it("keeps survey creation limited to admins or survey managers", async () => {
    await expect(createCaller().studentSurveys.createSurvey({
      code: "pilot-checkin",
      title: "Pilot check-in",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createStudentSurvey).not.toHaveBeenCalled();
  });

  it("allows admins to create survey definitions", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.createStudentSurvey).mockResolvedValue({ id: 3, code: "pilot-checkin" } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createSurvey({
      code: "pilot-checkin",
      title: "Pilot check-in",
      isActive: false,
    })).resolves.toEqual({ id: 3, code: "pilot-checkin" });
    expect(db.createStudentSurvey).toHaveBeenCalledWith(expect.objectContaining({
      code: "pilot-checkin",
      actorUserId: 1,
    }));
  });

  it("allows student survey managers to create survey definitions", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId: number, roles: string[]) =>
      roles.includes("student_surveys_manager")
    );
    vi.mocked(db.createStudentSurvey).mockResolvedValue({ id: 3, code: "pilot-checkin" } as any);

    await expect(createCaller(44, "survey-manager@example.com").studentSurveys.createSurvey({
      code: "pilot-checkin",
      title: "Pilot check-in",
      isActive: false,
    })).resolves.toEqual({ id: 3, code: "pilot-checkin" });
    expect(db.createStudentSurvey).toHaveBeenCalledWith(expect.objectContaining({
      code: "pilot-checkin",
      actorUserId: 44,
    }));
  });

  it("maps duplicate survey records to conflict", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.createStudentSurvey).mockRejectedValue(new Error("UNIQUE constraint failed"));

    await expect(createCaller(1, "admin@example.com").studentSurveys.createSurvey({
      code: "pilot-checkin",
      title: "Pilot check-in",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A survey record already exists for this scope",
    });
  });

  it("rejects choice questions without enough options", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, questions: [] } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createQuestion({
      surveyId: 3,
      questionText: "Pick one",
      questionType: "single_choice",
      options: ["Only one"],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createStudentSurveyQuestion).not.toHaveBeenCalled();
  });

  it("prevents students from reading another student's assignment", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      userId: 10,
    } as any);

    await expect(createCaller(9).studentSurveys.getMyAssignment({ id: 7 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps assignment review admin-only", async () => {
    await expect(createCaller().studentSurveys.listAssignments({ surveyId: 3 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listStudentSurveyAssignmentsForAdmin).not.toHaveBeenCalled();
  });

  it("allows admins to review survey assignments", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.listStudentSurveyAssignmentsForAdmin).mockResolvedValue([
      { id: 7, surveyId: 3, userId: 9, status: "submitted", studentEmail: "student@example.com" },
    ] as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.listAssignments({
      surveyId: 3,
      limit: 50,
    })).resolves.toEqual([
      { id: 7, surveyId: 3, userId: 9, status: "submitted", studentEmail: "student@example.com" },
    ]);
    expect(db.listStudentSurveyAssignmentsForAdmin).toHaveBeenCalledWith({
      surveyId: 3,
      status: undefined,
      limit: 50,
    });
  });

  it("keeps survey reminders admin-only", async () => {
    await expect(createCaller().studentSurveys.sendAssignmentReminder({ id: 7 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
  });

  it("allows admins to send manual reminders for active assignments", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      accessState: "survey_due",
    } as any);
    vi.mocked(db.sendStudentSurveyAssignmentReminder).mockResolvedValue({ id: 22 } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.sendAssignmentReminder({ id: 7 }))
      .resolves.toEqual({ success: true, notificationId: 22 });
    expect(db.sendStudentSurveyAssignmentReminder).toHaveBeenCalledWith({
      assignmentId: 7,
      actorUserId: 1,
    });
  });

  it("does not send reminders for submitted assignments", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      status: "submitted",
      accessState: "clear",
    } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.sendAssignmentReminder({ id: 7 }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
  });

  it("prevents postponement after the allowed count is used", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      postponementsUsed: 2,
      maxPostponements: 2,
    } as any);

    await expect(createCaller(9).studentSurveys.postpone({ id: 7 }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.postponeStudentSurveyAssignment).not.toHaveBeenCalled();
  });

  it("requires all required questions before submission", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue(activeAssignment as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "" }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.submitStudentSurveyAssignment).not.toHaveBeenCalled();
  });

  it("submits a student's own assignment", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue(activeAssignment as any);
    vi.mocked(db.submitStudentSurveyAssignment).mockResolvedValue({
      id: 7,
      status: "submitted",
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Helpful" }],
    })).resolves.toMatchObject({ id: 7, status: "submitted" });
    expect(db.submitStudentSurveyAssignment).toHaveBeenCalledWith({
      id: 7,
      userId: 9,
      answers: [{ questionId: 11, answerText: "Helpful" }],
    });
  });
});
