import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  isEmailSuppressed: vi.fn().mockResolvedValue(false),
  logEmailDeliveryAttempts: vi.fn(),
}));

import { sendAdminNotificationEmail } from "../backend/_core/email";
import * as db from "../backend/db";

describe("admin notification BCC provider request", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = "zeptomail";
    process.env.EMAIL_FROM = "mailer@xflexacademy.com";
    process.env.ZEPTOMAIL_TOKEN = "test-token";
    process.env.ZEPTOMAIL_API_URL = "https://zepto.test/send";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("sends multiple clients only as BCC with support as the To recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ request_id: "admin-provider-request-1" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAdminNotificationEmail({
      recipients: [
        { email: "First@example.com", userId: 1 },
        { email: "second@example.com", userId: 2 },
      ],
      subject: "Announcement",
      text: "A new announcement is available.",
      eventType: "admin_bulk_notification",
      templateId: "announcement",
      providerBatchKey: "batch_test",
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.to).toEqual([
      { email_address: { address: "support@xflexacademy.com" } },
    ]);
    expect(request.bcc).toEqual([
      { email_address: { address: "first@example.com" } },
      { email_address: { address: "second@example.com" } },
    ]);
    expect(JSON.stringify(request.to)).not.toContain("first@example.com");
    expect(result).toMatchObject({
      provider: "zeptomail",
      providerRequestId: "admin-provider-request-1",
      sentUserIds: [1, 2],
      skippedUserIds: [],
      deliveryMode: "bcc_batch",
    });
    expect(db.logEmailDeliveryAttempts).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ recipientEmail: "support@xflexacademy.com", status: "sent" }),
      expect.objectContaining({ recipientEmail: "first@example.com", status: "sent" }),
      expect.objectContaining({ recipientEmail: "second@example.com", status: "sent" }),
    ]));
  });

  it("filters unsubscribed marketing recipients out of the BCC request", async () => {
    vi.mocked(db.isEmailSuppressed).mockImplementation(async (email) => email === "second@example.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ request_id: "admin-provider-request-2" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAdminNotificationEmail({
      recipients: [
        { email: "first@example.com", userId: 1 },
        { email: "second@example.com", userId: 2 },
      ],
      subject: "Announcement",
      text: "A new announcement is available.",
      eventType: "admin_bulk_notification",
      templateId: "announcement",
      providerBatchKey: "batch_test",
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.bcc).toEqual([
      { email_address: { address: "first@example.com" } },
    ]);
    expect(result.sentUserIds).toEqual([1]);
    expect(result.skippedUserIds).toEqual([2]);
    expect(db.logEmailDeliveryAttempts).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientEmail: "second@example.com",
        status: "skipped_unsubscribed",
      }),
    ]);
  });
});
