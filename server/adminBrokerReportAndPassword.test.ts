import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    getOnboardingRecordsPage: vi.fn(),
    getBrokerOnboardingReport: vi.fn(),
    updateAdminPassword: vi.fn(),
    logAdminAction: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { hashPassword, isAdminTokenValidForPasswordState, verifyPassword } from "../backend/_core/auth";

function createAdminCaller(clearCookie = vi.fn()) {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/admin",
    },
    user: {
      id: -11,
      email: "admin@example.com",
      passwordHash: "",
      name: "Admin",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie,
  } as any);
}

describe("admin broker report and onboarding paging routes", () => {
  const getAdminByEmail = vi.mocked(db.getAdminByEmail);
  const getOnboardingRecordsPage = vi.mocked(db.getOnboardingRecordsPage);
  const getBrokerOnboardingReport = vi.mocked(db.getBrokerOnboardingReport);

  beforeEach(() => {
    vi.clearAllMocks();
    getAdminByEmail.mockResolvedValue({
      id: 11,
      email: "admin@example.com",
      name: "Admin",
      passwordHash: "hash",
      passwordChangedAt: null,
    } as any);
  });

  it("returns paged onboarding records with server-side filters", async () => {
    getOnboardingRecordsPage.mockResolvedValue({
      rows: [{ id: 1, userEmail: "student@example.com", brokerName: "VT Markets" }],
      total: 37,
      limit: 10,
      offset: 20,
    } as any);

    const caller = createAdminCaller();
    await expect(caller.onboarding.recordsPage({
      status: "pending_review",
      step: "deposit",
      search: "student",
      fromDate: "2026-07-01",
      toDate: "2026-07-07 23:59:59",
      limit: 10,
      offset: 20,
    })).resolves.toMatchObject({ total: 37, limit: 10, offset: 20 });

    expect(getOnboardingRecordsPage).toHaveBeenCalledWith({
      status: "pending_review",
      step: "deposit",
      search: "student",
      fromDate: "2026-07-01",
      toDate: "2026-07-07 23:59:59",
      limit: 10,
      offset: 20,
    });
  });

  it("returns broker report aggregates from the report endpoint", async () => {
    getBrokerOnboardingReport.mockResolvedValue({
      rows: [{
        brokerId: 7,
        brokerNameEn: "VT Markets",
        brokerNameAr: "VT Markets",
        isActive: true,
        openedAccounts: 12,
        deposits: 9,
        conversionRate: 75,
        pendingProofs: 2,
        rejectedProofs: 1,
        lastOpenedApprovedAt: "2026-07-06T10:00:00.000Z",
        lastDepositApprovedAt: "2026-07-07T10:00:00.000Z",
      }],
      total: 1,
      totals: {
        openedAccounts: 12,
        deposits: 9,
        pendingProofs: 2,
        rejectedProofs: 1,
        activeBrokers: 1,
        inactiveBrokers: 0,
      },
      limit: 25,
      offset: 0,
    });

    const caller = createAdminCaller();
    await expect(caller.onboarding.report({
      brokerStatus: "active",
      sort: "deposits",
      sortDir: "desc",
    })).resolves.toMatchObject({
      totals: { openedAccounts: 12, deposits: 9 },
      rows: [{ brokerNameEn: "VT Markets", deposits: 9 }],
    });

    expect(getBrokerOnboardingReport).toHaveBeenCalledWith({
      brokerStatus: "active",
      sort: "deposits",
      sortDir: "desc",
    });
  });
});

describe("admin password renewal", () => {
  const getAdminByEmail = vi.mocked(db.getAdminByEmail);
  const updateAdminPassword = vi.mocked(db.updateAdminPassword);
  const logAdminAction = vi.mocked(db.logAdminAction);

  beforeEach(async () => {
    vi.clearAllMocks();
    getAdminByEmail.mockResolvedValue({
      id: 11,
      email: "admin@example.com",
      name: "Admin",
      passwordHash: await hashPassword("CurrentPass1"),
      passwordChangedAt: null,
    } as any);
    updateAdminPassword.mockResolvedValue({ passwordChangedAt: "2026-07-07T10:00:00.000Z" });
  });

  it("rejects the wrong current admin password", async () => {
    const caller = createAdminCaller();

    await expect(caller.auth.changeAdminPassword({
      currentPassword: "WrongPass1",
      newPassword: "NewStrong1",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" } satisfies Partial<TRPCError>);

    expect(updateAdminPassword).not.toHaveBeenCalled();
  });

  it("rejects weak new admin passwords", async () => {
    const caller = createAdminCaller();

    await expect(caller.auth.changeAdminPassword({
      currentPassword: "CurrentPass1",
      newPassword: "weakpass",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" } satisfies Partial<TRPCError>);

    expect(updateAdminPassword).not.toHaveBeenCalled();
  });

  it("updates the admin hash, logs the action, and clears the admin cookie", async () => {
    const clearCookie = vi.fn();
    const caller = createAdminCaller(clearCookie);

    await expect(caller.auth.changeAdminPassword({
      currentPassword: "CurrentPass1",
      newPassword: "NewStrong1",
    })).resolves.toMatchObject({
      success: true,
      passwordChangedAt: "2026-07-07T10:00:00.000Z",
    });

    expect(updateAdminPassword).toHaveBeenCalledWith(11, expect.any(String));
    const [, hashed] = updateAdminPassword.mock.calls[0];
    await expect(verifyPassword("NewStrong1", hashed)).resolves.toBe(true);
    expect(logAdminAction).toHaveBeenCalledWith(11, 11, "change_admin_password", expect.objectContaining({
      sessionsInvalidated: true,
    }));
    expect(clearCookie).toHaveBeenCalled();
  });

  it("invalidates admin tokens when passwordChangedAt no longer matches", () => {
    expect(isAdminTokenValidForPasswordState(
      { iat: 1783420000, adminPasswordChangedAt: null },
      { passwordChangedAt: null },
    )).toBe(true);

    expect(isAdminTokenValidForPasswordState(
      { iat: 1783420000, adminPasswordChangedAt: null },
      { passwordChangedAt: "2026-07-07T10:00:00.000Z" },
    )).toBe(false);

    expect(isAdminTokenValidForPasswordState(
      { iat: 1783420000, adminPasswordChangedAt: "2026-07-07T10:00:00.000Z" },
      { passwordChangedAt: "2026-07-07T10:00:00.000Z" },
    )).toBe(true);
  });
});
