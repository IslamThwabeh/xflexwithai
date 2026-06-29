import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getEnrollmentByCourseAndUser: vi.fn(),
    getEpisodesByCourseId: vi.fn(),
    getUserEpisodeProgress: vi.fn(),
    createOrUpdateEpisodeProgress: vi.fn(),
    getUserCourseProgress: vi.fn(),
    getQuizForLevelWithQuestions: vi.fn(),
    hasUserPassedQuizLevel: vi.fn(),
    updateEnrollment: vi.fn(),
    isUserBrokerOnboardingComplete: vi.fn(),
    getPendingActivationStatus: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/enrollments.markEpisodeComplete",
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

describe("enrollments.markEpisodeComplete", () => {
  const getEnrollmentByCourseAndUser = vi.mocked(db.getEnrollmentByCourseAndUser);
  const getEpisodesByCourseId = vi.mocked(db.getEpisodesByCourseId);
  const getUserEpisodeProgress = vi.mocked(db.getUserEpisodeProgress);
  const createOrUpdateEpisodeProgress = vi.mocked(db.createOrUpdateEpisodeProgress);
  const getUserCourseProgress = vi.mocked(db.getUserCourseProgress);
  const getQuizForLevelWithQuestions = vi.mocked(db.getQuizForLevelWithQuestions);
  const hasUserPassedQuizLevel = vi.mocked(db.hasUserPassedQuizLevel);
  const updateEnrollment = vi.mocked(db.updateEnrollment);
  const isUserBrokerOnboardingComplete = vi.mocked(db.isUserBrokerOnboardingComplete);
  const getPendingActivationStatus = vi.mocked(db.getPendingActivationStatus);

  beforeEach(() => {
    vi.clearAllMocks();

    getEnrollmentByCourseAndUser.mockResolvedValue({ id: 99 } as any);
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100 },
      { id: 2, order: 2, duration: 100 },
    ] as any);
    createOrUpdateEpisodeProgress.mockResolvedValue(undefined as any);
    getUserCourseProgress.mockResolvedValue([{ episodeId: 1, isCompleted: true }] as any);
    getQuizForLevelWithQuestions.mockResolvedValue(undefined as any);
    hasUserPassedQuizLevel.mockResolvedValue(false);
    updateEnrollment.mockResolvedValue(undefined as any);
    isUserBrokerOnboardingComplete.mockResolvedValue(false);
    getPendingActivationStatus.mockResolvedValue({
      hasPending: true,
      lexai: null,
      recommendation: null,
      progressPercent: 0,
      canActivate: false,
      studyPeriodDays: 14,
      entitlementDays: 30,
      maxActivationDate: null,
    } as any);
  });

  it("uses a supportive seconds-based watch threshold so episode one can complete at 10% watch time with a 30s minimum", async () => {
    const caller = createAuthedCaller();
    getUserEpisodeProgress.mockResolvedValue({
      id: 501,
      userId: 123,
      episodeId: 1,
      watchedDuration: 30,
      isCompleted: false,
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 1,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 50, reachedHalfway: true });
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 123,
        episodeId: 1,
        courseId: 1,
        watchedDuration: 30,
        isCompleted: true,
      })
    );
  });

  it("still blocks completion below the watch threshold", async () => {
    const caller = createAuthedCaller();
    getUserEpisodeProgress.mockResolvedValue({
      id: 502,
      userId: 123,
      episodeId: 1,
      watchedDuration: 29,
      isCompleted: false,
    } as any);

    await expect(
      caller.enrollments.markEpisodeComplete({
        courseId: 1,
        episodeId: 1,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TRPCError>);

    expect(createOrUpdateEpisodeProgress).not.toHaveBeenCalled();
  });

  it("accepts the client-reported watched duration when the DB snapshot lags behind playback", async () => {
    const caller = createAuthedCaller();
    getUserEpisodeProgress.mockResolvedValue({
      id: 503,
      userId: 123,
      episodeId: 1,
      watchedDuration: 20,
      isCompleted: false,
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 1,
      watchedDuration: 45,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 50, reachedHalfway: true });
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedDuration: 45,
        isCompleted: true,
      })
    );
  });

  it("allows student confirmation to repair missing watch tracking below the soft threshold", async () => {
    const caller = createAuthedCaller();
    getUserEpisodeProgress.mockResolvedValue({
      id: 508,
      userId: 123,
      episodeId: 1,
      watchedDuration: 0,
      isCompleted: false,
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 1,
      watchedDuration: 0,
      studentConfirmedWatch: true,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 50, reachedHalfway: true });
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: 1,
        watchedDuration: 30,
        isCompleted: true,
      })
    );
  });

  it("allows student confirmation for a later episode when no quiz is configured", async () => {
    const caller = createAuthedCaller();
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100 },
      { id: 2, order: 2, duration: 100 },
      { id: 3, order: 3, duration: 100 },
    ] as any);
    getUserCourseProgress
      .mockResolvedValueOnce([{ episodeId: 1, isCompleted: true }] as any)
      .mockResolvedValueOnce([
        { episodeId: 1, isCompleted: true },
        { episodeId: 2, isCompleted: true },
      ] as any);
    getUserEpisodeProgress.mockResolvedValue({
      id: 509,
      userId: 123,
      episodeId: 2,
      watchedDuration: 0,
      isCompleted: false,
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 2,
      watchedDuration: 0,
      studentConfirmedWatch: true,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 67 });
    expect(getQuizForLevelWithQuestions).toHaveBeenCalledWith(1);
    expect(hasUserPassedQuizLevel).not.toHaveBeenCalled();
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: 2,
        watchedDuration: 30,
        isCompleted: true,
      })
    );
  });

  it("does not block completion when the configured quiz has no questions", async () => {
    const caller = createAuthedCaller();
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100 },
      { id: 2, order: 2, duration: 100 },
      { id: 3, order: 3, duration: 100 },
    ] as any);
    getUserEpisodeProgress.mockResolvedValue({
      id: 504,
      userId: 123,
      episodeId: 2,
      watchedDuration: 30,
      isCompleted: false,
    } as any);
    getUserCourseProgress
      .mockResolvedValueOnce([{ episodeId: 1, isCompleted: true }] as any)
      .mockResolvedValueOnce([
        { episodeId: 1, isCompleted: true },
        { episodeId: 2, isCompleted: true },
      ] as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 20,
      level: 1,
      title: "Lesson 1 Quiz",
      passingScore: 50,
      questions: [],
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 2,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 67 });
    expect(hasUserPassedQuizLevel).not.toHaveBeenCalled();
  });

  it("unlocks the next episode when the previous intro episode was watched enough but not marked complete", async () => {
    const caller = createAuthedCaller();
    getUserCourseProgress
      .mockResolvedValueOnce([{ episodeId: 1, isCompleted: false, watchedDuration: 30 }] as any)
      .mockResolvedValueOnce([
        { episodeId: 1, isCompleted: false, watchedDuration: 30 },
        { episodeId: 2, isCompleted: true },
      ] as any);
    getUserEpisodeProgress
      .mockResolvedValueOnce({
        id: 501,
        userId: 123,
        episodeId: 1,
        watchedDuration: 30,
        isCompleted: false,
      } as any)
      .mockResolvedValueOnce({
        id: 505,
        userId: 123,
        episodeId: 2,
        watchedDuration: 30,
        isCompleted: false,
      } as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 20,
      level: 1,
      title: "Lesson 1 Quiz",
      passingScore: 50,
      questions: [{ id: 200, questionText: "Ready?", orderNum: 1, options: [{ id: 1, optionId: "a", text: "Yes" }] }],
    } as any);
    hasUserPassedQuizLevel.mockResolvedValue(true);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 2,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 50 });
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: 2,
        isCompleted: true,
      }),
    );
  });

  it("does not let student confirmation bypass an unpassed required quiz", async () => {
    const caller = createAuthedCaller();
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100 },
      { id: 2, order: 2, duration: 100 },
    ] as any);
    getUserCourseProgress.mockResolvedValue([{ episodeId: 1, isCompleted: true }] as any);
    getUserEpisodeProgress.mockResolvedValue({
      id: 506,
      userId: 123,
      episodeId: 2,
      watchedDuration: 0,
      isCompleted: false,
    } as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 20,
      level: 1,
      title: "Lesson 1 Quiz",
      passingScore: 50,
      questions: [{ id: 200, questionText: "Ready?", orderNum: 1, options: [{ id: 1, optionId: "a", text: "Yes" }] }],
    } as any);
    hasUserPassedQuizLevel.mockResolvedValue(false);

    await expect(
      caller.enrollments.markEpisodeComplete({
        courseId: 1,
        episodeId: 2,
        watchedDuration: 0,
        studentConfirmedWatch: true,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Pass the episode quiz (50% required) before continuing.",
    } satisfies Partial<TRPCError>);

    expect(createOrUpdateEpisodeProgress).not.toHaveBeenCalled();
  });

  it("returns a structured blocker when the previous episode quiz is still required", async () => {
    const caller = createAuthedCaller();
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100, titleAr: "Intro", titleEn: "Intro" },
      { id: 2, order: 2, duration: 100, titleAr: "Basics", titleEn: "Basics" },
      { id: 3, order: 3, duration: 300, titleAr: "Terms", titleEn: "Terms" },
      { id: 4, order: 4, duration: 400, titleAr: "More terms", titleEn: "More terms" },
    ] as any);
    getUserEpisodeProgress.mockResolvedValue({
      id: 700,
      userId: 123,
      episodeId: 3,
      watchedDuration: 30,
      isCompleted: false,
    } as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 22,
      level: 2,
      title: "Previous Episode Quiz",
      passingScore: 50,
      questions: [{ id: 201, questionText: "Ready?", orderNum: 1, options: [{ id: 1, optionId: "a", text: "Yes" }] }],
    } as any);
    hasUserPassedQuizLevel.mockResolvedValue(false);

    const result = await caller.episodeQuiz.getForEpisode({
      courseId: 1,
      episodeId: 4,
    });

    expect(result).toMatchObject({
      required: false,
      passed: false,
      blocked: true,
      blockReason: "previous_quiz_required",
      previousEpisode: {
        id: 3,
        order: 3,
      },
      previousRequirement: {
        watchSatisfied: true,
        quizRequired: true,
        quizPassed: false,
        quizLevel: 2,
        quizTitle: "Previous Episode Quiz",
      },
      quiz: null,
    });
  });

  it("does not block a next episode when the previous episode has no attemptable quiz", async () => {
    const caller = createAuthedCaller();
    getEpisodesByCourseId.mockResolvedValue([
      { id: 1, order: 1, duration: 100, titleAr: "Intro", titleEn: "Intro" },
      { id: 2, order: 2, duration: 100, titleAr: "Basics", titleEn: "Basics" },
      { id: 3, order: 3, duration: 100, titleAr: "Terms", titleEn: "Terms" },
    ] as any);
    getUserEpisodeProgress.mockResolvedValue({
      id: 701,
      userId: 123,
      episodeId: 2,
      watchedDuration: 30,
      isCompleted: false,
    } as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 23,
      level: 1,
      title: "Empty Quiz",
      passingScore: 50,
      questions: [],
    } as any);

    const result = await caller.episodeQuiz.getForEpisode({
      courseId: 1,
      episodeId: 3,
    });

    expect(result).toMatchObject({
      required: false,
      passed: true,
      blocked: false,
      quiz: null,
    });
    expect(hasUserPassedQuizLevel).not.toHaveBeenCalled();
  });

  it("reports an empty/malformed episode quiz as not required", async () => {
    const caller = createAuthedCaller();
    getUserCourseProgress.mockResolvedValue([{ episodeId: 1, isCompleted: true }] as any);
    getQuizForLevelWithQuestions.mockResolvedValue({
      id: 20,
      level: 1,
      title: "Lesson 1 Quiz",
      passingScore: 50,
      questions: [{ id: 200, questionText: "Question without options", orderNum: 1, options: [] }],
    } as any);

    const result = await caller.episodeQuiz.getForEpisode({
      courseId: 1,
      episodeId: 2,
    });

    expect(result).toMatchObject({
      required: false,
      passed: true,
      introEpisode: false,
      quiz: null,
    });
    expect(hasUserPassedQuizLevel).not.toHaveBeenCalled();
  });
});
