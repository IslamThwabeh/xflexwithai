import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  reconcileStaleRecommendationDeliveries: vi.fn(),
  claimNextRecommendationDeliveryBatch: vi.fn(),
  partitionRecommendationDeliveriesByEligibility: vi.fn(),
  markRecommendationDeliveryBatchSkipped: vi.fn(),
  markRecommendationDeliveryBatchSent: vi.fn(),
  markRecommendationDeliveryBatchSuppressed: vi.fn(),
  markRecommendationDeliveryBatchFailed: vi.fn(),
  markNotificationEmailsSent: vi.fn(),
}));

vi.mock("../backend/_core/email", () => ({
  sendRecommendationBccBatch: vi.fn(),
}));

import { sendRecommendationBccBatch } from "../backend/_core/email";
import * as db from "../backend/db";
import {
  drainRecommendationDeliveryQueue,
  getRemainingGenericEmailBudget,
} from "../backend/services/recommendation-delivery.service";

describe("recommendation delivery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.reconcileStaleRecommendationDeliveries).mockResolvedValue({
      alerts: 0,
      recommendations: 0,
      updates: 0,
      orphanedResults: 0,
      total: 0,
    });
    vi.mocked(db.claimNextRecommendationDeliveryBatch).mockResolvedValue([]);
    vi.mocked(db.partitionRecommendationDeliveriesByEligibility).mockImplementation(async (rows) => ({
      eligible: rows,
      ineligible: [],
    }));
    vi.mocked(db.markNotificationEmailsSent).mockResolvedValue(undefined);
  });

  it("reserves the shared budget by provider request rather than recipient count", () => {
    expect(getRemainingGenericEmailBudget(0)).toBe(10);
    expect(getRemainingGenericEmailBudget(4)).toBe(6);
    expect(getRemainingGenericEmailBudget(10)).toBe(0);
    expect(getRemainingGenericEmailBudget(12)).toBe(0);
  });

  it("sends one BCC request for an identical event/language recipient group", async () => {
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([
        {
          id: 1,
          eventKey: "rec_msg:101",
          eventKind: "recommendation",
          refId: 101,
          userId: 7,
          recipientEmail: "client1@example.com",
          language: "ar",
          subject: "New recommendation",
          bodyText: "Open the recommendations page.",
          bodyHtml: "<p>Open the recommendations page.</p>",
          metadataJson: JSON.stringify({ batchId: "rec_live_101" }),
          attempts: 0,
        } as any,
        {
          id: 2,
          eventKey: "rec_msg:101",
          eventKind: "recommendation",
          refId: 101,
          userId: 8,
          recipientEmail: "client2@example.com",
          language: "ar",
          subject: "New recommendation",
          bodyText: "Open the recommendations page.",
          bodyHtml: "<p>Open the recommendations page.</p>",
          metadataJson: JSON.stringify({ batchId: "rec_live_101" }),
          attempts: 0,
        } as any,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(sendRecommendationBccBatch).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-123",
      recipientCount: 2,
      sentUserIds: [7, 8],
      skippedUserIds: [],
    });

    const result = await drainRecommendationDeliveryQueue({
      limit: 50,
      source: "scheduled",
    });

    expect(sendRecommendationBccBatch).toHaveBeenCalledOnce();
    expect(sendRecommendationBccBatch).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [
        { email: "client1@example.com", userId: 7 },
        { email: "client2@example.com", userId: 8 },
      ],
      providerBatchKey: "rec_msg:101:ar:1:2:1",
    }));
    expect(db.markRecommendationDeliveryBatchSent).toHaveBeenCalledWith({
      ids: [1, 2],
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-123",
      providerBatchKey: "rec_msg:101:ar:1:2:1",
    });
    expect(db.markNotificationEmailsSent).toHaveBeenCalledWith("rec_live_101", [7, 8]);
    expect(result).toEqual({
      claimed: 2,
      sent: 2,
      failed: 0,
      skippedMissingPayload: 0,
      skippedSuppressed: 0,
      skippedIneligible: 0,
      providerRequests: 1,
      batches: 1,
    });
  });

  it("revalidates a mixed claimed batch and never sends ineligible recipients", async () => {
    const eligible = {
      id: 21,
      eventKey: "rec_msg:121",
      eventKind: "recommendation",
      refId: 121,
      userId: 31,
      recipientEmail: "eligible@example.com",
      language: "en",
      subject: "New recommendation",
      bodyText: "Open the recommendations page.",
      bodyHtml: null,
      metadataJson: JSON.stringify({ batchId: "rec_live_121" }),
      attempts: 0,
    } as any;
    const disabled = { ...eligible, id: 22, userId: 32, recipientEmail: "disabled@example.com" } as any;
    const expired = { ...eligible, id: 23, userId: 33, recipientEmail: "expired@example.com" } as any;
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([eligible, disabled, expired])
      .mockResolvedValueOnce([]);
    vi.mocked(db.partitionRecommendationDeliveriesByEligibility).mockResolvedValue({
      eligible: [eligible],
      ineligible: [
        { delivery: disabled, reason: "account_disabled" },
        { delivery: expired, reason: "subscription_ineligible" },
      ],
    });
    vi.mocked(sendRecommendationBccBatch).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-121",
      recipientCount: 1,
      sentUserIds: [31],
      skippedUserIds: [],
    });

    const result = await drainRecommendationDeliveryQueue({ source: "scheduled" });

    expect(db.markRecommendationDeliveryBatchSkipped).toHaveBeenCalledWith({
      items: [
        { id: 22, reason: "account_disabled" },
        { id: 23, reason: "subscription_ineligible" },
      ],
    });
    expect(sendRecommendationBccBatch).toHaveBeenCalledWith(expect.objectContaining({
      recipients: [{ email: "eligible@example.com", userId: 31 }],
      providerBatchKey: "rec_msg:121:en:21:21:1",
    }));
    expect(result.skippedIneligible).toBe(2);
    expect(result.sent).toBe(1);
  });

  it("does not retry provider-accepted email when notification reporting sync fails", async () => {
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([
        {
          id: 5,
          eventKey: "rec_msg:105",
          eventKind: "recommendation",
          refId: 105,
          userId: 11,
          recipientEmail: "client@example.com",
          language: "ar",
          subject: "New recommendation",
          bodyText: "Open the recommendations page.",
          bodyHtml: null,
          metadataJson: JSON.stringify({ batchId: "rec_live_105" }),
          attempts: 0,
        } as any,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(sendRecommendationBccBatch).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-105",
      recipientCount: 1,
      sentUserIds: [11],
      skippedUserIds: [],
    });
    vi.mocked(db.markNotificationEmailsSent).mockRejectedValueOnce(new Error("Reporting database unavailable"));

    const result = await drainRecommendationDeliveryQueue({ source: "publish" });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(db.markRecommendationDeliveryBatchSent).toHaveBeenCalledOnce();
    expect(db.markRecommendationDeliveryBatchFailed).not.toHaveBeenCalled();
  });

  it("marks only provider-accepted recipients in notification reporting", async () => {
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([
        {
          id: 6,
          eventKey: "rec_msg:106",
          eventKind: "update",
          refId: 106,
          userId: 12,
          recipientEmail: "accepted@example.com",
          language: "en",
          subject: "Recommendation update",
          bodyText: "Updated.",
          bodyHtml: null,
          metadataJson: JSON.stringify({ batchId: "rec_live_106" }),
          attempts: 0,
        } as any,
        {
          id: 7,
          eventKey: "rec_msg:106",
          eventKind: "update",
          refId: 106,
          userId: 13,
          recipientEmail: "suppressed@example.com",
          language: "en",
          subject: "Recommendation update",
          bodyText: "Updated.",
          bodyHtml: null,
          metadataJson: JSON.stringify({ batchId: "rec_live_106" }),
          attempts: 0,
        } as any,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(sendRecommendationBccBatch).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-106",
      recipientCount: 1,
      sentUserIds: [12],
      skippedUserIds: [13],
    });

    const result = await drainRecommendationDeliveryQueue({ source: "scheduled" });

    expect(db.markNotificationEmailsSent).toHaveBeenCalledWith("rec_live_106", [12]);
    expect(db.markRecommendationDeliveryBatchSuppressed).toHaveBeenCalledWith({
      ids: [7],
      reason: "Recipient is permanently suppressed",
      providerBatchKey: "rec_msg:106:en:6:7:1",
    });
    expect(result.sent).toBe(1);
    expect(result.skippedSuppressed).toBe(1);
  });

  it("returns the entire provider batch to retry after a provider failure", async () => {
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([
        {
          id: 2,
          eventKey: "rec_msg:102",
          eventKind: "recommendation",
          refId: 102,
          userId: 8,
          recipientEmail: "client2@example.com",
          language: "en",
          subject: "New recommendation",
          bodyText: "Open the recommendations page.",
          bodyHtml: null,
          attempts: 1,
        } as any,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(sendRecommendationBccBatch).mockRejectedValue(Object.assign(
      new Error("Provider unavailable"),
      { category: "5xx", attemptedProviders: ["zeptomail"] },
    ));

    const result = await drainRecommendationDeliveryQueue({ source: "publish" });

    expect(db.markRecommendationDeliveryBatchFailed).toHaveBeenCalledWith({
      ids: [2],
      errorCategory: "5xx",
      errorMessage: "Provider unavailable",
      attemptedProviders: ["zeptomail"],
      providerBatchKey: "rec_msg:102:en:2:2:2",
    });
    expect(result.failed).toBe(1);
    expect(result.providerRequests).toBe(1);
  });

  it("targets a newly published event without changing scheduled drain behavior", async () => {
    await drainRecommendationDeliveryQueue({
      eventKey: "rec_msg:104",
      source: "publish",
    });

    expect(db.claimNextRecommendationDeliveryBatch).toHaveBeenCalledWith(50, "rec_msg:104");

    vi.mocked(db.claimNextRecommendationDeliveryBatch).mockClear();
    await drainRecommendationDeliveryQueue({ source: "scheduled" });

    expect(db.claimNextRecommendationDeliveryBatch).toHaveBeenCalledWith(50, undefined);
  });

  it("rejects non-identical content before any provider request", async () => {
    vi.mocked(db.claimNextRecommendationDeliveryBatch)
      .mockResolvedValueOnce([
        {
          id: 3,
          eventKey: "rec_msg:103",
          eventKind: "update",
          refId: 103,
          userId: 9,
          recipientEmail: "a@example.com",
          language: "ar",
          subject: "Update",
          bodyText: "A",
          bodyHtml: null,
          attempts: 0,
        } as any,
        {
          id: 4,
          eventKey: "rec_msg:103",
          eventKind: "update",
          refId: 103,
          userId: 10,
          recipientEmail: "b@example.com",
          language: "ar",
          subject: "Update",
          bodyText: "B",
          bodyHtml: null,
          attempts: 0,
        } as any,
      ])
      .mockResolvedValueOnce([]);

    const result = await drainRecommendationDeliveryQueue({ source: "scheduled" });

    expect(sendRecommendationBccBatch).not.toHaveBeenCalled();
    expect(db.markRecommendationDeliveryBatchFailed).toHaveBeenCalledWith(expect.objectContaining({
      ids: [3, 4],
      errorCategory: "missing_payload",
    }));
    expect(result.skippedMissingPayload).toBe(2);
    expect(result.providerRequests).toBe(0);
  });
});
