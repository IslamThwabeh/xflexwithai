import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", () => ({
  hasEmailOutboxAnomaly: vi.fn(),
  getEmailOutboxHealth: vi.fn(),
  notifyStaffByEvent: vi.fn(),
}));

import * as db from "../backend/db";
import { checkScheduledEmailOutboxHealth } from "../backend/services/email-outbox-health-monitor.service";
import { runPriorityDeliveryLanes } from "../backend/services/worker-priority-delivery.service";

const healthyDetails = {
  pending: 0,
  duePending: 0,
  staleDuePending: 0,
  failed: 0,
  failedDue: 0,
  processing: 0,
  deadLetter: 0,
  supportReplyPending: 0,
  supportReplyDue: 0,
  oldestPendingCreatedAt: null,
  oldestDueNextAttemptAt: null,
  lastSentAt: "2026-08-24T12:00:00.000Z",
};

describe("scheduled email outbox health monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.hasEmailOutboxAnomaly).mockResolvedValue(false);
    vi.mocked(db.getEmailOutboxHealth).mockResolvedValue(healthyDetails);
    vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined);
  });

  it("keeps the healthy minute path on the indexed probe only", async () => {
    await expect(checkScheduledEmailOutboxHealth(5)).resolves.toEqual({
      anomalyDetected: false,
      notificationAttempted: false,
    });

    expect(db.hasEmailOutboxAnomaly).toHaveBeenCalledWith(5);
    expect(db.getEmailOutboxHealth).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("loads details and preserves the existing alert for a stale due row", async () => {
    const details = {
      ...healthyDetails,
      pending: 2,
      duePending: 2,
      staleDuePending: 1,
      failedDue: 1,
      oldestPendingCreatedAt: "2026-08-24T11:50:00.000Z",
      oldestDueNextAttemptAt: "2026-08-24T11:55:00.000Z",
    };
    vi.mocked(db.hasEmailOutboxAnomaly).mockResolvedValue(true);
    vi.mocked(db.getEmailOutboxHealth).mockResolvedValue(details);

    await expect(checkScheduledEmailOutboxHealth(5)).resolves.toEqual({
      anomalyDetected: true,
      notificationAttempted: true,
    });
    expect(db.getEmailOutboxHealth).toHaveBeenCalledWith(5);
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith(
      "email_delivery_anomaly",
      expect.objectContaining({
        titleEn: "Email outbox delay detected (1 stale due)",
        metadata: details,
      }),
    );
  });

  it("does not send a stale alert when the anomaly resolves before aggregation", async () => {
    vi.mocked(db.hasEmailOutboxAnomaly).mockResolvedValue(true);
    vi.mocked(db.getEmailOutboxHealth).mockResolvedValue(healthyDetails);

    await expect(checkScheduledEmailOutboxHealth(5)).resolves.toEqual({
      anomalyDetected: false,
      notificationAttempted: false,
    });
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("lets probe failures reach the Worker's existing non-fatal catch", async () => {
    vi.mocked(db.hasEmailOutboxAnomaly).mockRejectedValue(new Error("D1 unavailable"));
    await expect(checkScheduledEmailOutboxHealth(5)).rejects.toThrow("D1 unavailable");
    expect(db.getEmailOutboxHealth).not.toHaveBeenCalled();
  });

  it("keeps priority email jobs before the health monitor and repair off the minute path", () => {
    const workerSource = readFileSync(
      fileURLToPath(new URL("../backend/_core/worker.ts", import.meta.url)),
      "utf8",
    );
    const minuteBranchStart = workerSource.indexOf(
      "if (controller.cron === MINUTE_DELIVERY_CRON)",
    );
    const repairBranchStart = workerSource.indexOf(
      "if (controller.cron === TIMED_SERVICE_REPAIR_CRON)",
    );
    const dailyGuardStart = workerSource.indexOf(
      "if (controller.cron !== DAILY_MAINTENANCE_CRON)",
    );
    const deliveryCall = workerSource.indexOf(
      "await runFrequentEmailJobs()",
      minuteBranchStart,
    );
    const healthCall = workerSource.indexOf(
      "await checkScheduledEmailOutboxHealth(5)",
      minuteBranchStart,
    );
    const repairCall = workerSource.indexOf(
      "await db.runTimedServiceActivationRepair()",
      repairBranchStart,
    );

    expect(minuteBranchStart).toBeGreaterThan(-1);
    expect(deliveryCall).toBeGreaterThan(minuteBranchStart);
    expect(healthCall).toBeGreaterThan(deliveryCall);
    expect(repairBranchStart).toBeGreaterThan(healthCall);
    expect(repairCall).toBeGreaterThan(repairBranchStart);
    expect(dailyGuardStart).toBeGreaterThan(repairCall);
    expect(workerSource).toContain("if (minute === 0)");
  });

  it("configures independent minute, timed-repair, and daily schedules", () => {
    const configSource = readFileSync(
      fileURLToPath(new URL("../wrangler-worker.toml", import.meta.url)),
      "utf8",
    );

    expect(configSource).toContain(
      'crons = ["* * * * *", "*/5 * * * *", "0 5 * * *"]',
    );
  });
});

describe("priority delivery scheduler", () => {
  it("runs recommendation before human support", async () => {
    const order: string[] = [];

    await expect(
      runPriorityDeliveryLanes({
        drainRecommendations: async () => {
          order.push("recommendation");
          return { providerRequests: 2 };
        },
        drainSupportReplies: async () => {
          order.push("support");
        },
        onError: vi.fn(),
      }),
    ).resolves.toEqual({ recommendationProviderRequests: 2 });

    expect(order).toEqual(["recommendation", "support"]);
  });

  it("still attempts support when recommendation delivery fails", async () => {
    const support = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    await expect(
      runPriorityDeliveryLanes({
        drainRecommendations: vi
          .fn()
          .mockRejectedValue(new Error("recommendation unavailable")),
        drainSupportReplies: support,
        recommendationFailureProviderRequests: 4,
        onError,
      }),
    ).resolves.toEqual({ recommendationProviderRequests: 4 });

    expect(support).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("recommendation", expect.any(Error));
  });

  it("isolates support failure after preserving recommendation budget", async () => {
    const onError = vi.fn();

    await expect(
      runPriorityDeliveryLanes({
        drainRecommendations: vi
          .fn()
          .mockResolvedValue({ providerRequests: 3 }),
        drainSupportReplies: vi
          .fn()
          .mockRejectedValue(new Error("support unavailable")),
        onError,
      }),
    ).resolves.toEqual({ recommendationProviderRequests: 3 });

    expect(onError).toHaveBeenCalledWith("support", expect.any(Error));
  });
});
