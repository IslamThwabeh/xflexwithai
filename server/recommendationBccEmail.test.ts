import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  logEmailDeliveryAttempts: vi.fn(),
}));

import { sendRecommendationBccBatch } from "../backend/_core/email";
import * as db from "../backend/db";

describe("recommendation BCC provider request", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = "zeptomail";
    process.env.EMAIL_FROM = "mailer@xflexacademy.com";
    process.env.RECOMMENDATION_EMAIL_TO = "support@xflexacademy.com";
    process.env.ZEPTOMAIL_TOKEN = "test-token";
    process.env.ZEPTOMAIL_API_URL = "https://zepto.test/send";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("keeps clients out of To and sends them only as BCC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ request_id: "provider-request-1" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendRecommendationBccBatch({
      recipients: [
        { email: "Aya@example.com", userId: 1 },
        { email: "walaa@example.com", userId: 2 },
      ],
      subject: "Recommendation",
      text: "A new recommendation is available.",
      eventType: "recommendation_recommendation",
      templateId: "recommendation_recommendation",
      providerBatchKey: "rec_msg:1:en:1:2:1",
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.to).toEqual([
      { email_address: { address: "support@xflexacademy.com" } },
    ]);
    expect(request.bcc).toEqual([
      { email_address: { address: "aya@example.com" } },
      { email_address: { address: "walaa@example.com" } },
    ]);
    expect(JSON.stringify(request.to)).not.toContain("aya@example.com");
    expect(result.providerRequestId).toBe("provider-request-1");
    expect(db.logEmailDeliveryAttempts).toHaveBeenCalledWith([
      expect.objectContaining({ recipientEmail: "aya@example.com", status: "sent" }),
      expect.objectContaining({ recipientEmail: "walaa@example.com", status: "sent" }),
    ]);
  });

  it("enforces the conservative 50-recipient ceiling before calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const recipients = Array.from({ length: 51 }, (_, index) => ({
      email: `client${index}@example.com`,
      userId: index + 1,
    }));

    await expect(sendRecommendationBccBatch({
      recipients,
      subject: "Recommendation",
      text: "A new recommendation is available.",
      eventType: "recommendation_recommendation",
      templateId: "recommendation_recommendation",
      providerBatchKey: "oversized",
    })).rejects.toThrow("50-recipient");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
