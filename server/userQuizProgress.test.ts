import { describe, expect, it } from "vitest";

import { buildUserQuizProgress } from "../backend/db";

describe("buildUserQuizProgress", () => {
  it("unlocks the next level when the previous level is passed even without a stored row for that next level", () => {
    const progress = buildUserQuizProgress(
      [
        {
          id: 1,
          level: 1,
          title: "Level 1",
          description: null,
          passingScore: 50,
        },
        {
          id: 2,
          level: 2,
          title: "Level 2",
          description: null,
          passingScore: 50,
        },
      ] as any,
      [
        {
          id: 10,
          userId: 33,
          quizId: 1,
          isUnlocked: true,
          isCompleted: true,
          bestScore: 100,
          bestPercentage: "100",
          attemptsCount: 2,
          lastAttemptAt: "2026-05-31T19:43:42.238Z",
          createdAt: "2026-05-31T19:42:01.870Z",
          updatedAt: "2026-05-31T19:43:42.238Z",
        },
      ] as any,
    );

    expect(progress).toEqual([
      expect.objectContaining({ level: 1, isUnlocked: true, isPassed: true, bestScore: 100 }),
      expect.objectContaining({ level: 2, isUnlocked: true, isPassed: false, bestScore: 0 }),
    ]);
  });

  it("treats a passing best score as passed even if the stored completion flag is stale", () => {
    const progress = buildUserQuizProgress(
      [
        {
          id: 1,
          level: 1,
          title: "Level 1",
          description: null,
          passingScore: 50,
        },
        {
          id: 2,
          level: 2,
          title: "Level 2",
          description: null,
          passingScore: 50,
        },
      ] as any,
      [
        {
          id: 10,
          userId: 33,
          quizId: 1,
          isUnlocked: true,
          isCompleted: false,
          bestScore: 83,
          bestPercentage: "83",
          attemptsCount: 1,
          lastAttemptAt: "2026-05-31T19:42:01.870Z",
          createdAt: "2026-05-31T19:42:01.870Z",
          updatedAt: "2026-05-31T19:42:01.870Z",
        },
      ] as any,
    );

    expect(progress).toEqual([
      expect.objectContaining({ level: 1, isUnlocked: true, isPassed: true, bestScore: 83 }),
      expect.objectContaining({ level: 2, isUnlocked: true, isPassed: false, bestScore: 0 }),
    ]);
  });
});