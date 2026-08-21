import { describe, expect, it, vi } from "vitest";
import {
  runTimedServiceRepairWithRetry,
  TimedServiceRepairRetryError,
} from "../backend/services/timed-service-repair.service";

describe("timed-service repair retry", () => {
  it("returns immediately when the repair succeeds", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(runTimedServiceRepairWithRetry(operation, { wait: vi.fn() }))
      .resolves.toEqual({ value: "ok", attempts: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("absorbs a transient failure and succeeds on a later attempt", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("D1_ERROR: transient read failure"))
      .mockResolvedValue("recovered");
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(runTimedServiceRepairWithRetry(operation, { wait }))
      .resolves.toEqual({ value: "recovered", attempts: 2 });
    expect(wait).toHaveBeenCalledWith(100);
  });

  it("reports the original error and attempt count after exhaustion", async () => {
    const originalError = new Error("Failed query: select packageId");
    const operation = vi.fn().mockRejectedValue(originalError);

    const failure = await runTimedServiceRepairWithRetry(operation, {
      maxAttempts: 3,
      wait: vi.fn(),
    }).catch((error) => error);

    expect(failure).toBeInstanceOf(TimedServiceRepairRetryError);
    expect(failure).toMatchObject({ attempts: 3, originalError });
  });

  it("does not retry errors classified as non-transient", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("no such column"));

    const failure = await runTimedServiceRepairWithRetry(operation, {
      shouldRetry: () => false,
      wait: vi.fn(),
    }).catch((error) => error);

    expect(failure).toMatchObject({ attempts: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
