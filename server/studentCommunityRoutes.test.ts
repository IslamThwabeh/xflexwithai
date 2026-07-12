import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    listStudentCommunityPosts: vi.fn(),
    getStudentCommunityPost: vi.fn(),
    createStudentCommunityPost: vi.fn(),
    createStudentCommunityComment: vi.fn(),
    reportStudentCommunityContent: vi.fn(),
    listStudentCommunityReportsForAdmin: vi.fn(),
    moderateStudentCommunityContent: vi.fn(),
    reviewStudentCommunityReport: vi.fn(),
    listStudentCommunityAuditLogs: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(userId = 9, email = `student${userId}@example.com`) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/community" },
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

describe("student community routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "student_community_enabled") return "true";
      return null;
    });
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
  });

  it("reports disabled availability", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().community.availability()).resolves.toEqual({ enabled: false });
  });

  it("blocks community actions while disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().community.listPosts({ limit: 20 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Student community is disabled",
    });
    expect(db.listStudentCommunityPosts).not.toHaveBeenCalled();
  });

  it("lists visible posts for students", async () => {
    vi.mocked(db.listStudentCommunityPosts).mockResolvedValue([
      { id: 1, title: "Question", status: "visible" },
    ] as any);

    await expect(createCaller().community.listPosts({ limit: 20 })).resolves.toEqual([
      { id: 1, title: "Question", status: "visible" },
    ]);
    expect(db.listStudentCommunityPosts).toHaveBeenCalledWith({ limit: 20 });
  });

  it("creates posts as the signed-in student", async () => {
    vi.mocked(db.createStudentCommunityPost).mockResolvedValue({ id: 1, userId: 9 } as any);

    await expect(createCaller().community.createPost({
      title: "How should I study risk?",
      body: "What should I focus on this week?",
    })).resolves.toEqual({ id: 1, userId: 9 });
    expect(db.createStudentCommunityPost).toHaveBeenCalledWith({
      userId: 9,
      title: "How should I study risk?",
      body: "What should I focus on this week?",
    });
  });

  it("maps duplicate reports to conflict", async () => {
    vi.mocked(db.reportStudentCommunityContent).mockResolvedValue({ status: "duplicate" } as any);

    await expect(createCaller().community.reportContent({
      targetType: "post",
      targetId: 1,
      reason: "spam",
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("keeps moderation limited to admins or community moderators", async () => {
    await expect(createCaller().community.moderateContent({
      targetType: "post",
      targetId: 1,
      action: "hide",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.moderateStudentCommunityContent).not.toHaveBeenCalled();
  });

  it("allows admins to moderate content", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.moderateStudentCommunityContent).mockResolvedValue({ id: 1, status: "hidden" } as any);

    await expect(createCaller(1, "admin@example.com").community.moderateContent({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
    })).resolves.toEqual({ id: 1, status: "hidden" });
    expect(db.moderateStudentCommunityContent).toHaveBeenCalledWith({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
      actorUserId: 1,
    });
  });

  it("allows community moderators to moderate content", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId: number, roles: string[]) =>
      roles.includes("student_community_moderator")
    );
    vi.mocked(db.moderateStudentCommunityContent).mockResolvedValue({ id: 1, status: "hidden" } as any);

    await expect(createCaller(44, "moderator@example.com").community.moderateContent({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
    })).resolves.toEqual({ id: 1, status: "hidden" });
    expect(db.moderateStudentCommunityContent).toHaveBeenCalledWith({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
      actorUserId: 44,
    });
  });

  it("allows admins to dismiss reports", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.reviewStudentCommunityReport).mockResolvedValue({ id: 4, status: "dismissed" } as any);

    await expect(createCaller(1, "admin@example.com").community.dismissReport({
      reportId: 4,
    })).resolves.toEqual({ id: 4, status: "dismissed" });
    expect(db.reviewStudentCommunityReport).toHaveBeenCalledWith({
      reportId: 4,
      action: "dismiss",
      actorUserId: 1,
      note: null,
    });
  });
});
