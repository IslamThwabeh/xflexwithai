import { describe, expect, it } from "vitest";
import { hasCompletedCourseLearning } from "../frontend/src/lib/courseLearningProgress";

describe("student course completion display", () => {
  it("keeps a three-percent administrative exemption in the learning flow", () => {
    expect(
      hasCompletedCourseLearning({
        progressPercentage: 3,
        completedAt: "2026-07-01T10:00:00Z",
      })
    ).toBe(false);
    expect(
      hasCompletedCourseLearning({
        progressPercentage: 100,
        completedAt: "2026-07-01T10:00:00Z",
      })
    ).toBe(true);
  });

  it("requires completion confirmation and tolerates older incomplete snapshots", () => {
    expect(
      hasCompletedCourseLearning({ progressPercentage: 100, completedAt: null })
    ).toBe(false);
    expect(
      hasCompletedCourseLearning({
        progressPercentage: null,
        completedAt: "2026-07-01T10:00:00Z",
      })
    ).toBe(false);
    expect(hasCompletedCourseLearning({})).toBe(false);
  });
});
