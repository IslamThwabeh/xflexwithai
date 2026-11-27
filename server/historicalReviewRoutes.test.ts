import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getAdminByEmail: vi.fn(),
  resolveFinanceActor: vi.fn(),
  hasAnyRole: vi.fn(),
  getHistoricalReviewItems: vi.fn(),
  getHistoricalReviewContext: vi.fn(),
  getHistoricalDecisionPreview: vi.fn(),
  getFinancialReconciliationDashboard: vi.fn(),
  updateFinancialReconciliationDraft: vi.fn(),
  resolveFinancialReconciliationItem: vi.fn(),
  getAllPackageKeysEnriched: vi.fn(),
  getAllPackages: vi.fn(),
  getPackageKeyStatistics: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { HistoricalReviewError } from "../backend/services/historical-review.service";
import type { FinanceActor } from "../backend/services/financial-expense.service";
const user = {
  id: 20,
  email: "finance@example.invalid",
  isStaff: true,
  name: "Synthetic reviewer",
} as any;
const actor = (access: FinanceActor["access"]): FinanceActor => ({
  actorType: access === "owner" ? "admin" : "staff",
  actorId: access === "owner" ? 1 : 20,
  access,
});
const caller = () =>
  appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/historical-review" },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
  vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
  vi.mocked(db.getHistoricalReviewItems).mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  vi.mocked(db.getHistoricalReviewContext).mockResolvedValue({
    item: { id: 1 },
    source: null,
    reviewVersion: "a".repeat(64),
    events: [],
    nextEventCursor: null,
  } as any);
  vi.mocked(db.getHistoricalDecisionPreview).mockResolvedValue({
    itemId: 1,
    reviewVersion: "a".repeat(64),
  } as any);
  vi.mocked(db.getAllPackages).mockResolvedValue([]);
  vi.mocked(db.getAllPackageKeysEnriched).mockResolvedValue([]);
});
describe("historical review authorization and compatibility", () => {
  it.each(["owner", "manager"] as const)(
    "allows %s bounded pages and skips legacy100-row reads for the new workspace",
    async access => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor(access));
      const result = await caller().financialReconciliation.items({
        viewerId: 20,
        access,
        status: "unresolved",
        exact: { type: "order", id: 202 },
      });
      expect(result).toMatchObject({ viewerId: 20, access, items: [] });
      expect(db.getHistoricalReviewItems).toHaveBeenCalledWith(
        actor(access),
        expect.objectContaining({
          limit: 20,
          exact: { type: "order", id: 202 },
        })
      );
      await caller().financialReconciliation.workspace({
        viewerId: 20,
        access,
        status: "unresolved",
        includeItems: false,
      });
      expect(db.getFinancialReconciliationDashboard).toHaveBeenCalledWith(
        "unresolved",
        undefined,
        { includeItems: false }
      );
    }
  );
  it.each(["clerk", "viewer"] as const)(
    "denies %s before reading review data",
    async access => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor(access));
      await expect(
        caller().financialReconciliation.items({
          viewerId: 20,
          access: "owner",
          status: "unresolved",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.getHistoricalReviewItems).not.toHaveBeenCalled();
    }
  );
  it("denies manager source/decision details and cross-viewer or stale-role reads before source queries", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("manager"));
    await expect(
      caller().financialReconciliation.sourceReview({
        viewerId: 20,
        access: "manager",
        itemId: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().financialReconciliation.decisionPreview({
        viewerId: 20,
        access: "manager",
        request: {
          itemId: 1,
          decision: "excluded",
          reason: "Verified evidence",
        },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().financialReconciliation.items({
        viewerId: 99,
        access: "manager",
        status: "unresolved",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().financialReconciliation.items({
        viewerId: 20,
        access: "owner",
        status: "unresolved",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getHistoricalReviewContext).not.toHaveBeenCalled();
    expect(db.getHistoricalDecisionPreview).not.toHaveBeenCalled();
    expect(db.getHistoricalReviewItems).not.toHaveBeenCalled();
  });
  it("returns verified scope and passes reviewed snapshot/period versions to the owner mutation", async () => {
    const source = await caller().financialReconciliation.sourceReview({
      viewerId: 20,
      access: "owner",
      itemId: 1,
    });
    expect(source).toMatchObject({
      viewerId: 20,
      access: "owner",
      item: { id: 1 },
    });
    await caller().financialReconciliation.resolveItem({
      itemId: 1,
      decision: "approved_adjustment",
      reason: "Verified genuine receipt",
      amountIlsMinor: 10000,
      effectiveDate: "2026-10-02",
      expectedReviewVersion: "a".repeat(64),
      expectedPeriodLocked: false,
    });
    expect(db.resolveFinancialReconciliationItem).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: actor("owner"),
        expectedReviewVersion: "a".repeat(64),
        expectedPeriodLocked: false,
      })
    );
  });
  it("maps a changed source to a friendly conflict rather than database details", async () => {
    vi.mocked(db.getHistoricalDecisionPreview).mockRejectedValue(
      new HistoricalReviewError(
        "CONFLICT",
        "A saved payment already covers this source."
      )
    );
    await expect(
      caller().financialReconciliation.decisionPreview({
        viewerId: 20,
        access: "owner",
        request: {
          itemId: 1,
          decision: "excluded",
          reason: "Verified evidence",
        },
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A saved payment already covers this source.",
    });
  });
  it("preserves the old workspace contract", async () => {
    await caller().financialReconciliation.workspace({ status: "unresolved" });
    expect(db.getFinancialReconciliationDashboard).toHaveBeenCalledWith(
      "unresolved"
    );
  });
  it("uses the existing key-management permission for a viewer-bound exact key query", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: user.email,
    } as any);
    await caller().packageKeys.list({ viewerId: 20, keyId: 77 });
    expect(db.getAllPackageKeysEnriched).toHaveBeenCalledWith(77);
    vi.mocked(db.getAllPackageKeysEnriched).mockClear();
    await expect(
      caller().packageKeys.list({ viewerId: 99, keyId: 77 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getAllPackageKeysEnriched).not.toHaveBeenCalled();
    await caller().packageKeys.list();
    expect(db.getAllPackageKeysEnriched).toHaveBeenCalledWith();
  });
});
