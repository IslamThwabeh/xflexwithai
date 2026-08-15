import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  claimEmailOutboxBatch: vi.fn(),
  markEmailOutboxSent: vi.fn(),
  markEmailOutboxSkipped: vi.fn(),
  markEmailOutboxFailed: vi.fn(),
  getEmailOutboxRecipientBlockReason: vi.fn(),
  getStudentCommunityPostEmailOutboxBlockReason: vi.fn(),
  getStudentSurveyEmailOutboxBlockReason: vi.fn(),
  releaseEmailOutboxClaims: vi.fn(),
}));

vi.mock("../backend/_core/email", () => ({
  sendEmail: vi.fn(),
  sendAdminNotificationEmail: vi.fn(),
}));

import { sendAdminNotificationEmail, sendEmail } from "../backend/_core/email";
import * as db from "../backend/db";
import {
  drainDueEmailOutbox,
  drainGenericEmailOutbox,
  drainStudentCommunityPostEmailOutbox,
  drainStudentSurveyEmailOutbox,
  SUPPORT_REPLY_EMAIL_DRAIN_LIMIT,
} from "../backend/services/email-outbox.service";

function outboxRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    recipientEmail: "client@example.com",
    recipientUserId: 7,
    eventType: "support_client_reply",
    templateId: "support_client_reply",
    emailCategory: "transactional",
    subject: "Support reply",
    bodyText: "Hello",
    bodyHtml: "<p>Hello</p>",
    metadataJson: JSON.stringify({ conversationId: 10 }),
    ...overrides,
  };
}

