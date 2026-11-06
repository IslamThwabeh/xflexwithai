import { describe, expect, it, vi } from "vitest";

import { buildTimedServiceAccessSummary } from "../backend/db";

describe("buildTimedServiceAccessSummary", () => {
  it("keeps an indefinite hold frozen after its old expiry when days are saved", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-01-10T12:00:00.000Z"));
      expect(buildTimedServiceAccessSummary({
        endDate: "2026-11-22T11:24:59.787Z",
        isPaused: true,
        pausedRemainingDays: 30,
        frozenUntil: null,
        pausedReason: "Manual financial hold",
      })).toMatchObject({ status: "frozen", daysLeft: null, frozenUntil: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not recover expired time from a zero or invalid pause balance", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-01-10T12:00:00.000Z"));
      for (const pausedRemainingDays of [0, -1, NaN]) {
        expect(buildTimedServiceAccessSummary({
          endDate: "2026-11-22T11:24:59.787Z", isPaused: true, pausedRemainingDays,
        }).status).toBe("expired");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a saved manual hold even while the service was awaiting activation", () => {
    expect(buildTimedServiceAccessSummary({
      isPendingActivation: true,
      isPaused: true,
      pausedRemainingDays: 30,
      frozenUntil: null,
    }).status).toBe("frozen");
  });

  it("returns expired when a frozen subscription is already past its end date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T12:00:00.000Z"));

    const summary = buildTimedServiceAccessSummary({
      endDate: "2026-05-04T11:59:59.000Z",
      isPaused: true,
      frozenUntil: "2026-05-10T00:00:00.000Z",
      pausedReason: "Support freeze",
    });

    expect(summary).toMatchObject({
      status: "expired",
      daysLeft: 0,
      hasHistory: true,
    });

    vi.useRealTimers();
  });

  it("keeps future frozen subscriptions in frozen status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T12:00:00.000Z"));

    const summary = buildTimedServiceAccessSummary({
      endDate: "2026-05-12T12:00:00.000Z",
      isPaused: true,
      frozenUntil: "2026-05-10T00:00:00.000Z",
      pausedReason: "Support freeze",
    });

    expect(summary).toMatchObject({
      status: "frozen",
      daysLeft: null,
      hasHistory: true,
    });

    vi.useRealTimers();
  });

  it("keeps a pending protection window pending even when its placeholder end date is earlier", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00.000Z"));

    const summary = buildTimedServiceAccessSummary({
      startDate: "2026-06-09T06:23:45.502Z",
      endDate: "2026-06-11T06:23:45.502Z",
      isPendingActivation: true,
    });

    expect(summary).toMatchObject({
      status: "pending",
      daysLeft: null,
      hasHistory: true,
    });

    vi.useRealTimers();
  });
});
