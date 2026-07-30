import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getPermanentlySuppressedEmailAddresses: vi.fn(),
  getSuppressedEmailAddresses: vi.fn(),
  isEmailSuppressed: vi.fn(),
  logEmailDeliveryAttempt: vi.fn(),
  logEmailDeliveryAttempts: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import {
  sendEmail,
  sendRecommendationBccBatch,
  sendStaffBccBatch,
} from "./email";

describe("permanent email suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = "zeptomail";
    process.env.ZEPTOMAIL_TOKEN = "test-token";
    process.env.EMAIL_FROM = "support@example.com";
    process.env.RECOMMENDATION_EMAIL_TO = "support@example.com";
    dbMocks.getPermanentlySuppressedEmailAddresses.mockResolvedValue(new Set());
    dbMocks.getSuppressedEmailAddresses.mockResolvedValue(new Set());
    dbMocks.isEmailSuppressed.mockResolvedValue(false);
    dbMocks.logEmailDeliveryAttempt.mockResolvedValue(undefined);
    dbMocks.logEmailDeliveryAttempts.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ request_id: "request-1" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
  });

  it("skips a permanently suppressed single recipient before provider submission", async () => {
    dbMocks.getPermanentlySuppressedEmailAddresses.mockResolvedValue(
      new Set(["dead@example.com"]),
    );

    const result = await sendEmail({
      to: "Dead@Example.com",
      subject: "Test",
      text: "Test",
      audit: { eventType: "test_event", templateId: "test_template" },
    });

    expect(result).toEqual({
      provider: null,
      attemptedProviders: [],
      skipped: "suppressed",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(dbMocks.logEmailDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "Dead@Example.com",
        status: "skipped_suppressed",
      }),
    );
  });

  it("submits configured BCC recipients with a personalized client email", async () => {
    await sendEmail({
      to: "client@example.com",
      bcc: ["admin@example.com", "ops@example.com"],
      subject: "Timed service reminder",
      text: "Reminder",
      audit: { eventType: "inactivity", templateId: "inactivity_7" },
    });

    const providerBody = JSON.parse(
      String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body),
    );
    expect(providerBody.to).toEqual([
      { email_address: { address: "client@example.com" } },
    ]);
    expect(providerBody.bcc).toEqual([
      { email_address: { address: "admin@example.com" } },
      { email_address: { address: "ops@example.com" } },
    ]);
  });

  it("removes permanently suppressed staff BCC recipients while keeping live recipients", async () => {
    dbMocks.getPermanentlySuppressedEmailAddresses.mockResolvedValue(
      new Set(["dead@example.com"]),
    );

    await sendStaffBccBatch({
      to: "support@example.com",
      recipients: [
        { email: "dead@example.com", userId: 1 },
        { email: "live@example.com", userId: 2 },
      ],
      subject: "Staff alert",
      text: "Staff alert",
      eventType: "new_support_message",
      templateId: "staff_alert",
      providerBatchKey: "staff-test",
    });

    const providerBody = JSON.parse(
      String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body),
    );
    expect(providerBody.bcc).toEqual([
      { email_address: { address: "live@example.com" } },
    ]);

    const auditedRows = dbMocks.logEmailDeliveryAttempts.mock.calls
      .flatMap(([rows]) => rows);
    expect(auditedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipientEmail: "dead@example.com",
        status: "skipped_suppressed",
      }),
      expect.objectContaining({
        recipientEmail: "live@example.com",
        status: "sent",
      }),
    ]));
    expect(auditedRows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipientEmail: "dead@example.com",
        status: "sent",
      }),
    ]));
  });

  it("finishes an all-suppressed recommendation batch without a provider request", async () => {
    dbMocks.getPermanentlySuppressedEmailAddresses.mockResolvedValue(
      new Set(["dead@example.com"]),
    );

    const result = await sendRecommendationBccBatch({
      recipients: [{ email: "dead@example.com", userId: 7 }],
      subject: "Recommendation",
      text: "Recommendation",
      eventType: "recommendation_new",
      templateId: "recommendation_new",
      providerBatchKey: "recommendation-test",
    });

    expect(result).toEqual({
      provider: null,
      attemptedProviders: [],
      providerRequestId: null,
      recipientCount: 1,
      sentUserIds: [],
      skippedUserIds: [7],
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(dbMocks.logEmailDeliveryAttempts).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientEmail: "dead@example.com",
        status: "skipped_suppressed",
      }),
    ]);
  });
});
