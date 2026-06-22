import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  reconcileStaleRecommendationDeliveries: vi.fn(),
  listPendingRecommendationDeliveriesForRetry: vi.fn(),
  markRecommendationDeliverySent: vi.fn(),
  markRecommendationDeliveryFailed: vi.fn(),
}));

vi.mock("../backend/_core/email", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "../backend/_core/email";
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
    vi.mocked(db.listPendingRecommendationDeliveriesForRetry).mockResolvedValue([]);
  });

  it("reserves the shared minute budget for recommendations first", () => {
    expect(getRemainingGenericEmailBudget(0)).toBe(10);
    expect(getRemainingGenericEmailBudget(4)).toBe(6);
    expect(getRemainingGenericEmailBudget(10)).toBe(0);
    expect(getRemainingGenericEmailBudget(12)).toBe(0);
  });

  it("reconciles stale rows before claiming and sends a bounded batch", async () => {
    vi.mocked(db.listPendingRecommendationDeliveriesForRetry).mockResolvedValue([
      {
        id: 1,
        eventKey: "rec_msg:101",
        eventKind: "recommendation",
        refId: 101,
        userId: 7,
        recipientEmail: "client@example.com",
        subject: "New recommendation",
        bodyText: "Open the recommendations page.",
        bodyHtml: "<p>Open the recommendations page.</p>",
      } as any,
    ]);
    vi.mocked(sendEmail).mockResolvedValue({
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
    } as any);

    const result = await drainRecommendationDeliveryQueue({
      limit: 50,
      source: "scheduled",
    });

    expect(db.reconcileStaleRecommendationDeliveries).toHaveBeenCalledOnce();
    expect(db.listPendingRecommendationDeliveriesForRetry).toHaveBeenCalledWith(10);
    expect(db.markRecommendationDeliverySent).toHaveBeenCalledWith({
      eventKey: "rec_msg:101",
      userId: 7,
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
    });
    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
      skippedMissingPayload: 0,
    });
  });

  it("records provider failures without aborting the drain", async () => {
    vi.mocked(db.listPendingRecommendationDeliveriesForRetry).mockResolvedValue([
      {
        id: 2,
        eventKey: "rec_msg:102",
        eventKind: "recommendation",
        refId: 102,
        userId: 8,
        recipientEmail: "client2@example.com",
        subject: "New recommendation",
        bodyText: "Open the recommendations page.",
      } as any,
    ]);
    const providerError = Object.assign(new Error("Provider unavailable"), {
      category: "5xx",
      attemptedProviders: ["zeptomail"],
    });
    vi.mocked(sendEmail).mockRejectedValue(providerError);

    const result = await drainRecommendationDeliveryQueue({
      source: "publish",
    });

    expect(db.markRecommendationDeliveryFailed).toHaveBeenCalledWith({
      eventKey: "rec_msg:102",
      userId: 8,
      errorCategory: "5xx",
      errorMessage: "Provider unavailable",
      attemptedProviders: ["zeptomail"],
    });
    expect(result.failed).toBe(1);
  });
});
