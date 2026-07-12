import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    getStudentJobProfile: vi.fn(),
    upsertStudentJobProfile: vi.fn(),
    getStudentJobOpportunities: vi.fn(),
    submitStudentJobEligibilityReview: vi.fn(),
    listStudentJobEligibilityRules: vi.fn(),
    upsertStudentJobEligibilityRule: vi.fn(),
    listStudentJobEligibilityReviews: vi.fn(),
    reviewStudentJobEligibility: vi.fn(),
    listStudentJobEligibilityAuditLogs: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(userId = 9, email = `student${userId}@example.com`) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/studentJobEligibility" },
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

describe("student job eligibility routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_job_eligibility_enabled") return "true";
      return null;
    });
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
  });

  it("reports disabled availability", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().studentJobEligibility.availability()).resolves.toEqual({ enabled: false });
  });

  it("blocks student actions while disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().studentJobEligibility.myOpportunities()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Student job eligibility is disabled",
    });
    expect(db.getStudentJobOpportunities).not.toHaveBeenCalled();
  });

  it("loads opportunities for the signed-in student", async () => {
    vi.mocked(db.getStudentJobOpportunities).mockResolvedValue({
      profile: null,
      metrics: { completedEpisodes: 2 },
      opportunities: [],
    } as any);

    await expect(createCaller(22).studentJobEligibility.myOpportunities()).resolves.toMatchObject({
      metrics: { completedEpisodes: 2 },
    });
    expect(db.getStudentJobOpportunities).toHaveBeenCalledWith(22);
  });

  it("updates the signed-in student's career profile", async () => {
    vi.mocked(db.upsertStudentJobProfile).mockResolvedValue({ id: 1, userId: 22 } as any);

    await expect(createCaller(22).studentJobEligibility.updateMyProfile({
      headline: "Junior trader",
      skills: "Risk, journaling",
      experienceSummary: "Completed several practice plans.",
      portfolioUrl: "",
      cvUrl: "",
    })).resolves.toEqual({ id: 1, userId: 22 });
    expect(db.upsertStudentJobProfile).toHaveBeenCalledWith({
      userId: 22,
      headline: "Junior trader",
      skills: "Risk, journaling",
      experienceSummary: "Completed several practice plans.",
      portfolioUrl: "",
      cvUrl: "",
    });
  });

  it("submits eligibility review as the signed-in student", async () => {
    vi.mocked(db.submitStudentJobEligibilityReview).mockResolvedValue({ id: 5, status: "submitted" } as any);

    await expect(createCaller(22).studentJobEligibility.submitReview({
      jobId: 3,
      studentNote: "I finished the basics.",
    })).resolves.toEqual({ id: 5, status: "submitted" });
    expect(db.submitStudentJobEligibilityReview).toHaveBeenCalledWith({
      userId: 22,
      jobId: 3,
      studentNote: "I finished the basics.",
    });
  });

  it("keeps rule management limited to admins or job eligibility managers", async () => {
    await expect(createCaller().studentJobEligibility.adminRules()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listStudentJobEligibilityRules).not.toHaveBeenCalled();
  });

  it("allows admins to update rules and review decisions", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.upsertStudentJobEligibilityRule).mockResolvedValue({ id: 1, jobId: 3 } as any);
    vi.mocked(db.reviewStudentJobEligibility).mockResolvedValue({ id: 8, status: "eligible" } as any);
    const caller = createCaller(1, "admin@example.com");

    await expect(caller.studentJobEligibility.adminUpsertRule({
      jobId: 3,
      minCompletedEpisodes: 10,
      minPassedQuizzes: 2,
      minPointsBalance: 100,
      requireActiveSubscription: true,
      requireProfile: true,
      requireAdminReview: true,
      isEnabled: true,
      instructions: "Finish the core path first.",
    })).resolves.toEqual({ id: 1, jobId: 3 });
    expect(db.upsertStudentJobEligibilityRule).toHaveBeenCalledWith({
      jobId: 3,
      minCompletedEpisodes: 10,
      minPassedQuizzes: 2,
      minPointsBalance: 100,
      requireActiveSubscription: true,
      requireProfile: true,
      requireAdminReview: true,
      isEnabled: true,
      instructions: "Finish the core path first.",
      actorUserId: 1,
    });

    await expect(caller.studentJobEligibility.adminReviewDecision({
      reviewId: 8,
      status: "eligible",
      adminNote: "Ready for interview.",
    })).resolves.toEqual({ id: 8, status: "eligible" });
    expect(db.reviewStudentJobEligibility).toHaveBeenCalledWith({
      reviewId: 8,
      status: "eligible",
      adminNote: "Ready for interview.",
      actorUserId: 1,
    });
  });

  it("allows job eligibility managers to update rules and review decisions", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId: number, roles: string[]) =>
      roles.includes("student_job_eligibility_manager")
    );
    vi.mocked(db.upsertStudentJobEligibilityRule).mockResolvedValue({ id: 1, jobId: 3 } as any);
    vi.mocked(db.reviewStudentJobEligibility).mockResolvedValue({ id: 8, status: "eligible" } as any);
    const caller = createCaller(55, "jobs-manager@example.com");

    await expect(caller.studentJobEligibility.adminUpsertRule({
      jobId: 3,
      minCompletedEpisodes: 10,
      minPassedQuizzes: 2,
      minPointsBalance: 100,
      requireActiveSubscription: true,
      requireProfile: true,
      requireAdminReview: true,
      isEnabled: true,
      instructions: "Finish the core path first.",
    })).resolves.toEqual({ id: 1, jobId: 3 });
    expect(db.upsertStudentJobEligibilityRule).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 3,
      actorUserId: 55,
    }));

    await expect(caller.studentJobEligibility.adminReviewDecision({
      reviewId: 8,
      status: "eligible",
      adminNote: "Ready for interview.",
    })).resolves.toEqual({ id: 8, status: "eligible" });
    expect(db.reviewStudentJobEligibility).toHaveBeenCalledWith({
      reviewId: 8,
      status: "eligible",
      adminNote: "Ready for interview.",
      actorUserId: 55,
    });
  });
});
