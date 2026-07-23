import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/services/student-community-moderation.service", async () => {
  const actual = await vi.importActual<
    typeof import("../backend/services/student-community-moderation.service")
  >("../backend/services/student-community-moderation.service");
  return {
    ...actual,
    hashStudentCommunityContent: vi.fn(),
    moderateStudentCommunitySubmission: vi.fn(),
  };
});

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getUserById: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    getStudentCommunityAccess: vi.fn(),
    listStudentCommunityPosts: vi.fn(),
    getStudentCommunityPost: vi.fn(),
    createStudentCommunityPost: vi.fn(),
    createStudentCommunityComment: vi.fn(),
    reportStudentCommunityContent: vi.fn(),
    listStudentCommunityReportsForAdmin: vi.fn(),
    getStudentCommunityContentNotificationContext: vi.fn(),
    listOpenStudentCommunityReportNotificationContexts: vi.fn(),
    getStudentCommunityReportNotificationContext: vi.fn(),
    moderateStudentCommunityContent: vi.fn(),
    reviewStudentCommunityReport: vi.fn(),
    listStudentCommunityAuditLogs: vi.fn(),
    listStudentCommunityMembers: vi.fn(),
    banStudentCommunityMember: vi.fn(),
    restoreStudentCommunityMember: vi.fn(),
    listStudentCommunityAccessAuditLogs: vi.fn(),
    listStudentCommunityPolicyTerms: vi.fn(),
    addStudentCommunityPolicyTerm: vi.fn(),
    setStudentCommunityPolicyTermActive: vi.fn(),
    recordStudentCommunityModerationDecision: vi.fn(),
    countRecentStudentCommunityBlockedDecisions: vi.fn(),
    attachStudentCommunityModerationDecision: vi.fn(),
    listStudentCommunityModerationDecisions: vi.fn(),
    notifyStaffByEvent: vi.fn(),
    createNotification: vi.fn(),
    enqueueEmailOutbox: vi.fn(),
    setAdminSetting: vi.fn(),
    logAdminAction: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import * as communityModeration from "../backend/services/student-community-moderation.service";

