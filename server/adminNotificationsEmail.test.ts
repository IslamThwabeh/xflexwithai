import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/_core/email", () => ({
  preflightAdminNotificationEmail: vi.fn().mockReturnValue({ recipientCount: 1, deliveryMode: "single_to" }),
  sendAdminNotificationEmail: vi.fn(),
  sendEmail: vi.fn().mockResolvedValue({ provider: "zeptomail", attemptedProviders: ["zeptomail"] }),
  sendLoginCodeEmail: vi.fn(),
}));

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    sendBulkNotification: vi.fn().mockResolvedValue(undefined),
    getAllUsers: vi.fn(),
    markNotificationEmailsSent: vi.fn().mockResolvedValue(undefined),
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  };
});

import { preflightAdminNotificationEmail, sendAdminNotificationEmail } from "../backend/_core/email";
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAdminCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/notifications.send",
    },
    user: {
      id: -1,
      email: "admin@example.com",
      passwordHash: "",
      name: "Admin User",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("admin notification email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.getAllUsers).mockResolvedValue([
      { id: 10, email: "one@example.com" },
      { id: 20, email: "two@example.com" },
      { id: 30, email: "three@example.com" },
    ] as any);
    vi.mocked(sendAdminNotificationEmail).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-1",
      sentUserIds: [10, 20, 30],
      skippedUserIds: [],
      recipientCount: 3,
      deliveryMode: "bcc_batch",
    } as any);
  });

  it("sends multiple admin-notification recipients through the BCC helper and marks accepted users as emailed", async () => {
    const caller = createAdminCaller();

    const result = await caller.notifications.send({
      userIds: [10, 20, 30],
      titleAr: "إعلان مهم",
      contentAr: "نص الإعلان",
      sendEmail: true,
    });

    expect(sendAdminNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [
        { userId: 10, email: "one@example.com" },
        { userId: 20, email: "two@example.com" },
        { userId: 30, email: "three@example.com" },
      ],
      eventType: "admin_bulk_notification",
      templateId: "announcement",
    }));
    expect(db.markNotificationEmailsSent).toHaveBeenCalledWith(expect.any(String), [10, 20, 30]);
    expect(result).toMatchObject({
      success: true,
      count: 3,
      emailsQueued: 0,
      emailsSent: 3,
      emailsSkipped: 0,
      emailDeliveryMode: "bcc_batch",
    });
  });

  it("keeps single-recipient admin notification email on the single To path", async () => {
    vi.mocked(sendAdminNotificationEmail).mockResolvedValueOnce({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: null,
      sentUserIds: [10],
      skippedUserIds: [],
      recipientCount: 1,
      deliveryMode: "single_to",
    } as any);
    const caller = createAdminCaller();

    const result = await caller.notifications.send({
      userIds: [10],
      titleAr: "رسالة خاصة",
      contentAr: "نص الرسالة",
      sendEmail: true,
    });

    expect(sendAdminNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [{ userId: 10, email: "one@example.com" }],
    }));
    expect(db.markNotificationEmailsSent).toHaveBeenCalledWith(expect.any(String), [10]);
    expect(result.emailDeliveryMode).toBe("single_to");
  });

  it("preflights email before creating in-app notification rows", async () => {
    vi.mocked(preflightAdminNotificationEmail).mockImplementationOnce(() => {
      throw new Error("Admin notification BCC batch exceeds the safe recipient limit");
    });
    const caller = createAdminCaller();

    await expect(caller.notifications.send({
      userIds: [10, 20, 30],
      titleAr: "إعلان مهم",
      contentAr: "نص الإعلان",
      sendEmail: true,
    })).rejects.toThrow("safe recipient limit");

    expect(db.sendBulkNotification).not.toHaveBeenCalled();
    expect(sendAdminNotificationEmail).not.toHaveBeenCalled();
  });

  it("reports email failure without making a successful in-app send look retryable", async () => {
    vi.mocked(sendAdminNotificationEmail).mockRejectedValueOnce(new Error("provider unavailable"));
    const caller = createAdminCaller();

    const result = await caller.notifications.send({
      userIds: [10, 20],
      titleAr: "إعلان مهم",
      contentAr: "نص الإعلان",
      sendEmail: true,
    });

    expect(db.sendBulkNotification).toHaveBeenCalledTimes(1);
    expect(db.markNotificationEmailsSent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      count: 2,
      emailsSent: 0,
      emailFailed: true,
      emailError: "provider unavailable",
    });
  });

  it("sends a safe test only to the signed-in admin without creating student notifications", async () => {
    vi.mocked(sendAdminNotificationEmail).mockResolvedValueOnce({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-test",
      sentUserIds: [-1],
      skippedUserIds: [],
      recipientCount: 1,
      deliveryMode: "single_to",
    } as any);
    const caller = createAdminCaller();

    const result = await caller.notifications.sendTestEmail({
      titleAr: "اختبار إداري",
      contentAr: "هذه معاينة قبل الإرسال",
      titleEn: "Admin test",
      contentEn: "Preview before sending",
      actionUrl: "/surveys",
      featureId: "student-surveys",
    });

    expect(sendAdminNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [{ userId: -1, email: "admin@example.com" }],
      eventType: "student_survey_admin_notification_test",
      templateId: "announcement_test",
      metadata: expect.objectContaining({
        previewOnly: true,
        actionUrl: "/surveys",
        featureId: "student-surveys",
      }),
    }));
    expect(db.sendBulkNotification).not.toHaveBeenCalled();
    expect(db.markNotificationEmailsSent).not.toHaveBeenCalled();
    expect(db.logAdminAction).toHaveBeenCalledWith(1, 1, "send_admin_notification_test", expect.any(Object));
    expect(result).toEqual({ success: true, skipped: false });
  });
});
