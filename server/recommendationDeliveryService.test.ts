import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  reconcileStaleRecommendationDeliveries: vi.fn(),
  claimNextRecommendationDeliveryBatch: vi.fn(),
  markRecommendationDeliveryBatchSent: vi.fn(),
  markRecommendationDeliveryBatchFailed: vi.fn(),
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
          attempts: 0,
        } as any,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(sendRecommendationBccBatch).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: "request-123",
      recipientCount: 2,
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
    expect(result).toEqual({
      claimed: 2,
      sent: 2,
      failed: 0,
      skippedMissingPayload: 0,
      providerRequests: 1,
      batches: 1,
    });
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
