import { describe, expect, it } from "vitest";
import {
  getRemainingIdleDelay,
  USER_ACTIVITY_EVENTS,
} from "../frontend/src/hooks/useIdleTimeout";
import {
  IDLE_TIMEOUT_STAFF_MS,
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_HEARTBEAT_RETRY_MS,
  SESSION_IDLE_WARNING_MS,
} from "../shared/const";
import fs from "node:fs";
import path from "node:path";

describe("idle timeout activity tracking", () => {
  it("treats direct text input and IME composition as real activity", () => {
    expect(USER_ACTIVITY_EVENTS).toContain("input");
    expect(USER_ACTIVITY_EVENTS).toContain("beforeinput");
    expect(USER_ACTIVITY_EVENTS).toContain("compositionupdate");
    expect(USER_ACTIVITY_EVENTS).toContain("keydown");
  });

  it("uses activity from another tab to extend only the remaining idle window", () => {
    const timeoutMs = 15 * 60 * 1000;
    const now = Date.parse("2026-06-22T12:15:00.000Z");
    const anotherTabActivityAt = Date.parse("2026-06-22T12:14:30.000Z");

    expect(getRemainingIdleDelay(anotherTabActivityAt, now, timeoutMs))
      .toBe(14.5 * 60 * 1000);
  });

  it("does not grant time after the shared activity window has expired", () => {
    expect(getRemainingIdleDelay(1_000, 16_001, 15_000)).toBe(0);
  });

  it("keeps the staff policy at 15 minutes with a two-minute warning", () => {
    expect(IDLE_TIMEOUT_STAFF_MS).toBe(15 * 60 * 1000);
    expect(SESSION_IDLE_WARNING_MS).toBe(2 * 60 * 1000);
    expect(SESSION_HEARTBEAT_INTERVAL_MS).toBe(60 * 1000);
    expect(SESSION_HEARTBEAT_RETRY_MS).toBeLessThan(SESSION_HEARTBEAT_INTERVAL_MS);
  });

  it("synchronizes initial load and tab visibility activity with the server", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "frontend/src/hooks/useIdleTimeout.ts"),
      "utf8",
    );

    expect(source.match(/onActivityRef\.current\?\.\(\);/g)).toHaveLength(3);
    expect(source).toContain("Keep the server-side staff session aligned with the browser timer.");
  });
});
