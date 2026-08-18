import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  recordZeptoMailWebhookEvent: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import {
  handleZeptoMailWebhookRequest,
  parseZeptoMailWebhookEvent,
} from "./zeptoMailWebhook";

const secret = "test-webhook-secret";

function sampleEvent() {
  return {
    event_name: "hard bounce",
    webhook_request_id: "webhook-1",
    event_message: {
      request_id: "request-1",
      email_info: {
        subject: "Support reply",
        processed_time: "2026-08-18T09:30:00.000Z",
        to: [{ email_address: { address: "Amal@Example.com" } }],
      },
      event_data: {
        object: "hardbounce",
        details: {
          reason: "Mailbox unavailable",
          diagnostic_message: "550 user unknown",
          time: "2026-08-18T09:31:00.000Z",
        },
      },
    },
  };
}

async function sign(payload: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `ts=${timestamp};s=${Buffer.from(digest).toString("base64")};s-algorithm=HmacSHA256`;
}

describe("ZeptoMail delivery webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.recordZeptoMailWebhookEvent.mockResolvedValue({
      duplicate: false,
      matchedLogCount: 1,
    });
  });

  it("normalizes a hard-bounce event", () => {
    expect(parseZeptoMailWebhookEvent(JSON.stringify(sampleEvent()))).toEqual({
      providerEventId: "webhook-1",
      providerRequestId: "request-1",
      eventName: "hard_bounce",
      deliveryStatus: "bounced_hard",
      recipientEmail: "amal@example.com",
      subject: "Support reply",
      diagnostic: "550 user unknown",
      eventAt: "2026-08-18T09:31:00.000Z",
    });
  });

  it("accepts a current, correctly signed form payload and records it once", async () => {
    const payload = JSON.stringify(sampleEvent());
    const timestamp = Date.now();
    const response = await handleZeptoMailWebhookRequest(new Request("https://api.example.test/api/webhooks/zeptomail", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "producer-signature": await sign(payload, timestamp),
      },
      body: `event=${encodeURIComponent(payload)}`,
    }), secret);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "accepted", matchedLogCount: 1 });
    expect(dbMocks.recordZeptoMailWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      providerEventId: "webhook-1",
      providerRequestId: "request-1",
      deliveryStatus: "bounced_hard",
      recipientEmail: "amal@example.com",
    }));
  });

  it("rejects a forged signature without touching delivery records", async () => {
    const payload = JSON.stringify(sampleEvent());
    const response = await handleZeptoMailWebhookRequest(new Request("https://api.example.test/api/webhooks/zeptomail", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "producer-signature": `ts=${Date.now()};s=Zm9yZ2Vk;s-algorithm=HmacSHA256`,
      },
      body: `event=${encodeURIComponent(payload)}`,
    }), secret);

    expect(response.status).toBe(401);
    expect(dbMocks.recordZeptoMailWebhookEvent).not.toHaveBeenCalled();
  });

  it("accepts ZeptoMail's array-wrapped payload with the configured authorization header", async () => {
    const event = sampleEvent();
    const arrayWrapped = {
      ...event,
      event_name: ["softbounce"],
      event_message: [{
        ...event.event_message,
        event_data: [{
          object: "softbounce",
          details: [{
            bounced_recipient: "ActualBounce@Example.com",
            reason: "Mailbox full",
            diagnostic_message: "452 mailbox full",
            time: "2026-08-18T09:31:00.000Z",
          }],
        }],
      }],
    };
    const response = await handleZeptoMailWebhookRequest(new Request("https://api.example.test/api/webhooks/zeptomail", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-xflex-zeptomail-secret": secret,
      },
      body: `event=${encodeURIComponent(JSON.stringify(arrayWrapped))}`,
    }), secret);

    expect(response.status).toBe(200);
    expect(dbMocks.recordZeptoMailWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "softbounce",
      deliveryStatus: "bounced_soft",
      recipientEmail: "actualbounce@example.com",
      diagnostic: "452 mailbox full",
    }));
  });

  it("rejects an incorrect static authorization header", async () => {
    const payload = JSON.stringify(sampleEvent());
    const response = await handleZeptoMailWebhookRequest(new Request("https://api.example.test/api/webhooks/zeptomail", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-xflex-zeptomail-secret": "wrong-secret",
      },
      body: `event=${encodeURIComponent(payload)}`,
    }), secret);

    expect(response.status).toBe(401);
    expect(dbMocks.recordZeptoMailWebhookEvent).not.toHaveBeenCalled();
  });
});
