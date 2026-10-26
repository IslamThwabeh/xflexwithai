import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    getUnreadStaffNotificationBadges: vi.fn(),
    getArchivedStaffNotifications: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(userId = 9) {
  return appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/staffNotifications.badgeCounts" },
    user: {
      id: userId,
      email: `staff${userId}@example.com`,
      passwordHash: "",
      name: "Staff",
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

describe("staff notification badge route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    vi.mocked(db.getUnreadStaffNotificationBadges).mockResolvedValue({
      total: 5,
      byRoute: { "/admin/support": 3, "/admin/orders": 2 },
    });
    vi.mocked(db.getArchivedStaffNotifications).mockResolvedValue({
      items: [], total: 0, limit: 25, offset: 0,
    });
  });

  it("returns the combined badge response for authorized staff", async () => {
    await expect(createCaller().staffNotifications.badgeCounts()).resolves.toEqual({
      total: 5,
      byRoute: { "/admin/support": 3, "/admin/orders": 2 },
    });
    expect(db.getUnreadStaffNotificationBadges).toHaveBeenCalledWith(9);
  });

  it("retains staff authorization on the combined endpoint", async () => {
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);

    await expect(createCaller().staffNotifications.badgeCounts()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.getUnreadStaffNotificationBadges).not.toHaveBeenCalled();
  });

  it('allows the expert to read personal badges without granting general support access', async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_id, roles) => roles.includes('live_expert'));
    await expect(createCaller().staffNotifications.badgeCounts()).resolves.toMatchObject({ total: 5 });
    await expect(createCaller().supportChat.listAll()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("returns bounded archive history for authorized staff", async () => {
    await expect(createCaller().staffNotifications.archive({ limit: 25, offset: 50 }))
      .resolves.toEqual({ items: [], total: 0, limit: 25, offset: 0 });
    expect(db.getArchivedStaffNotifications).toHaveBeenCalledWith(9, 25, 50);
  });

  it("retains staff authorization on archive history", async () => {
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    await expect(createCaller().staffNotifications.archive({ limit: 25, offset: 0 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getArchivedStaffNotifications).not.toHaveBeenCalled();
  });
});
