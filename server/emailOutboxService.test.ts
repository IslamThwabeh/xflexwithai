import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  claimEmailOutboxBatch: vi.fn(),
  markEmailOutboxSent: vi.fn(),
  markEmailOutboxSkipped: vi.fn(),
  markEmailOutboxFailed: vi.fn(),
}));

vi.mock("../backend/_core/email", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "../backend/_core/email";
import * as db from "../backend/db";
import {
  drainDueEmailOutbox,
  drainGenericEmailOutbox,
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
    vi.mocked(sendEmail).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
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
      eventTypes: undefined,
    });
    expect(result.total).toEqual({ claimed: 2, sent: 2, failed: 0, skipped: 0 });
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

    expect(db.markEmailOutboxSkipped).toHaveBeenCalledWith(4, "Recipient unsubscribed from this email category");
    expect(db.markEmailOutboxSent).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
  });
});
