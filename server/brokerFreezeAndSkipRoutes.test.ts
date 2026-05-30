import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    freezeUserSubscriptions: vi.fn(),
    unfreezeUserSubscriptions: vi.fn(),
    skipBrokerOnboardingForUser: vi.fn(),
    rollbackBrokerOnboardingSkip: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAdminCaller(path: string) {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path,
    },
    user: {
      id: 77,
      email: "admin@example.com",
      passwordHash: "",
      name: "Admin User",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: true,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("broker freeze and skip routes", () => {
  const getAdminByEmail = vi.mocked(db.getAdminByEmail);
  const freezeUserSubscriptions = vi.mocked(db.freezeUserSubscriptions);
  const unfreezeUserSubscriptions = vi.mocked(db.unfreezeUserSubscriptions);
  const skipBrokerOnboardingForUser = vi.mocked(db.skipBrokerOnboardingForUser);
  const rollbackBrokerOnboardingSkip = vi.mocked(db.rollbackBrokerOnboardingSkip);

  beforeEach(() => {
    vi.clearAllMocks();

    getAdminByEmail.mockResolvedValue({
      id: 11,
      email: "admin@example.com",
      name: "Admin",
    } as any);
  });

  it("forwards package freeze requests and returns the db result", async () => {
    const caller = createAdminCaller("/api/trpc/packageKeys.freeze");

    freezeUserSubscriptions.mockResolvedValue({
      lexaiPaused: true,
      recPaused: true,
    });

    await expect(
      caller.packageKeys.freeze({
        userId: 123,
        reason: "Manual freeze",
        frozenUntilDays: 14,
      })
    ).resolves.toEqual({
      success: true,
      lexaiPaused: true,
      recPaused: true,
    });

    expect(freezeUserSubscriptions).toHaveBeenCalledWith(123, "Manual freeze", 14);
  });

  it("forwards package unfreeze requests and returns the db result", async () => {
    const caller = createAdminCaller("/api/trpc/packageKeys.unfreeze");

    unfreezeUserSubscriptions.mockResolvedValue({
      lexaiResumed: true,
      recResumed: false,
    });

    await expect(
      caller.packageKeys.unfreeze({ userId: 123 })
    ).resolves.toEqual({
      success: true,
      lexaiResumed: true,
      recResumed: false,
    });

    expect(unfreezeUserSubscriptions).toHaveBeenCalledWith(123);
  });

  it("forwards broker skip requests with the acting admin id", async () => {
    const caller = createAdminCaller("/api/trpc/enrollments.skipBrokerOnboarding");

    skipBrokerOnboardingForUser.mockResolvedValue({
      success: true,
      brokerId: 9,
      activated: true,
    });

    await expect(
      caller.enrollments.skipBrokerOnboarding({ userId: 321 })
    ).resolves.toEqual({
      success: true,
      brokerId: 9,
      activated: true,
    });

    expect(skipBrokerOnboardingForUser).toHaveBeenCalledWith(321, 77);
  });

  it("forwards broker skip rollback requests with the acting admin id", async () => {
    const caller = createAdminCaller("/api/trpc/enrollments.rollbackBrokerSkip");

    rollbackBrokerOnboardingSkip.mockResolvedValue({ success: true });

    await expect(
      caller.enrollments.rollbackBrokerSkip({ userId: 321 })
    ).resolves.toEqual({ success: true });

    expect(rollbackBrokerOnboardingSkip).toHaveBeenCalledWith(321, 77);
  });
});