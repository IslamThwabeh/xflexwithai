import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getUserActivePackage: vi.fn(),
    canAccessQuizLevel: vi.fn(),
    getQuizByLevel: vi.fn(),
    submitEpisodeQuizAttempt: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/userQuiz.submit",
    },
    user: {
      id: 123,
      email: "tester@example.com",
      passwordHash: "",
      name: "Test User",
      phone: null,
      emailVerified: false,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("userQuiz.submit", () => {
  const getUserActivePackage = vi.mocked(db.getUserActivePackage);
  const canAccessQuizLevel = vi.mocked(db.canAccessQuizLevel);
  const getQuizByLevel = vi.mocked(db.getQuizByLevel);
  const submitEpisodeQuizAttempt = vi.mocked(db.submitEpisodeQuizAttempt);

  beforeEach(() => {
    vi.clearAllMocks();
    getUserActivePackage.mockResolvedValue({ id: 1, package: null } as any);
    getQuizByLevel.mockResolvedValue({ id: 7, level: 2, passingScore: 50 } as any);
    submitEpisodeQuizAttempt.mockResolvedValue({ attemptId: 1, score: 100, passed: true } as any);
  });

  it("rejects quiz submission when the requested level is locked", async () => {
    const caller = createAuthedCaller();
    canAccessQuizLevel.mockResolvedValue(false);

    await expect(
      caller.userQuiz.submit({
        quizId: 7,
        level: 2,
        answers: [{ questionId: 10, optionId: "A" }],
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);

    expect(getQuizByLevel).not.toHaveBeenCalled();
    expect(submitEpisodeQuizAttempt).not.toHaveBeenCalled();
  });

  it("submits the quiz when the requested level is accessible", async () => {
    const caller = createAuthedCaller();
    canAccessQuizLevel.mockResolvedValue(true);

    const result = await caller.userQuiz.submit({
      quizId: 7,
      level: 2,
      answers: [{ questionId: 10, optionId: "A" }],
    });

    expect(result).toMatchObject({ attemptId: 1, score: 100, passed: true });
    expect(getQuizByLevel).toHaveBeenCalledWith(2);
    expect(submitEpisodeQuizAttempt).toHaveBeenCalledWith(123, 2, [{ questionId: 10, optionId: "A" }]);
  });
});