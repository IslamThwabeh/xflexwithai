import { describe, expect, it } from "vitest";
import {
  getReplacementStaffSessionEnd,
  mapStaffSessionRow,
  zonedLocalTimeToUtc,
} from "../backend/db";

describe("staff monitoring session calculations", () => {
  it("ends an abandoned session exactly 15 minutes after its last interaction", () => {
    const loginAt = new Date("2026-06-20T08:00:00.000Z");
    const lastInteractionAt = new Date("2026-06-20T08:05:00.000Z");
    const row = mapStaffSessionRow({
      loginAt,
      logoutAt: null,
      endedAt: null,
      lastInteractionAt,
      endReason: null,
      durationSeconds: null,
    }, new Date("2026-06-20T08:21:00.000Z"));

    expect(row.status).toBe("timed_out");
    expect(row.effectiveLogoutAt?.toISOString()).toBe("2026-06-20T08:20:00.000Z");
    expect(row.currentDurationSeconds).toBe(20 * 60);
  });

  it("uses the hard session expiry when it arrives before the idle deadline", () => {
    const row = mapStaffSessionRow({
      loginAt: new Date("2026-06-20T08:00:00.000Z"),
      logoutAt: null,
      endedAt: null,
      lastInteractionAt: new Date("2026-06-20T08:58:00.000Z"),
      hardExpiresAt: new Date("2026-06-20T09:00:00.000Z"),
      endReason: null,
      durationSeconds: null,
    }, new Date("2026-06-20T09:01:00.000Z"));

    expect(row.sessionExpiresAt?.toISOString()).toBe("2026-06-20T09:00:00.000Z");
    expect(row.effectiveLogoutAt?.toISOString()).toBe("2026-06-20T09:00:00.000Z");
  });

  it("does not let a later login inflate an already timed-out session", () => {
    const replacement = getReplacementStaffSessionEnd(
      new Date("2026-06-20T08:05:00.000Z"),
      new Date("2026-06-20T12:00:00.000Z"),
    );

    expect(replacement.endReason).toBe("timeout");
    expect(replacement.endedAt.toISOString()).toBe("2026-06-20T08:20:00.000Z");
  });

  it("closes a still-active old session as replaced at the new login time", () => {
    const replacement = getReplacementStaffSessionEnd(
      new Date("2026-06-20T08:05:00.000Z"),
      new Date("2026-06-20T08:10:00.000Z"),
    );

    expect(replacement.endReason).toBe("replaced_login");
    expect(replacement.endedAt.toISOString()).toBe("2026-06-20T08:10:00.000Z");
  });
});

describe("staff schedule timezone conversion", () => {
  it("uses the configured timezone for Amman schedules", () => {
    expect(zonedLocalTimeToUtc("2026-06-20", "09:00", "Asia/Amman").toISOString())
      .toBe("2026-06-20T06:00:00.000Z");
  });

  it("respects daylight-saving transitions", () => {
    expect(zonedLocalTimeToUtc("2026-03-07", "09:00", "America/New_York").toISOString())
      .toBe("2026-03-07T14:00:00.000Z");
    expect(zonedLocalTimeToUtc("2026-03-08", "09:00", "America/New_York").toISOString())
      .toBe("2026-03-08T13:00:00.000Z");
  });
});
