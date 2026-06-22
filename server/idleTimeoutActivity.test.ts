import { describe, expect, it } from "vitest";
import {
  getRemainingIdleDelay,
  USER_ACTIVITY_EVENTS,
} from "../frontend/src/hooks/useIdleTimeout";

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
});
