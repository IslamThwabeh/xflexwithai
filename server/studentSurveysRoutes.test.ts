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
    getStudentSurveyOutstandingSummaryForUser: vi.fn(),
    listStudentSurveyBlockingAssignmentsForUser: vi.fn(),
    createStudentSurvey: vi.fn(),
    updateStudentSurvey: vi.fn(),
    setStudentSurveyActive: vi.fn(),
    getStudentSurvey: vi.fn(),
    createStudentSurveyQuestion: vi.fn(),
    assignStudentSurvey: vi.fn(),
    assignStudentSurveyAudience: vi.fn(),
    materializeDueStudentSurveyNotifications: vi.fn(),
    getStudentsForNotification: vi.fn(),
    listStudentSurveyAssignedUserIds: vi.fn(),
    listStudentSurveyAssignmentsForAdmin: vi.fn(),
    getStudentSurveyAssignment: vi.fn(),
    sendStudentSurveyAssignmentReminder: vi.fn(),
    postponeStudentSurveyAssignment: vi.fn(),
    submitStudentSurveyAssignment: vi.fn(),
    listStudentSurveyAuditLogs: vi.fn(),
    notifyStaffByEvent: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const futureSurveyDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const futureSurveyBlockAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

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
  surveyIsActive: true,
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
    vi.mocked(db.getStudentSurveyOutstandingSummaryForUser).mockResolvedValue({
      outstandingCount: 0,
      nearestDueAt: null,
    });
    vi.mocked(db.listStudentSurveyBlockingAssignmentsForUser).mockResolvedValue([]);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([]);
    vi.mocked(db.listStudentSurveyAssignedUserIds).mockResolvedValue([]);
    vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined as any);
    vi.mocked(db.materializeDueStudentSurveyNotifications).mockResolvedValue({
      processed: 0,
      dashboardCreated: 0,
      emailsQueued: 0,
    });
  });

  it("rejects ordinary students from survey data routes while delivery is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "false";
      return null;
    });

    await expect(createCaller().studentSurveys.featureInfo()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Student surveys are disabled",
    });
    expect(db.getAdminByEmail).toHaveBeenCalledWith("student9@example.com");
  });

  it("reports disabled availability without exposing student access", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) =>
      key === "student_surveys_enabled" ? "false" : null
    );

    await expect(createCaller().studentSurveys.availability()).resolves.toEqual({
      enabled: false,
      blockingEnabled: false,
      access: null,
      accessState: "clear",
      outstandingCount: 0,
      nearestDueAt: null,
    });
    expect(db.getAdminByEmail).toHaveBeenCalledWith("student9@example.com");
  });

  it("keeps the full no-notification setup workspace open to admins before launch", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "false";
      if (key === "student_surveys_blocking_enabled") return "true";
      return null;
    });
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.createStudentSurvey).mockResolvedValue({ id: 3, code: "pilot-checkin" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({
      id: 3,
      title: "Pilot check-in",
      isActive: true,
      questions: [{ id: 11, questionText: "How was it?" }],
    } as any);
    vi.mocked(db.createStudentSurveyQuestion).mockResolvedValue({ id: 11 } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Pilot Student", email: "pilot@example.com", hasActivePackage: true },
    ]);
    vi.mocked(db.assignStudentSurveyAudience).mockResolvedValue({
      assignments: [{ id: 70, userId: 10 }],
      duplicateUserIds: [],
      capacityExceeded: false,
    } as any);
    vi.mocked(db.listStudentSurveyAssignmentsForAdmin).mockResolvedValue([
      { id: 70, surveyId: 3, userId: 10, status: "pending" },
    ] as any);
    vi.mocked(db.listStudentSurveyAuditLogs).mockResolvedValue([
      { id: 90, entityType: "survey", entityId: 3, action: "created" },
    ] as any);

    const caller = createCaller(1, "admin@example.com").studentSurveys;
    await expect(caller.availability()).resolves.toMatchObject({
      enabled: false,
      blockingEnabled: true,
      access: "admin",
    });
    await expect(caller.featureInfo()).resolves.toEqual({ enabled: false, access: "admin" });
    await expect(caller.createSurvey({
      code: "pilot-checkin",
      title: "Pilot check-in",
      isActive: false,
    })).resolves.toMatchObject({ id: 3 });
    await expect(caller.createQuestion({
      surveyId: 3,
      questionText: "How was it?",
      questionType: "short_text",
    })).resolves.toMatchObject({ id: 11 });
    const audiencePreview = await caller.previewAudience({
      surveyId: 3,
      audience: { mode: "single", userIds: [10] },
    });
    expect(audiencePreview).toMatchObject({ recipientCount: 1 });
    expect(audiencePreview).not.toHaveProperty("notificationsSent");
    await expect(caller.assignAudience({
      surveyId: 3,
      audience: { mode: "single", userIds: [10] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [10],
      expectedMatchedStudentIds: [10],
      confirmed: true,
    })).resolves.toMatchObject({ assignedCount: 1, notificationsSent: 0 });
    await expect(caller.listAssignments({ surveyId: 3, limit: 500 }))
      .resolves.toHaveLength(1);
    await expect(caller.auditLog({ entityType: "survey", entityId: 3, limit: 50 }))
      .resolves.toHaveLength(1);
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("summarizes blocked assignment state in availability", async () => {
    vi.mocked(db.listStudentSurveyBlockingAssignmentsForUser).mockResolvedValue([
      {
        status: "pending",
        dueAt: "2020-07-10T10:00:00.000Z",
        blockAt: "2020-07-12T10:00:00.000Z",
        surveyIsActive: true,
        surveyIsRequired: true,
      },
    ] as any);

    await expect(createCaller().studentSurveys.availability()).resolves.toMatchObject({
      enabled: true,
      blockingEnabled: false,
      access: "student",
      accessState: "blocked",
    });
    expect(db.listStudentSurveyBlockingAssignmentsForUser).toHaveBeenCalledWith(9);
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

  it("accepts Arabic survey content with an API-safe automatic reference", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.createStudentSurvey).mockResolvedValue({
      id: 4,
      code: "survey-msm0m1og-abcd1234",
      title: "استبيان رضا الطلاب",
    } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createSurvey({
      code: "survey-msm0m1og-abcd1234",
      title: "استبيان رضا الطلاب",
      description: "نرجو مشاركة رأيك حول تجربتك التعليمية.",
      isActive: false,
    })).resolves.toMatchObject({ id: 4, title: "استبيان رضا الطلاب" });
    expect(db.createStudentSurvey).toHaveBeenCalledWith(expect.objectContaining({
      code: "survey-msm0m1og-abcd1234",
      title: "استبيان رضا الطلاب",
      description: "نرجو مشاركة رأيك حول تجربتك التعليمية.",
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
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [] } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createQuestion({
      surveyId: 3,
      questionText: "Pick one",
      questionType: "single_choice",
      options: ["Only one"],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createStudentSurveyQuestion).not.toHaveBeenCalled();
  });

  it("rejects duplicate choice options", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [] } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createQuestion({
      surveyId: 3,
      questionText: "Pick one",
      questionType: "multiple_choice",
      options: ["Yes", " yes "],
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Choice options must be unique",
    });
    expect(db.createStudentSurveyQuestion).not.toHaveBeenCalled();
  });

  it("normalizes valid choice options before saving", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [] } as any);
    vi.mocked(db.createStudentSurveyQuestion).mockResolvedValue({ id: 12 } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createQuestion({
      surveyId: 3,
      questionText: "Pick one",
      questionType: "multiple_choice",
      options: ["  Yes ", "No  "],
    })).resolves.toMatchObject({ id: 12 });
    expect(db.createStudentSurveyQuestion).toHaveBeenCalledWith(expect.objectContaining({
      optionsJson: JSON.stringify(["Yes", "No"]),
    }));
  });

  it("retires direct assignment so admins must confirm an audience preview", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.assignSurvey({
      surveyId: 3,
      userId: 9,
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Preview the student audience and use the confirmed distribution workflow",
    });
    expect(db.assignStudentSurvey).not.toHaveBeenCalled();
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
      limit: 500,
    })).resolves.toEqual([
      { id: 7, surveyId: 3, userId: 9, status: "submitted", studentEmail: "student@example.com" },
    ]);
    expect(db.listStudentSurveyAssignmentsForAdmin).toHaveBeenCalledWith({
      surveyId: 3,
      status: undefined,
      limit: 500,
    });
  });

  it("keeps audience previews limited to survey administrators", async () => {
    await expect(createCaller().studentSurveys.previewAudience({
      surveyId: 3,
      audience: { mode: "all", userIds: [] },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getStudentsForNotification).not.toHaveBeenCalled();
  });

  it("previews filtered recipients and separates existing assignments", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [{ id: 1 }] } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Active One", email: "one@example.com", hasActivePackage: true },
      { id: 11, name: "Inactive", email: "inactive@example.com", hasActivePackage: false },
      { id: 12, name: "Active Existing", email: "existing@example.com", hasActivePackage: true },
    ]);
    vi.mocked(db.listStudentSurveyAssignedUserIds).mockResolvedValue([12]);

    await expect(createCaller(1, "admin@example.com").studentSurveys.previewAudience({
      surveyId: 3,
      audience: { mode: "active_package", userIds: [] },
    })).resolves.toMatchObject({
      matchedCount: 2,
      recipientCount: 1,
      alreadyAssignedCount: 1,
      invalidRequestedCount: 0,
      exceedsSafeLimit: false,
      exceedsBatchLimit: false,
      exceedsTotalLimit: false,
      currentAssignmentCount: 1,
      remainingAssignmentCapacity: 499,
      maxBatchRecipients: 20,
      maxAssignmentsPerSurvey: 500,
      snapshotStudentIds: [10, 12],
      recipientIds: [10],
      students: [
        expect.objectContaining({ id: 10, alreadyAssigned: false }),
        expect.objectContaining({ id: 12, alreadyAssigned: true }),
      ],
    });
  });

  it("rejects a bulk confirmation when the recipient preview changed", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [{ id: 1 }] } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Student", email: "student@example.com", hasActivePackage: true },
    ]);

    await expect(createCaller(1, "admin@example.com").studentSurveys.assignAudience({
      surveyId: 3,
      audience: { mode: "single", userIds: [10] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [12],
      expectedMatchedStudentIds: [10],
      confirmed: true,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.assignStudentSurvey).not.toHaveBeenCalled();
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("rejects confirmation when the matched audience grows after preview", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [{ id: 1 }] } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Original", email: "original@example.com", hasActivePackage: true },
      { id: 11, name: "New match", email: "new@example.com", hasActivePackage: true },
    ]);

    await expect(createCaller(1, "admin@example.com").studentSurveys.assignAudience({
      surveyId: 3,
      audience: { mode: "active_package", userIds: [] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [10],
      expectedMatchedStudentIds: [10],
      confirmed: true,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.assignStudentSurveyAudience).not.toHaveBeenCalled();
  });

  it("assigns a confirmed selected audience idempotently and schedules exact recipients", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [{ id: 1 }] } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "One", email: "one@example.com", hasActivePackage: true },
      { id: 11, name: "Two", email: "two@example.com", hasActivePackage: false },
    ]);
    vi.mocked(db.assignStudentSurveyAudience).mockResolvedValue({
      assignments: [{ id: 70, userId: 10 }],
      duplicateUserIds: [11],
      capacityExceeded: false,
    } as any);

    vi.mocked(db.materializeDueStudentSurveyNotifications).mockResolvedValue({
      processed: 1,
      dashboardCreated: 1,
      emailsQueued: 1,
    });
    await expect(createCaller(1, "admin@example.com").studentSurveys.assignAudience({
      surveyId: 3,
      audience: { mode: "selected", userIds: [10, 11, 10] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [11, 10],
      expectedMatchedStudentIds: [10, 11],
      confirmed: true,
    })).resolves.toEqual({
      success: true,
      assignedCount: 1,
      alreadyAssignedCount: 1,
      replayedAssignmentCount: 0,
      matchedCount: 2,
      notificationsSent: 1,
      emailsQueued: 1,
    });
    expect(db.materializeDueStudentSurveyNotifications).toHaveBeenCalledWith({
      assignmentIds: [70],
      limit: 1,
    });
    expect(db.assignStudentSurveyAudience).toHaveBeenCalledWith({
      surveyId: 3,
      userIds: [10, 11],
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      actorUserId: 1,
    });
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("treats an already assigned audience as a successful no-op", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({ id: 3, isActive: true, questions: [{ id: 1 }] } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Student", email: "student@example.com", hasActivePackage: true },
    ]);
    vi.mocked(db.listStudentSurveyAssignedUserIds).mockResolvedValue([10]);

    await expect(createCaller(1, "admin@example.com").studentSurveys.assignAudience({
      surveyId: 3,
      audience: { mode: "single", userIds: [10] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [10],
      expectedMatchedStudentIds: [10],
      confirmed: true,
    })).resolves.toMatchObject({
      success: true,
      assignedCount: 0,
      alreadyAssignedCount: 1,
      replayedAssignmentCount: 1,
      notificationsSent: 0,
    });
    expect(db.assignStudentSurveyAudience).not.toHaveBeenCalled();
  });

  it("keeps survey reminders admin-only", async () => {
    await expect(createCaller().studentSurveys.sendAssignmentReminder({ id: 7 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.sendStudentSurveyAssignmentReminder).not.toHaveBeenCalled();
  });

  it("prohibits real student reminders while delivery is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) =>
      key === "student_surveys_enabled" ? "false" : null
    );
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);

    await expect(
      createCaller(1, "admin@example.com").studentSurveys.sendAssignmentReminder({ id: 7 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Enable Student Surveys before sending a reminder",
    });
    expect(db.getStudentSurveyAssignment).not.toHaveBeenCalled();
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

  it("allows a reminder after the final deadline because the survey remains submit-able", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      accessState: "blocked",
    } as any);
    vi.mocked(db.sendStudentSurveyAssignmentReminder).mockResolvedValue({ id: 23 } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.sendAssignmentReminder({ id: 7 }))
      .resolves.toEqual({ success: true, notificationId: 23 });
  });

  it("reports a clean conflict when submission wins a reminder race", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue(activeAssignment as any);
    vi.mocked(db.sendStudentSurveyAssignmentReminder).mockRejectedValue(
      new Error("STUDENT_SURVEY_REMINDER_CONFLICT"),
    );

    await expect(createCaller(1, "admin@example.com").studentSurveys.sendAssignmentReminder({ id: 7 }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: "The survey was submitted before the reminder could be sent",
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
      assignment: { id: 7, status: "submitted" },
      submittedNow: true,
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Helpful" }],
    })).resolves.toMatchObject({ id: 7, status: "submitted" });
    expect(db.submitStudentSurveyAssignment).toHaveBeenCalledWith({
      id: 7,
      userId: 9,
      answers: [{ questionId: 11, answerText: "Helpful", answerJson: null }],
    });
    expect(db.notifyStaffByEvent).toHaveBeenCalledOnce();
  });

  it("treats a lost successful submission response as an idempotent retry", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      status: "submitted",
      accessState: "clear",
      answers: [{ questionId: 11, answerText: "Helpful", answerJson: null }],
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Helpful" }],
    })).resolves.toMatchObject({ id: 7, status: "submitted" });
    expect(db.submitStudentSurveyAssignment).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("rejects a retry that would change already-submitted answers", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      status: "submitted",
      accessState: "clear",
      answers: [{ questionId: 11, answerText: "Original", answerJson: null }],
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Changed" }],
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This survey was already submitted with different answers",
    });
    expect(db.submitStudentSurveyAssignment).not.toHaveBeenCalled();
  });

  it("does not duplicate staff notifications when a concurrent retry already committed", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue(activeAssignment as any);
    vi.mocked(db.submitStudentSurveyAssignment).mockResolvedValue({
      assignment: { id: 7, status: "submitted" },
      submittedNow: false,
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Helpful" }],
    })).resolves.toMatchObject({ id: 7, status: "submitted" });
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("allows an overdue required survey to be submitted while access protection is enabled", async () => {
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_surveys_enabled") return "true";
      if (key === "student_surveys_blocking_enabled") return "true";
      return null;
    });
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      dueAt: "2020-07-10T10:00:00.000Z",
      blockAt: "2020-07-12T10:00:00.000Z",
      surveyIsActive: true,
      surveyIsRequired: true,
      accessState: "blocked",
    } as any);
    vi.mocked(db.submitStudentSurveyAssignment).mockResolvedValue({
      assignment: { id: 7, status: "submitted" },
      submittedNow: true,
    } as any);

    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Completed after deadline" }],
    })).resolves.toMatchObject({ id: 7, status: "submitted" });
    expect(db.submitStudentSurveyAssignment).toHaveBeenCalledOnce();
  });

  it("always creates a draft and rejects create-time activation", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.createSurvey({
      code: "unsafe-live-create",
      title: "Unsafe live create",
      isActive: true,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createStudentSurvey).not.toHaveBeenCalled();
  });

  it("updates draft settings without changing activation state", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.updateStudentSurvey).mockResolvedValue({ id: 3, title: "Updated" } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.updateSurvey({
      id: 3,
      title: "Updated",
      description: null,
      maxPostponements: 0,
    })).resolves.toMatchObject({ id: 3, title: "Updated" });
    expect(db.updateStudentSurvey).toHaveBeenCalledWith({
      id: 3,
      title: "Updated",
      description: null,
      maxPostponements: 0,
      actorUserId: 1,
    });
  });

  it("requires a question before activation and then activates explicitly", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValueOnce({
      id: 3,
      isActive: false,
      questions: [],
    } as any).mockResolvedValueOnce({
      id: 3,
      isActive: false,
      questions: [{ id: 11 }],
    } as any);
    vi.mocked(db.setStudentSurveyActive).mockResolvedValue({ id: 3, isActive: true } as any);

    await expect(createCaller(1, "admin@example.com").studentSurveys.setSurveyActive({
      id: 3,
      isActive: true,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(createCaller(1, "admin@example.com").studentSurveys.setSurveyActive({
      id: 3,
      isActive: true,
    })).resolves.toMatchObject({ isActive: true });
    expect(db.setStudentSurveyActive).toHaveBeenCalledOnce();
  });

  it("blocks distribution while a survey is still a draft", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentSurvey).mockResolvedValue({
      id: 3,
      isActive: false,
      questions: [{ id: 11 }],
    } as any);
    vi.mocked(db.getStudentsForNotification).mockResolvedValue([
      { id: 10, name: "Pilot", email: "pilot@example.com", hasActivePackage: true },
    ]);

    await expect(createCaller(1, "admin@example.com").studentSurveys.assignAudience({
      surveyId: 3,
      audience: { mode: "single", userIds: [10] },
      dueAt: futureSurveyDueAt,
      blockAt: futureSurveyBlockAt,
      expectedRecipientIds: [10],
      expectedMatchedStudentIds: [10],
      confirmed: true,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Activate this survey before distributing it",
    });
    expect(db.assignStudentSurveyAudience).not.toHaveBeenCalled();
  });

  it("hides an inactive assignment from its student but keeps admin review available", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      surveyIsActive: false,
    } as any);

    await expect(createCaller(9).studentSurveys.getMyAssignment({ id: 7 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    await expect(createCaller(1, "admin@example.com").studentSurveys.getMyAssignment({ id: 7 }))
      .resolves.toMatchObject({ id: 7, surveyIsActive: false });
  });

  it("prevents postpone and submit after deactivation", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      surveyIsActive: false,
    } as any);

    await expect(createCaller(9).studentSurveys.postpone({ id: 7 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [{ questionId: 11, answerText: "Hidden" }],
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.postponeStudentSurveyAssignment).not.toHaveBeenCalled();
    expect(db.submitStudentSurveyAssignment).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown question", [{ id: 11, isRequired: false, questionType: "short_text", optionsJson: null }], [{ questionId: 99, answerText: "x" }]],
    ["duplicate question", [{ id: 11, isRequired: true, questionType: "short_text", optionsJson: null }], [{ questionId: 11, answerText: "x" }, { questionId: 11, answerText: "x" }]],
    ["text JSON bypass", [{ id: 11, isRequired: true, questionType: "short_text", optionsJson: null }], [{ questionId: 11, answerJson: '"bypass"' }]],
    ["single-choice list bypass", [{ id: 11, isRequired: true, questionType: "single_choice", optionsJson: '["A","B"]' }], [{ questionId: 11, answerJson: '["A"]' }]],
    ["unknown single choice", [{ id: 11, isRequired: true, questionType: "single_choice", optionsJson: '["A","B"]' }], [{ questionId: 11, answerText: "C" }]],
    ["invalid multiple-choice JSON", [{ id: 11, isRequired: true, questionType: "multiple_choice", optionsJson: '["A","B"]' }], [{ questionId: 11, answerJson: "not-json" }]],
    ["duplicate multiple choices", [{ id: 11, isRequired: true, questionType: "multiple_choice", optionsJson: '["A","B"]' }], [{ questionId: 11, answerJson: '["A","A"]' }]],
    ["unknown multiple choice", [{ id: 11, isRequired: true, questionType: "multiple_choice", optionsJson: '["A","B"]' }], [{ questionId: 11, answerJson: '["C"]' }]],
    ["rating JSON bypass", [{ id: 11, isRequired: true, questionType: "rating", optionsJson: null }], [{ questionId: 11, answerJson: "5" }]],
    ["out-of-range rating", [{ id: 11, isRequired: true, questionType: "rating", optionsJson: null }], [{ questionId: 11, answerText: "6" }]],
  ])("rejects %s submissions", async (_label, questions, answers) => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      questions,
    } as any);

    await expect(createCaller(9).studentSurveys.submit({ id: 7, answers } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.submitStudentSurveyAssignment).not.toHaveBeenCalled();
  });

  it("accepts no answers when every question is optional", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      questions: [{ id: 11, isRequired: false, questionType: "short_text", optionsJson: null }],
    } as any);
    vi.mocked(db.submitStudentSurveyAssignment).mockResolvedValue({
      assignment: { id: 7, status: "submitted" },
      submittedNow: true,
    } as any);

    await expect(createCaller(9).studentSurveys.submit({ id: 7, answers: [] }))
      .resolves.toMatchObject({ status: "submitted" });
    expect(db.submitStudentSurveyAssignment).toHaveBeenCalledWith({
      id: 7,
      userId: 9,
      answers: [],
    });
  });

  it("normalizes valid answers before persistence and idempotency", async () => {
    vi.mocked(db.getStudentSurveyAssignment).mockResolvedValue({
      ...activeAssignment,
      questions: [
        { id: 11, isRequired: true, questionType: "short_text", optionsJson: null },
        { id: 12, isRequired: true, questionType: "multiple_choice", optionsJson: '["A","B"]' },
        { id: 13, isRequired: true, questionType: "rating", optionsJson: null },
      ],
    } as any);
    vi.mocked(db.submitStudentSurveyAssignment).mockResolvedValue({
      assignment: { id: 7, status: "submitted" },
      submittedNow: true,
    } as any);

    await createCaller(9).studentSurveys.submit({
      id: 7,
      answers: [
        { questionId: 13, answerText: "5" },
        { questionId: 12, answerJson: '["B","A"]' },
        { questionId: 11, answerText: "  Helpful  " },
      ],
    });
    expect(db.submitStudentSurveyAssignment).toHaveBeenCalledWith({
      id: 7,
      userId: 9,
      answers: [
        { questionId: 11, answerText: "Helpful", answerJson: null },
        { questionId: 12, answerText: null, answerJson: '["B","A"]' },
        { questionId: 13, answerText: "5", answerJson: null },
      ],
    });
  });
});