function createCaller(
  userId = 9,
  email = `student${userId}@example.com`,
  requestHeader: string | null = "web",
) {
  return appRouter.createCaller({
    req: {
      headers: requestHeader ? { "x-xflex-request": requestHeader } : {},
      method: "POST",
      path: "/api/trpc/community",
    },
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
    vi.mocked(db.getStudentCommunityAccess).mockResolvedValue({
      access: "allowed",
      reason: null,
      expiresAt: null,
    });
    vi.mocked(db.listStudentCommunityPolicyTerms).mockResolvedValue([]);
    vi.mocked(db.recordStudentCommunityModerationDecision).mockResolvedValue({ id: 71 } as any);
    vi.mocked(db.countRecentStudentCommunityBlockedDecisions).mockResolvedValue(1);
    vi.mocked(db.attachStudentCommunityModerationDecision).mockResolvedValue(undefined);
    vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined);
    vi.mocked(db.createNotification).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.enqueueEmailOutbox).mockResolvedValue(true);
    vi.mocked(db.getStudentCommunityContentNotificationContext).mockResolvedValue(null);
    vi.mocked(db.listOpenStudentCommunityReportNotificationContexts).mockResolvedValue([]);
    vi.mocked(db.getStudentCommunityReportNotificationContext).mockResolvedValue(null);
    vi.mocked(communityModeration.hashStudentCommunityContent).mockResolvedValue("content-hash");
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "allowed",
      reasonCode: "approved",
      model: "omni-moderation-latest",
      requestId: "modr-test",
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: null,
      durationMs: 10,
    });
  });

  it("reports disabled availability", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().community.availability()).resolves.toEqual({
      enabled: false,
      access: "allowed",
      reason: null,
      expiresAt: null,
    });
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
      {
        id: 1,
        userId: 9,
        title: "Question",
        status: "visible",
        authorName: "Student",
        authorEmail: "private@example.com",
      },
    ] as any);

    await expect(createCaller().community.listPosts({ limit: 20 })).resolves.toEqual([
      {
        id: 1,
        userId: 9,
        title: "Question",
        status: "visible",
        authorName: "Student",
      },
    ]);
    expect(db.listStudentCommunityPosts).toHaveBeenCalledWith({ limit: 20 });
  });

  it("blocks suspended members from reading or writing community content", async () => {
    vi.mocked(db.getStudentCommunityAccess).mockResolvedValue({
      access: "banned",
      reason: "Repeated abuse",
      expiresAt: null,
    });

    await expect(createCaller().community.listPosts({ limit: 20 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Student community access is suspended",
    });
    await expect(createCaller().community.createPost({
      title: "Blocked post",
      body: "This must never reach the database.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listStudentCommunityPosts).not.toHaveBeenCalled();
    expect(db.createStudentCommunityPost).not.toHaveBeenCalled();
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
    expect(db.attachStudentCommunityModerationDecision).toHaveBeenCalledWith({
      decisionId: 71,
      entityId: 1,
    });
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_post_created",
      expect.objectContaining({
        actionUrl: "/admin/community?postId=1",
        metadata: {
          userId: 9,
          contentType: "post",
          postId: 1,
        },
      }),
    );
  });

  it("emails community moderators when an approved comment is created", async () => {
    vi.mocked(db.createStudentCommunityComment).mockResolvedValue({
      id: 12,
      postId: 5,
      userId: 9,
    } as any);

    await expect(createCaller().community.createComment({
      postId: 5,
      body: "A respectful learning comment.",
    })).resolves.toMatchObject({ id: 12, postId: 5, userId: 9 });
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_comment_created",
      expect.objectContaining({
        actionUrl: "/admin/community?postId=5",
        metadata: {
          userId: 9,
          contentType: "comment",
          postId: 5,
          commentId: 12,
        },
      }),
    );
  });

  it("queues a transactional email for a post owner when another student comments", async () => {
    vi.mocked(db.createStudentCommunityComment).mockResolvedValue({
      id: 12,
      postId: 5,
      userId: 9,
    } as any);
    vi.mocked(db.getStudentCommunityPost).mockResolvedValue({
      id: 5,
      userId: 22,
      authorName: "Post Owner",
      authorEmail: "owner@example.com",
    } as any);

    await createCaller().community.createComment({
      postId: 5,
      body: "A respectful learning comment.",
    });

    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 22,
      actionUrl: "/community?postId=5",
    }));
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "community_reply:12:22",
      recipientUserId: 22,
      recipientEmail: "owner@example.com",
      eventType: "community_client_reply",
      emailCategory: "transactional",
      metadata: {
        postId: 5,
        commentId: 12,
        commenterUserId: 9,
      },
    }));
  });

  it("does not email a student for commenting on their own post", async () => {
    vi.mocked(db.createStudentCommunityComment).mockResolvedValue({
      id: 12,
      postId: 5,
      userId: 9,
    } as any);
    vi.mocked(db.getStudentCommunityPost).mockResolvedValue({
      id: 5,
      userId: 9,
      authorName: "Student",
      authorEmail: "student9@example.com",
    } as any);

    await createCaller().community.createComment({
      postId: 5,
      body: "An additional detail on my own post.",
    });

    expect(db.enqueueEmailOutbox).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "community_client_reply" }),
    );
  });

  it("blocks competitor references before content reaches the community tables", async () => {
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "blocked_policy",
      reasonCode: "competitor_reference",
      model: null,
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: 4,
      durationMs: 1,
    });

    await expect(createCaller().community.createPost({
      title: "Competitor reference",
      body: "This must be blocked before publishing.",
    })).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
    });
    expect(db.recordStudentCommunityModerationDecision).toHaveBeenCalled();
    expect(db.createStudentCommunityPost).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_content_blocked",
      expect.objectContaining({
        contentEn: expect.not.stringContaining("This must be blocked"),
        metadata: expect.objectContaining({
          userId: 9,
          contentType: "post",
          reasonCode: "competitor_reference",
          recentViolationCount: 1,
        }),
      }),
    );
  });

  it("returns a specific rejection for prohibited language", async () => {
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "blocked_policy",
      reasonCode: "prohibited_language",
      model: null,
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: 8,
      durationMs: 1,
    });

    await expect(createCaller().community.createComment({
      postId: 1,
      body: "A locally blocked QA phrase",
    })).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      message: expect.stringContaining("prohibited language"),
    });
    expect(db.createStudentCommunityComment).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_content_blocked",
      expect.objectContaining({
        metadata: expect.objectContaining({
          reasonCode: "prohibited_language",
        }),
      }),
    );
  });

  it("sends an immediate high-risk alert without copying rejected text", async () => {
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "blocked_openai",
      reasonCode: "openai_flagged",
      model: "omni-moderation-latest",
      requestId: "modr-high-risk",
      flaggedCategories: ["violence"],
      categoryScores: { violence: 0.99 },
      matchedPolicyTermId: null,
      durationMs: 10,
    });

    await expect(createCaller().community.createPost({
      title: "Rejected title",
      body: "Sensitive rejected QA text that must never enter an email.",
    })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" });
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_high_risk_violation",
      expect.objectContaining({
        contentEn: expect.not.stringContaining("Sensitive rejected QA text"),
        metadata: expect.objectContaining({
          highRisk: true,
          flaggedCategories: ["violence"],
        }),
      }),
    );
  });

  it("escalates repeated blocked attempts within the safety window", async () => {
    vi.mocked(db.countRecentStudentCommunityBlockedDecisions).mockResolvedValue(3);
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "blocked_policy",
      reasonCode: "prohibited_language",
      model: null,
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: 8,
      durationMs: 1,
    });

    await expect(createCaller().community.createComment({
      postId: 1,
      body: "Repeated rejected QA text.",
    })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" });
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_repeat_violation",
      expect.objectContaining({
        metadata: expect.objectContaining({
          recentViolationCount: 3,
          highRisk: false,
        }),
      }),
    );
  });

  it("fails closed when OpenAI moderation is unavailable", async () => {
    vi.mocked(communityModeration.moderateStudentCommunitySubmission).mockResolvedValue({
      outcome: "error",
      reasonCode: "openai_unavailable",
      model: "omni-moderation-latest",
      requestId: null,
      flaggedCategories: [],
      categoryScores: {},
      matchedPolicyTermId: null,
      durationMs: 10_000,
    });

    await expect(createCaller().community.createComment({
      postId: 1,
      body: "Do not publish without a moderation decision.",
    })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(db.createStudentCommunityComment).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_moderation_failure",
      expect.objectContaining({
        actionUrl: "/admin/community?tab=safety",
        contentEn: expect.not.stringContaining(
          "Do not publish without a moderation decision.",
        ),
      }),
    );
  });

  it("rejects community mutations without the trusted request header", async () => {
    await expect(createCaller(9, "student9@example.com", null).community.createPost({
      title: "Untrusted request",
      body: "This request must not reach the database.",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Trusted community request header is required",
    });
    expect(db.createStudentCommunityPost).not.toHaveBeenCalled();
  });

  it("emails moderators when a student report is created", async () => {
    vi.mocked(db.reportStudentCommunityContent).mockResolvedValue({
      status: "created",
      report: { id: 14 },
    } as any);

    await expect(createCaller().community.reportContent({
      targetType: "post",
      targetId: 5,
      reason: "spam",
    })).resolves.toEqual({ id: 14 });
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "community_content_reported",
      expect.objectContaining({
        actionUrl: "/admin/community?reportId=14",
        metadata: {
          userId: 9,
          targetType: "post",
          targetId: 5,
          reportId: 14,
        },
      }),
    );
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

  it("keeps member suspension limited to admins or community moderators", async () => {
    await expect(createCaller().community.banMember({
      userId: 17,
      reason: "Repeated abusive posts",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.banStudentCommunityMember).not.toHaveBeenCalled();
  });

  it("allows admins to manage members while the community flag is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.listStudentCommunityMembers).mockResolvedValue({
      items: [],
      total: 0,
    });
    vi.mocked(db.banStudentCommunityMember).mockResolvedValue({
      access: "banned",
      reason: "Repeated abusive posts",
      expiresAt: null,
      notificationDedupeKey: "community_access:ban:14",
    });
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 17,
      email: "member@example.com",
      name: "Community Member",
    } as any);

    await expect(createCaller(1, "admin@example.com").community.adminMembers({
      status: "all",
      limit: 25,
      offset: 0,
    })).resolves.toEqual({ items: [], total: 0 });
    await expect(createCaller(1, "admin@example.com").community.banMember({
      userId: 17,
      reason: "Repeated abusive posts",
    })).resolves.toMatchObject({ access: "banned" });
    expect(db.banStudentCommunityMember).toHaveBeenCalledWith({
      userId: 17,
      reason: "Repeated abusive posts",
      expiresAt: null,
      actorUserId: 1,
    });
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "community_access:ban:14",
      recipientUserId: 17,
      recipientEmail: "member@example.com",
      eventType: "community_access_suspended",
      emailCategory: "transactional",
    }));
  });

  it("allows admins to prepare competitor terms while the community is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.addStudentCommunityPolicyTerm).mockResolvedValue({
      status: "created",
      term: {
        id: 4,
        term: "Example Competitor",
        normalizedTerm: "example competitor",
        category: "competitor",
      },
    } as any);

    await expect(createCaller(1, "admin@example.com").community.addPolicyTerm({
      term: "Example Competitor",
      category: "competitor",
    })).resolves.toMatchObject({ id: 4 });
    expect(db.addStudentCommunityPolicyTerm).toHaveBeenCalledWith({
      term: "Example Competitor",
      normalizedTerm: "example competitor",
      category: "competitor",
      actorUserId: 1,
    });
  });

  it("allows admins to prepare prohibited-language terms while disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.addStudentCommunityPolicyTerm).mockResolvedValue({
      status: "created",
      term: {
        id: 8,
        term: "qa badword",
        normalizedTerm: "qa badword",
        category: "prohibited_language",
      },
    } as any);

    await expect(createCaller(1, "admin@example.com").community.addPolicyTerm({
      term: "qa badword",
      category: "prohibited_language",
    })).resolves.toMatchObject({ id: 8 });
    expect(db.addStudentCommunityPolicyTerm).toHaveBeenCalledWith({
      term: "qa badword",
      normalizedTerm: "qa badword",
      category: "prohibited_language",
      actorUserId: 1,
    });
  });

  it("blocks community activation when safety requirements are incomplete", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.listStudentCommunityPolicyTerms).mockResolvedValue([]);

    await expect(createCaller(1, "admin@example.com").adminSettings.updateFeatureFlag({
      key: "student_community_enabled",
      enabled: true,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Community activation blocked"),
    });
    expect(db.setAdminSetting).not.toHaveBeenCalled();
  });

  it("allows admins to moderate content", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getStudentCommunityContentNotificationContext).mockResolvedValue({
      targetType: "post",
      targetId: 1,
      postId: 1,
      userId: 9,
      userName: "Student",
      userEmail: "student@example.com",
      status: "visible",
      updatedAt: "2026-07-24T10:00:00.000Z",
    } as any);
    vi.mocked(db.listOpenStudentCommunityReportNotificationContexts).mockResolvedValue([{
      reportId: 8,
      reporterUserId: 10,
      reporterName: "Reporter",
      reporterEmail: "reporter@example.com",
      targetType: "post",
      targetId: 1,
      postId: 1,
    }] as any);
    vi.mocked(db.moderateStudentCommunityContent).mockResolvedValue({
      id: 1,
      status: "hidden",
      updatedAt: "2026-07-24T10:01:00.000Z",
    } as any);

    await expect(createCaller(1, "admin@example.com").community.moderateContent({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
    })).resolves.toMatchObject({ id: 1, status: "hidden" });
    expect(db.moderateStudentCommunityContent).toHaveBeenCalledWith({
      targetType: "post",
      targetId: 1,
      action: "hide",
      note: "Off-topic",
      actorUserId: 1,
    });
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 9,
      eventType: "community_client_content_hidden",
      metadata: expect.objectContaining({ targetType: "post", targetId: 1 }),
    }));
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "community_report:8:report_action_taken",
      recipientUserId: 10,
      eventType: "community_client_report_action_taken",
    }));
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
    vi.mocked(db.getStudentCommunityReportNotificationContext).mockResolvedValue({
      reportId: 4,
      reporterUserId: 9,
      reporterName: "Reporter",
      reporterEmail: "reporter@example.com",
      targetType: "post",
      targetId: 1,
      postId: 1,
      status: "open",
    } as any);
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
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: "community_report:4:report_dismissed",
      recipientUserId: 9,
      eventType: "community_client_report_dismissed",
      emailCategory: "transactional",
    }));
  });
});
