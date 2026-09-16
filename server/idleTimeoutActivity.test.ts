import { describe, expect, it } from "vitest";
import {
  getInitialActivityAt,
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

  it("preserves genuine activity across reloads and only resets after explicit login", () => {
    const now = Date.parse("2026-09-16T08:00:00.000Z");
    const sharedActivityAt = now - 10 * 60 * 1000;
    const freshLoginActivityAt = now - 1_000;

    expect(getInitialActivityAt(now, sharedActivityAt, null)).toBe(sharedActivityAt);
    expect(getInitialActivityAt(now, sharedActivityAt, freshLoginActivityAt))
      .toBe(freshLoginActivityAt);
    expect(getInitialActivityAt(now, null, null)).toBe(now);
  });

  it("keeps the staff policy at 15 minutes with a two-minute warning", () => {
    expect(IDLE_TIMEOUT_STAFF_MS).toBe(15 * 60 * 1000);
    expect(SESSION_IDLE_WARNING_MS).toBe(2 * 60 * 1000);
    expect(SESSION_HEARTBEAT_INTERVAL_MS).toBe(60 * 1000);
    expect(SESSION_HEARTBEAT_RETRY_MS).toBeLessThan(SESSION_HEARTBEAT_INTERVAL_MS);
  });

  it("does not treat initial load or tab visibility as activity", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "frontend/src/hooks/useIdleTimeout.ts"),
      "utf8",
    );

    expect(source.match(/onActivityRef\.current\?\.\(\);/g)).toHaveLength(1);
    expect(source).toContain("const lastActivityAtRef = useRef(0)");
    expect(source).toContain(
      "resetTimer(latestSharedActivityAt ?? lastActivityAtRef.current)",
    );
    expect(source).not.toContain("resetTimer(latestSharedActivityAt ?? Date.now())");
    expect(source).not.toContain("Mounting/reloading an authenticated app is itself a real interaction");
  });

  it("starts a fresh idle window only after successful password, admin, or OTP login", () => {
    const loginForm = fs.readFileSync(
      path.resolve(process.cwd(), "frontend/src/components/LoginForm.tsx"),
      "utf8",
    );
    const authPage = fs.readFileSync(
      path.resolve(process.cwd(), "frontend/src/pages/Auth.tsx"),
      "utf8",
    );

    expect(loginForm.match(/markFreshLoginActivity\(\);/g)).toHaveLength(2);
    expect(authPage).toContain("markFreshLoginActivity();");
  });
});
