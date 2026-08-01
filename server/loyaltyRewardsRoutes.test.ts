import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual =
    await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminSetting: vi.fn(),
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    listLoyaltyRewardItemsForStudent: vi.fn(),
    listMyLoyaltyRewardRedemptions: vi.fn(),
    requestLoyaltyRewardRedemption: vi.fn(),
    getLoyaltyPointStudent: vi.fn(),
    adjustStudentPointsAtomic: vi.fn(),
    searchLoyaltyPointStudents: vi.fn(),
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

    await expect(createCaller().points.rewardsAvailability()).resolves.toEqual({
      enabled: false,
    });
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

    await expect(
      createCaller().points.redeemReward({ rewardItemId: 1 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient points balance",
    });
  });

  it("maps duplicate active reward requests to conflict", async () => {
    vi.mocked(db.requestLoyaltyRewardRedemption).mockResolvedValue({
      status: "already_pending",
    } as any);

    await expect(
      createCaller().points.redeemReward({ rewardItemId: 1 })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A request for this reward is already pending",
    });
  });

  it("creates a reward redemption for the signed-in student", async () => {
    vi.mocked(db.requestLoyaltyRewardRedemption).mockResolvedValue({
      status: "created",
      redemption: { id: 3, userId: 9, rewardItemId: 1 },
    } as any);

    await expect(
      createCaller().points.redeemReward({ rewardItemId: 1 })
    ).resolves.toEqual({ id: 3, userId: 9, rewardItemId: 1 });
    expect(db.requestLoyaltyRewardRedemption).toHaveBeenCalledWith({
      rewardItemId: 1,
      userId: 9,
    });
  });

  it("keeps reward catalog management limited to admins or loyalty managers", async () => {
    await expect(
      createCaller().points.createRewardItem({
        titleEn: "Coaching call",
        titleAr: "جلسة تدريب",
        pointsCost: 500,
        isActive: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createLoyaltyRewardItem).not.toHaveBeenCalled();
  });

  it("keeps the bounded student points picker limited to rewards operators", async () => {
    await expect(
      createCaller().points.searchStudents({ query: "st", limit: 12 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.searchLoyaltyPointStudents).not.toHaveBeenCalled();
  });

  it("returns only the bounded points-picker fields to a rewards manager", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(
      async (_userId: number, roles: string[]) =>
        roles.includes("loyalty_rewards_manager")
    );
    vi.mocked(db.searchLoyaltyPointStudents).mockResolvedValue([
      {
        id: 17,
        name: "Student One",
        email: "student@example.com",
        pointsBalance: 250,
      },
    ]);

    await expect(
      createCaller(33, "rewards@example.com").points.searchStudents({
        query: "student",
        limit: 12,
      })
    ).resolves.toEqual([
      {
        id: 17,
        name: "Student One",
        email: "student@example.com",
        pointsBalance: 250,
      },
    ]);
    expect(db.searchLoyaltyPointStudents).toHaveBeenCalledWith("student", 12);
  });

  it("refuses point adjustments for non-student targets", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.getLoyaltyPointStudent).mockResolvedValue(null);

    await expect(
      createCaller(1, "admin@example.com").points.award({
        userId: 99,
        amount: 25,
        reasonEn: "Manual correction",
        reasonAr: "تصحيح يدوي",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Student points account not found",
    });
    expect(db.adjustStudentPointsAtomic).not.toHaveBeenCalled();
  });

  it("records validated admin adjustments with the acting operator", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.getLoyaltyPointStudent).mockResolvedValue({
      id: 17,
      name: "Student One",
      email: "student@example.com",
      pointsBalance: 250,
    });
    vi.mocked(db.adjustStudentPointsAtomic).mockResolvedValue({ id: 3 } as any);

    await expect(
      createCaller(1, "admin@example.com").points.award({
        userId: 17,
        amount: 25,
        reasonEn: "  Manual correction  ",
        reasonAr: "  تصحيح يدوي  ",
      })
    ).resolves.toEqual({ id: 3 });
    expect(db.adjustStudentPointsAtomic).toHaveBeenCalledWith({
      userId: 17,
      amount: 25,
      reasonEn: "Manual correction",
      reasonAr: "تصحيح يدوي",
      direction: "award",
      actorUserId: 1,
    });
  });

  it("maps a concurrent deduction balance conflict without a partial success", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.getLoyaltyPointStudent).mockResolvedValue({
      id: 17,
      name: "Student One",
      email: "student@example.com",
      pointsBalance: 250,
    });
    vi.mocked(db.adjustStudentPointsAtomic).mockResolvedValue(null);

    await expect(
      createCaller(1, "admin@example.com").points.deduct({
        userId: 17,
        amount: 200,
        reasonEn: "Manual correction",
        reasonAr: "تصحيح يدوي",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient points balance",
    });
    expect(db.adjustStudentPointsAtomic).toHaveBeenCalledWith({
      userId: 17,
      amount: 200,
      reasonEn: "Manual correction",
      reasonAr: "تصحيح يدوي",
      direction: "deduct",
      actorUserId: 1,
    });
  });

  it("allows admins to create reward items", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.createLoyaltyRewardItem).mockResolvedValue({
      id: 1,
      pointsCost: 500,
    } as any);

    await expect(
      createCaller(1, "admin@example.com").points.createRewardItem({
        titleEn: "Coaching call",
        titleAr: "جلسة تدريب",
        pointsCost: 500,
        stockQuantity: null,
        isActive: false,
      })
    ).resolves.toEqual({ id: 1, pointsCost: 500 });
    expect(db.createLoyaltyRewardItem).toHaveBeenCalledWith(
      expect.objectContaining({
        titleEn: "Coaching call",
        actorUserId: 1,
      })
    );
  });

  it("allows loyalty rewards managers to create reward items", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(
      async (_userId: number, roles: string[]) =>
        roles.includes("loyalty_rewards_manager")
    );
    vi.mocked(db.createLoyaltyRewardItem).mockResolvedValue({
      id: 1,
      pointsCost: 500,
    } as any);

    await expect(
      createCaller(33, "rewards@example.com").points.createRewardItem({
        titleEn: "Coaching call",
        titleAr: "جلسة تدريب",
        pointsCost: 500,
        stockQuantity: null,
        isActive: false,
      })
    ).resolves.toEqual({ id: 1, pointsCost: 500 });
    expect(db.createLoyaltyRewardItem).toHaveBeenCalledWith(
      expect.objectContaining({
        titleEn: "Coaching call",
        actorUserId: 33,
      })
    );
  });

  it("allows authorized operators to prepare inactive reward drafts while launch is off", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.listLoyaltyRewardItemsForAdmin).mockResolvedValue([
      { id: 1, titleEn: "Draft reward", isActive: false },
    ] as any);
    vi.mocked(db.createLoyaltyRewardItem).mockResolvedValue({
      id: 2,
      isActive: false,
    } as any);
    vi.mocked(db.updateLoyaltyRewardItem).mockResolvedValue({
      id: 1,
      pointsCost: 600,
      isActive: false,
    } as any);
    const caller = createCaller(1, "admin@example.com").points;

    await expect(caller.adminRewardItems()).resolves.toEqual([
      { id: 1, titleEn: "Draft reward", isActive: false },
    ]);
    await expect(
      caller.createRewardItem({
        titleEn: "Coaching call",
        titleAr: "جلسة تدريب",
        pointsCost: 500,
        isActive: false,
      })
    ).resolves.toEqual({ id: 2, isActive: false });
    await expect(
      caller.updateRewardItem({ id: 1, pointsCost: 600 })
    ).resolves.toEqual({ id: 1, pointsCost: 600, isActive: false });
  });

  it("rejects publishing a reward while the student catalog is off", async () => {
    vi.mocked(db.getAdminSetting).mockResolvedValue("false");
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    const caller = createCaller(1, "admin@example.com").points;

    await expect(
      caller.createRewardItem({
        titleEn: "Coaching call",
        titleAr: "جلسة تدريب",
        pointsCost: 500,
        isActive: true,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Enable Loyalty Rewards before publishing a reward",
    });
    await expect(
      caller.updateRewardItem({ id: 1, isActive: true })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createLoyaltyRewardItem).not.toHaveBeenCalled();
    expect(db.updateLoyaltyRewardItem).not.toHaveBeenCalled();
  });

  it("maps invalid redemption review status to conflict", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);
    vi.mocked(db.reviewLoyaltyRewardRedemption).mockResolvedValue({
      status: "invalid_status",
    } as any);

    await expect(
      createCaller(1, "admin@example.com").points.reviewRewardRedemption({
        id: 7,
        decision: "approved",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires an operator reason before rejecting and refunding a redemption", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
    } as any);

    await expect(
      createCaller(1, "admin@example.com").points.reviewRewardRedemption({
        id: 7,
        decision: "rejected",
        adminNote: "   ",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A rejection reason is required",
    });
    expect(db.reviewLoyaltyRewardRedemption).not.toHaveBeenCalled();
  });
});
