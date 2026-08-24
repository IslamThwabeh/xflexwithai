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

  it("keeps the minute delivery jobs before the health monitor", () => {
    const workerSource = readFileSync(
      fileURLToPath(new URL("../backend/_core/worker.ts", import.meta.url)),
      "utf8",
    );
    const minuteBranchStart = workerSource.indexOf('if (controller.cron === "* * * * *")');
    const deliveryCall = workerSource.indexOf("await runFrequentTimedServiceAndEmailJobs()", minuteBranchStart);
    const healthCall = workerSource.indexOf("await checkScheduledEmailOutboxHealth(5)", minuteBranchStart);

    expect(minuteBranchStart).toBeGreaterThan(-1);
    expect(deliveryCall).toBeGreaterThan(minuteBranchStart);
    expect(healthCall).toBeGreaterThan(deliveryCall);
    expect(workerSource).toContain('if (minute === 0)');
  });
});