describe("email outbox service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValue([]);
    vi.mocked(db.getEmailOutboxRecipientBlockReason).mockResolvedValue(null);
    vi.mocked(db.getStudentCommunityPostEmailOutboxBlockReason).mockResolvedValue(null);
    vi.mocked(db.getStudentSurveyEmailOutboxBlockReason).mockResolvedValue(null);
    vi.mocked(sendEmail).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
    } as any);
    vi.mocked(sendAdminNotificationEmail).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: null,
      sentUserIds: [7, 8],
      skippedUserIds: [],
      recipientCount: 2,
      deliveryMode: "bcc_batch",
    } as any);
  });

  it("claims support reply rows by event type when requested", async () => {
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce([outboxRow()]);

    const result = await drainGenericEmailOutbox({
      limit: SUPPORT_REPLY_EMAIL_DRAIN_LIMIT,
      eventTypes: ["support_client_reply"],
    });

    expect(db.claimEmailOutboxBatch).toHaveBeenCalledWith(SUPPORT_REPLY_EMAIL_DRAIN_LIMIT, {
      eventTypes: ["support_client_reply"],
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      audit: expect.objectContaining({
        eventType: "support_client_reply",
        recipientUserId: 7,
      }),
    }));
    expect(db.markEmailOutboxSent).toHaveBeenCalledWith({
      id: 1,
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
    });
    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("drains the reserved support reply lane before the generic lane", async () => {
    vi.mocked(db.claimEmailOutboxBatch)
      .mockResolvedValueOnce([outboxRow({ id: 2 })])
      .mockResolvedValueOnce([outboxRow({
        id: 3,
        eventType: "admin_bulk_notification",
        templateId: "admin_bulk_notification",
      })]);

    const result = await drainDueEmailOutbox({
      supportReplyLimit: 5,
      genericLimit: 10,
    });

    expect(db.claimEmailOutboxBatch).toHaveBeenNthCalledWith(1, 5, {
      eventTypes: ["support_client_reply"],
    });
    expect(db.claimEmailOutboxBatch).toHaveBeenNthCalledWith(2, 10, {
      excludedEventTypes: [
        "student_survey_assigned",
        "student_survey_reminder",
        "student_community_post_published",
      ],
    });
    expect(result.total).toEqual({ claimed: 2, sent: 2, failed: 0, skipped: 0 });
  });

  it("sends identical survey rows in one privacy-safe BCC provider request", async () => {
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce([
      outboxRow({
        id: 10,
        batchId: "student-survey:3:assigned:due:ar",
        recipientUserId: 7,
        recipientEmail: "first@example.com",
        eventType: "student_survey_assigned",
        templateId: "student_survey_assigned",
        emailCategory: "marketing",
        subject: "Survey",
        bodyText: "Complete it",
        bodyHtml: "<p>Complete it</p>",
      }),
      outboxRow({
        id: 11,
        batchId: "student-survey:3:assigned:due:ar",
        recipientUserId: 8,
        recipientEmail: "second@example.com",
        eventType: "student_survey_assigned",
        templateId: "student_survey_assigned",
        emailCategory: "marketing",
        subject: "Survey",
        bodyText: "Complete it",
        bodyHtml: "<p>Complete it</p>",
      }),
    ]);

    const result = await drainStudentSurveyEmailOutbox();

    expect(db.claimEmailOutboxBatch).toHaveBeenCalledWith(50, {
      eventTypes: ["student_survey_assigned", "student_survey_reminder"],
    });
    expect(sendAdminNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [
        { userId: 7, email: "first@example.com" },
        { userId: 8, email: "second@example.com" },
      ],
      providerBatchKey: "student-survey:3:assigned:due:ar",
    }));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 2, sent: 2, failed: 0, skipped: 0, providerRequests: 1 });
  });

  it("sends an eligible community-post batch through one privacy-safe BCC request", async () => {
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce([
      outboxRow({
        id: 20,
        batchId: "student-community-post:14:ar",
        recipientUserId: 7,
        recipientEmail: "first@example.com",
        eventType: "student_community_post_published",
        templateId: "student_community_post_published_ar",
        emailCategory: "marketing",
        subject: "New post",
        bodyText: "Open it",
        bodyHtml: "<p>Open it</p>",
      }),
      outboxRow({
        id: 21,
        batchId: "student-community-post:14:ar",
        recipientUserId: 8,
        recipientEmail: "second@example.com",
        eventType: "student_community_post_published",
        templateId: "student_community_post_published_ar",
        emailCategory: "marketing",
        subject: "New post",
        bodyText: "Open it",
        bodyHtml: "<p>Open it</p>",
      }),
    ]);

    const result = await drainStudentCommunityPostEmailOutbox();

    expect(db.claimEmailOutboxBatch).toHaveBeenCalledWith(50, {
      eventTypes: ["student_community_post_published"],
    });
    expect(sendAdminNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [
        { userId: 7, email: "first@example.com" },
        { userId: 8, email: "second@example.com" },
      ],
      providerBatchKey: "student-community-post:14:ar",
      metadata: expect.objectContaining({ deliveryMode: "privacy_bcc" }),
    }));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 2, sent: 2, failed: 0, skipped: 0, providerRequests: 1 });
  });

  it("marks unsubscribed rows as skipped instead of sent", async () => {
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce([outboxRow({ id: 4 })]);
    vi.mocked(sendEmail).mockResolvedValueOnce({
      skipped: "unsubscribed",
      provider: null,
      attemptedProviders: [],
    } as any);

    const result = await drainGenericEmailOutbox({
      limit: 1,
      eventTypes: ["support_client_reply"],
    });

    expect(db.markEmailOutboxSkipped).toHaveBeenCalledWith(
      4,
      "Recipient unsubscribed from this email category",
      "skipped_unsubscribed",
    );
    expect(db.markEmailOutboxSent).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
  });

  it("suppresses lifecycle mail for a disabled or deleted recipient before provider delivery", async () => {
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce([outboxRow({
      id: 5,
      eventType: "timed_service_activation",
      templateId: "timed_service_activation",
    })]);
    vi.mocked(db.getEmailOutboxRecipientBlockReason).mockResolvedValueOnce("recipient_account_disabled");

    const result = await drainGenericEmailOutbox({ limit: 1 });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.markEmailOutboxSkipped).toHaveBeenCalledWith(
      5,
      "recipient_account_disabled",
      "skipped_suppressed",
    );
    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
  });
});
