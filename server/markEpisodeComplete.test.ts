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

  it("uses seconds-based watch threshold so episode one can complete at 70% watch time", async () => {
    const caller = createAuthedCaller();
    getUserEpisodeProgress.mockResolvedValue({
      id: 501,
      userId: 123,
      episodeId: 1,
      watchedDuration: 70,
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
        watchedDuration: 70,
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
      watchedDuration: 59,
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
      watchedDuration: 60,
      isCompleted: false,
    } as any);

    const result = await caller.enrollments.markEpisodeComplete({
      courseId: 1,
      episodeId: 1,
      watchedDuration: 100,
    });

    expect(result).toMatchObject({ success: true, progressPercentage: 50, reachedHalfway: true });
    expect(createOrUpdateEpisodeProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedDuration: 100,
        isCompleted: true,
      })
    );
  });
});