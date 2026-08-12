import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    getUserRoles: vi.fn(),
    logStaffAction: vi.fn(),
    blockClientAccount: vi.fn(),
    restoreClientAccountAccess: vi.fn(),
    setClientRecommendationNotifications: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const supportUser = {
  id: 9,
  email: "support@example.com",
  passwordHash: "",
  name: "Support",
  phone: null,
  emailVerified: true,
  createdAt: "",
  updatedAt: "",
  lastSignedIn: "",
  isStaff: true,
};

function createCaller(user = supportUser) {
  return appRouter.createCaller({
    req: {
      headers: { "cf-connecting-ip": "203.0.113.15" },
      method: "POST",
      path: "/api/trpc/clientProfiles",
    },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("account access routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    vi.mocked(db.getUserRoles).mockResolvedValue([{ role: "support" }] as any);
    vi.mocked(db.blockClientAccount).mockResolvedValue({ ok: true } as any);
    vi.mocked(db.restoreClientAccountAccess).mockResolvedValue({ ok: true } as any);
    vi.mocked(db.setClientRecommendationNotifications).mockResolvedValue({ ok: true } as any);
  });

  it("passes a support actor and an ILS refund decision to the atomic service", async () => {
    const refundedAt = "2026-08-10T08:00:00.000Z";
    const result = await createCaller().clientProfiles.blockAccess({
      userId: 102,
      reason: "Refund approved after service complaint",
      deactivateServices: true,
      refund: {
        requestId: "f6e98a9d-3189-4ca5-91cb-b868c31f82d5",
        registrationKeyId: 123,
        amountIls: 700,
        method: "bank_transfer",
        reference: "Bank reference 42",
        refundedAt,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(db.blockClientAccount).toHaveBeenCalledWith({
      userId: 102,
      reason: "Refund approved after service complaint",
      deactivateServices: true,
      refund: {
        requestId: "f6e98a9d-3189-4ca5-91cb-b868c31f82d5",
        registrationKeyId: 123,
        amountIls: 700,
        method: "bank_transfer",
        reference: "Bank reference 42",
        refundedAt,
      },
      actor: { type: "support", id: 9 },
    });
  });

  it("uses the real admin identity when a full administrator performs the action", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 4, email: supportUser.email } as any);

    await createCaller().clientProfiles.blockAccess({
      userId: 102,
      reason: "Administrative access restriction",
      deactivateServices: false,
      refund: null,
    });

    expect(db.blockClientAccount).toHaveBeenCalledWith(expect.objectContaining({
      actor: { type: "admin", id: 4 },
    }));
  });

  it("rejects operators without the support role", async () => {
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    await expect(createCaller().clientProfiles.blockAccess({
      userId: 102,
      reason: "Unauthorized restriction attempt",
      deactivateServices: false,
      refund: null,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.blockClientAccount).not.toHaveBeenCalled();
  });

  it("requires an audited reason and validates the refund as ILS", async () => {
    await expect(createCaller().clientProfiles.blockAccess({
      userId: 102,
      reason: "bad",
      deactivateServices: false,
      refund: null,
    })).rejects.toBeDefined();

    await expect(createCaller().clientProfiles.blockAccess({
      userId: 102,
      reason: "Valid account restriction reason",
      deactivateServices: false,
      refund: {
        requestId: "777e9140-5a0e-4e9e-8b57-742a46555f7d",
        registrationKeyId: 123,
        amountIls: 0,
        method: "cash",
        refundedAt: "2026-08-10T08:00:00.000Z",
      },
    })).rejects.toBeDefined();
  });

  it("restores login separately without reversing services or refunds", async () => {
    await createCaller().clientProfiles.restoreAccess({
      userId: 102,
      reason: "Support review completed",
    });

    expect(db.restoreClientAccountAccess).toHaveBeenCalledWith({
      userId: 102,
      reason: "Support review completed",
      actor: { type: "support", id: 9 },
    });
  });

  it("allows only an admin-granted notification manager to update a client", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId, roles) => roles.includes("manage_client_notifications"));

    await createCaller().clientProfiles.setRecommendationNotifications({
      userId: 102,
      disabled: true,
      reason: "Client requested recommendation alerts to stop",
    });

    expect(db.setClientRecommendationNotifications).toHaveBeenCalledWith({
      userId: 102,
      disabled: true,
      reason: "Client requested recommendation alerts to stop",
      actor: { type: "support", id: 9 },
    });
  });

  it("does not grant notification control to ordinary support by default", async () => {
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId, roles) => !roles.includes("manage_client_notifications"));

    await expect(createCaller().clientProfiles.setRecommendationNotifications({
      userId: 102,
      disabled: true,
      reason: "Attempt without the dedicated permission",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.setClientRecommendationNotifications).not.toHaveBeenCalled();
  });
});
