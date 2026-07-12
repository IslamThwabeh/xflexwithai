import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    listLoyaltyRewardItemsForStudent: vi.fn(),
    listMyLoyaltyRewardRedemptions: vi.fn(),
    requestLoyaltyRewardRedemption: vi.fn(),
    listLoyaltyRewardItemsForAdmin: vi.fn(),
    createLoyaltyRewardItem: vi.fn(),
    updateLoyaltyRewardItem: vi.fn(),
    listLoyaltyRewardRedemptionsForAdmin: vi.fn(),
    reviewLoyaltyRewardRedemption: vi.fn(),
    fulfillLoyaltyRewardRedemption: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(userId = 9, email = `student${userId}@example.com`) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/points" },
    user: {
      id: userId,
      email,
      passwordHash: "",
      name: "Student",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: false,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("loyalty rewards routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminSetting).mockImplementation(async (key: string) => {
      if (key === "loyalty_rewards_enabled") return "true";
      return null;
    });
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
  });

  it("reports disabled rewards availability", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().points.rewardsAvailability()).resolves.toEqual({ enabled: false });
  });

  it("blocks reward catalog while the feature flag is disabled", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");

    await expect(createCaller().points.rewardCatalog()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Loyalty rewards are disabled",
    });
    expect(db.listLoyaltyRewardItemsForStudent).not.toHaveBeenCalled();
  });

  it("lists the student reward catalog when enabled", async () => {
    vi.mocked(db.listLoyaltyRewardItemsForStudent).mockResolvedValue([
      { id: 1, titleEn: "Coaching call", pointsCost: 500 },
    ] as any);

    await expect(createCaller().points.rewardCatalog()).resolves.toEqual([
      { id: 1, titleEn: "Coaching call", pointsCost: 500 },
    ]);
  });

  it("maps insufficient points during redemption", async () => {
    vi.mocked(db.requestLoyaltyRewardRedemption).mockResolvedValue({
      status: "insufficient_points",
    } as any);

    await expect(createCaller().points.redeemReward({ rewardItemId: 1 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "Insufficient points balance" });
  });

  it("creates a reward redemption for the signed-in student", async () => {
    vi.mocked(db.requestLoyaltyRewardRedemption).mockResolvedValue({
      status: "created",
      redemption: { id: 3, userId: 9, rewardItemId: 1 },
    } as any);

    await expect(createCaller().points.redeemReward({ rewardItemId: 1 }))
      .resolves.toEqual({ id: 3, userId: 9, rewardItemId: 1 });
    expect(db.requestLoyaltyRewardRedemption).toHaveBeenCalledWith({
      rewardItemId: 1,
      userId: 9,
    });
  });

  it("keeps reward catalog management limited to admins or loyalty managers", async () => {
    await expect(createCaller().points.createRewardItem({
      titleEn: "Coaching call",
      titleAr: "جلسة تدريب",
      pointsCost: 500,
      isActive: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createLoyaltyRewardItem).not.toHaveBeenCalled();
  });

  it("allows admins to create reward items", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.createLoyaltyRewardItem).mockResolvedValue({ id: 1, pointsCost: 500 } as any);

    await expect(createCaller(1, "admin@example.com").points.createRewardItem({
      titleEn: "Coaching call",
      titleAr: "جلسة تدريب",
      pointsCost: 500,
      stockQuantity: null,
      isActive: false,
    })).resolves.toEqual({ id: 1, pointsCost: 500 });
    expect(db.createLoyaltyRewardItem).toHaveBeenCalledWith(expect.objectContaining({
      titleEn: "Coaching call",
      actorUserId: 1,
    }));
  });

  it("allows loyalty rewards managers to create reward items", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId: number, roles: string[]) =>
      roles.includes("loyalty_rewards_manager")
    );
    vi.mocked(db.createLoyaltyRewardItem).mockResolvedValue({ id: 1, pointsCost: 500 } as any);

    await expect(createCaller(33, "rewards@example.com").points.createRewardItem({
      titleEn: "Coaching call",
      titleAr: "جلسة تدريب",
      pointsCost: 500,
      stockQuantity: null,
      isActive: false,
    })).resolves.toEqual({ id: 1, pointsCost: 500 });
    expect(db.createLoyaltyRewardItem).toHaveBeenCalledWith(expect.objectContaining({
      titleEn: "Coaching call",
      actorUserId: 33,
    }));
  });

  it("maps invalid redemption review status to conflict", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: "admin@example.com" } as any);
    vi.mocked(db.reviewLoyaltyRewardRedemption).mockResolvedValue({ status: "invalid_status" } as any);

    await expect(createCaller(1, "admin@example.com").points.reviewRewardRedemption({
      id: 7,
      decision: "approved",
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
