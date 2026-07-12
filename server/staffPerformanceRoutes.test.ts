import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    getUserRoles: vi.fn(),
    getUserById: vi.fn(),
    getStaffMembers: vi.fn(),
    logStaffAction: vi.fn(),
    listStaffPerformanceDailyLogs: vi.fn(),
    getStaffPerformanceDailyLog: vi.fn(),
    getStaffPerformanceDailyTask: vi.fn(),
    createStaffPerformanceDailyTask: vi.fn(),
    transitionStaffPerformanceDailyLog: vi.fn(),
    createStaffPerformanceWeeklyReport: vi.fn(),
    getStaffPerformanceWeeklyReport: vi.fn(),
    updateStaffPerformanceWeeklyReport: vi.fn(),
    transitionStaffPerformanceWeeklyReport: vi.fn(),
    getStaffPerformanceGoal: vi.fn(),
    getStaffPerformanceMonthlyPlan: vi.fn(),
    createStaffPerformanceMonthlyPlan: vi.fn(),
    updateStaffPerformanceMonthlyPlan: vi.fn(),
    transitionStaffPerformanceMonthlyPlan: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { getStaffLandingPage } from "../shared/const";

function createCaller(userId = 9) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/staffPerformance" },
    user: {
      id: userId,
      email: `staff${userId}@example.com`,
      passwordHash: "",
      name: "Staff",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: true,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("staff performance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminSetting).mockResolvedValue("true");
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_employee" },
    ] as any);
  });

  it("rejects every route while the feature flag is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().staffPerformance.featureInfo()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Staff performance management is disabled",
    });
    expect(db.getUserRoles).not.toHaveBeenCalled();
  });

  it("reports disabled availability without resolving roles", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().staffPerformance.availability()).resolves.toEqual({
      enabled: false,
      access: null,
    });
    expect(db.getAdminByEmail).not.toHaveBeenCalled();
    expect(db.getUserRoles).not.toHaveBeenCalled();
  });

  it("prevents an employee from reading another employee's records", async () => {
    await expect(createCaller(9).staffPerformance.listDailyLogs({
      staffUserId: 10,
      limit: 31,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listStaffPerformanceDailyLogs).not.toHaveBeenCalled();
  });

  it("lands performance employees on their daily work page", () => {
    expect(getStaffLandingPage(["staff_performance_employee"])).toBe("/admin/my-performance");
  });

  it("allows an employee to create a daily task linked to a goal from the same month", async () => {
    vi.mocked(db.getStaffPerformanceDailyLog).mockResolvedValue({
      id: 5,
      staffUserId: 9,
      localDate: "2026-07-09",
      status: "draft",
      version: 1,
      tasks: [],
    } as any);
    vi.mocked(db.getStaffPerformanceGoal).mockResolvedValue({
      id: 7,
      staffUserId: 9,
      planMonth: "2026-07",
    } as any);
    vi.mocked(db.createStaffPerformanceDailyTask).mockResolvedValue({ id: 11 } as any);

    await expect(createCaller(9).staffPerformance.createDailyTask({
      dailyLogId: 5,
      monthlyGoalId: 7,
      title: "Call students",
      expectedOutput: "Ten contacted students",
      completed: false,
      sortOrder: 0,
    })).resolves.toEqual({ id: 11 });
    expect(db.createStaffPerformanceDailyTask).toHaveBeenCalledWith(expect.objectContaining({
      dailyLogId: 5,
      monthlyGoalId: 7,
      staffUserId: 9,
      actorUserId: 9,
    }));
  });

  it("rejects daily submission until tasks and end-of-day summary are present", async () => {
    vi.mocked(db.getStaffPerformanceDailyLog).mockResolvedValue({
      id: 5,
      staffUserId: 9,
      localDate: "2026-07-09",
      status: "draft",
      version: 1,
      endSummary: "",
      tasks: [],
    } as any);

    await expect(createCaller(9).staffPerformance.transitionDailyLog({
      id: 5,
      version: 1,
      toStatus: "submitted",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.transitionStaffPerformanceDailyLog).not.toHaveBeenCalled();
  });

  it("validates weekly reports as Monday through Sunday", async () => {
    await expect(createCaller(9).staffPerformance.createWeeklyReport({
      weekStart: "2026-07-08",
      weekEnd: "2026-07-14",
      timezone: "Asia/Amman",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createStaffPerformanceWeeklyReport).not.toHaveBeenCalled();
  });

  it("rejects weekly submission until outputs and achievement percent are present", async () => {
    vi.mocked(db.getStaffPerformanceWeeklyReport).mockResolvedValue({
      id: 6,
      staffUserId: 9,
      weekStart: "2026-07-06",
      weekEnd: "2026-07-12",
      status: "draft",
      version: 1,
      outputs: "",
      achievementPercent: null,
    } as any);

    await expect(createCaller(9).staffPerformance.transitionWeeklyReport({
      id: 6,
      version: 1,
      toStatus: "submitted",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.transitionStaffPerformanceWeeklyReport).not.toHaveBeenCalled();
  });

  it("allows managers to return weekly reports with feedback", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getStaffPerformanceWeeklyReport).mockResolvedValue({
      id: 6,
      staffUserId: 10,
      weekStart: "2026-07-06",
      weekEnd: "2026-07-12",
      status: "submitted",
      version: 2,
      outputs: "Completed support review",
      achievementPercent: 85,
    } as any);
    vi.mocked(db.transitionStaffPerformanceWeeklyReport).mockResolvedValue({
      id: 6,
      status: "returned",
      version: 3,
    } as any);

    await expect(createCaller(9).staffPerformance.transitionWeeklyReport({
      id: 6,
      version: 2,
      toStatus: "returned",
      managerFeedback: "Clarify blockers before approval.",
    })).resolves.toMatchObject({ id: 6, status: "returned" });
    expect(db.transitionStaffPerformanceWeeklyReport).toHaveBeenCalledWith(expect.objectContaining({
      id: 6,
      fromStatus: "submitted",
      toStatus: "returned",
      managerFeedback: "Clarify blockers before approval.",
      actorUserId: 9,
      staffUserId: 10,
    }));
  });

  it("allows managers to return daily logs with feedback", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getStaffPerformanceDailyLog).mockResolvedValue({
      id: 5,
      staffUserId: 10,
      localDate: "2026-07-09",
      status: "submitted",
      version: 2,
      endSummary: "Finished planned outreach",
      tasks: [{ id: 1 }],
    } as any);
    vi.mocked(db.transitionStaffPerformanceDailyLog).mockResolvedValue({
      id: 5,
      status: "returned",
      version: 3,
    } as any);

    await expect(createCaller(9).staffPerformance.transitionDailyLog({
      id: 5,
      version: 2,
      toStatus: "returned",
      managerFeedback: "Add actual outputs to each task.",
    })).resolves.toMatchObject({ id: 5, status: "returned" });
    expect(db.transitionStaffPerformanceDailyLog).toHaveBeenCalledWith(expect.objectContaining({
      id: 5,
      fromStatus: "submitted",
      toStatus: "returned",
      managerFeedback: "Add actual outputs to each task.",
      actorUserId: 9,
      staffUserId: 10,
    }));
  });

  it("keeps monthly plan creation manager-only", async () => {
    await expect(createCaller().staffPerformance.createMonthlyPlan({
      staffUserId: 10,
      month: "2026-07",
      title: "July plan",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createStaffPerformanceMonthlyPlan).not.toHaveBeenCalled();
  });

  it("returns a minimal staff selector to performance managers", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getStaffMembers).mockResolvedValue([{
      id: 10,
      name: "Employee",
      email: "employee@example.com",
      phone: "private",
      roles: ["staff_performance_employee"],
    }] as any);

    await expect(createCaller().staffPerformance.listStaffOptions()).resolves.toEqual([{
      id: 10,
      name: "Employee",
      email: "employee@example.com",
      roles: ["staff_performance_employee"],
    }]);
  });

  it("maps duplicate period records to a conflict", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 10, isStaff: true } as any);
    vi.mocked(db.createStaffPerformanceMonthlyPlan)
      .mockRejectedValue(new Error("UNIQUE constraint failed"));

    await expect(createCaller().staffPerformance.createMonthlyPlan({
      staffUserId: 10,
      month: "2026-07",
      title: "July plan",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A performance record already exists for this period",
    });
  });

  it("rejects edits to locked records before reaching persistence", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getStaffPerformanceMonthlyPlan).mockResolvedValue({
      id: 1,
      staffUserId: 10,
      status: "locked",
      version: 3,
      goals: [],
    } as any);

    await expect(createCaller().staffPerformance.updateMonthlyPlan({
      id: 1,
      version: 3,
      title: "Changed title",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.updateStaffPerformanceMonthlyPlan).not.toHaveBeenCalled();
  });

  it("requires submitted monthly goals to total exactly 100 percent", async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([
      { role: "staff_performance_manager" },
    ] as any);
    vi.mocked(db.getStaffPerformanceMonthlyPlan).mockResolvedValue({
      id: 1,
      staffUserId: 10,
      status: "draft",
      version: 1,
      goals: [{ id: 1, weight: 70 }],
    } as any);

    await expect(createCaller().staffPerformance.transitionMonthlyPlan({
      id: 1,
      version: 1,
      toStatus: "submitted",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.transitionStaffPerformanceMonthlyPlan).not.toHaveBeenCalled();
  });
});
