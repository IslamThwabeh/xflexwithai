import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual =
    await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    resolveFinanceActor: vi.fn(),
    getFinancialControlWorkspace: vi.fn(),
    getFinancialControlEntryPage: vi.fn(),
    getFinancialCorrectionPreview: vi.fn(),
    createFinancialAdjustmentDraft: vi.fn(),
    updateFinancialAdjustmentDraft: vi.fn(),
    submitFinancialAdjustment: vi.fn(),
    reviewFinancialAdjustment: vi.fn(),
    setFinancialPeriodLock: vi.fn(),
    reverseFinancialLedgerEntry: vi.fn(),
    reclassifyFinancialPaymentPurpose: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import type { FinanceActor } from "../backend/services/financial-expense.service";
import { FinancialCorrectionReviewError } from "../backend/services/financial-control-review.service";

const user = {
  id: 20,
  email: "finance@example.com",
  name: "Finance",
  isStaff: true,
} as any;
const actor = (access: FinanceActor["access"]): FinanceActor => ({
  actorType: access === "owner" ? "admin" : "staff",
  actorId: access === "owner" ? 1 : 20,
  access,
});
function caller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/financialControls" },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("financial control route authorization", () => {
  it("skips legacy correction-source loading when the new bounded picker is used", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    await caller().financialControls.workspace({
      viewerId: 20,
      access: "owner",
      includeLegacyEntries: false,
    });
    expect(db.getFinancialControlWorkspace).toHaveBeenCalledWith(
      actor("owner"),
      undefined,
      { includeReversibleEntries: false }
    );
  });
  it("scopes bounded entry and preview reads to the owner and signed-in user", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    vi.mocked(db.getFinancialControlEntryPage).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    vi.mocked(db.getFinancialCorrectionPreview).mockResolvedValue({
      original: { id: 1 },
    } as any);
    const scope = { viewerId: 20, access: "owner" as const },
      request = {
        action: "reverse" as const,
        entryId: 1,
        effectiveDate: "2026-07-11",
        reason: "Source reviewed",
      };
    await expect(
      caller().financialControls.entries({ ...scope, ledgerId: 1 })
    ).resolves.toMatchObject({ viewerId: 20, access: "owner", items: [] });
    await expect(
      caller().financialControls.previewCorrection({ ...scope, request })
    ).resolves.toMatchObject({
      viewerId: 20,
      access: "owner",
      original: { id: 1 },
    });
    expect(db.getFinancialControlEntryPage).toHaveBeenCalledWith(
      actor("owner"),
      { ...scope, limit: 20, ledgerId: 1 }
    );
    expect(db.getFinancialCorrectionPreview).toHaveBeenCalledWith(
      actor("owner"),
      request
    );
  });
  it.each(["owner", "manager"] as const)(
    "rejects invalid viewer scope before %s correction-source reads",
    async access => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor(access));
      await expect(
        caller().financialControls.entries({ viewerId: 21, access })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller().financialControls.previewCorrection({
          viewerId: 21,
          access,
          request: {
            action: "reverse",
            entryId: 1,
            effectiveDate: "2026-07-11",
            reason: "Reviewed source",
          },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.getFinancialControlEntryPage).not.toHaveBeenCalled();
      expect(db.getFinancialCorrectionPreview).not.toHaveBeenCalled();
    }
  );
  it("keeps manager correction-source access read-blocked and rejects unbounded owner requests", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("manager"));
    await expect(
      caller().financialControls.entries({ viewerId: 20, access: "manager" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    await expect(
      caller().financialControls.entries({
        viewerId: 20,
        access: "owner",
        limit: 100,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getFinancialControlEntryPage).not.toHaveBeenCalled();
  });
  it("returns a useful conflict when the reviewed period lock changes", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    vi.mocked(db.reverseFinancialLedgerEntry).mockRejectedValueOnce(
      new FinancialCorrectionReviewError(
        "CONFLICT",
        "Preview again after the period lock changed"
      )
    );
    await expect(
      caller().financialControls.reverseEntry({
        entryId: 1,
        effectiveDate: "2026-07-11",
        reason: "Source reviewed",
        expectedPeriodLocked: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.reverseFinancialLedgerEntry).toHaveBeenCalledWith({
      actor: actor("owner"),
      entryId: 1,
      effectiveDate: "2026-07-11",
      reason: "Source reviewed",
      expectedPeriodLocked: false,
    });
  });
  it("binds workspace reads to the signed-in user rather than the finance actor primary key", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    await expect(
      caller().financialControls.workspace({ viewerId: 20, access: "owner" })
    ).resolves.toMatchObject({
      viewerId: 20,
      access: "owner",
      generatedAt: expect.any(String),
    });
    expect(db.getFinancialControlWorkspace).toHaveBeenCalledWith(
      actor("owner")
    );
  });

  it.each([
    { viewerId: 1, access: "owner" },
    { viewerId: 21, access: "owner" },
    { viewerId: 20, access: "manager" },
  ] as const)(
    "rejects a stale or spoofed control workspace scope %o before reading financial records",
    async input => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
      await expect(
        caller().financialControls.workspace(input)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.getFinancialControlWorkspace).not.toHaveBeenCalled();
    }
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.getFinancialControlWorkspace).mockResolvedValue({
      adjustments: [],
      locks: [],
      reversibleEntries: [],
    } as any);
    vi.mocked(db.reviewFinancialAdjustment).mockResolvedValue({
      adjustment: { id: 1 },
      idempotent: false,
    } as any);
    vi.mocked(db.setFinancialPeriodLock).mockResolvedValue({
      lock: null,
      idempotent: false,
    } as any);
    vi.mocked(db.reverseFinancialLedgerEntry).mockResolvedValue({
      reversal: { id: 2 },
      replacement: null,
      idempotent: false,
    } as any);
    vi.mocked(db.reclassifyFinancialPaymentPurpose).mockResolvedValue({
      entries: [{ id: 2 }, { id: 3 }],
      idempotent: false,
    } as any);
  });

  it.each(["new_sale", "renewal", "upgrade", "copier_subscription"] as const)(
    "accepts the shared %s receipt category for the owner",
    async nextPurpose => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
      await caller().financialControls.reclassifyPayment({
        entryId: 1,
        nextPurpose,
        reason: "Owner verified the recorded service category",
      });
      expect(db.reclassifyFinancialPaymentPurpose).toHaveBeenCalledWith({
        actor: actor("owner"),
        entryId: 1,
        nextPurpose,
        reason: "Owner verified the recorded service category",
      });
    }
  );

  it.each([null, "clerk", "viewer", "manager"] as const)(
    "keeps Copier reclassification unavailable to %s authority",
    async access => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(
        access ? actor(access) : null
      );
      await expect(
        caller().financialControls.reclassifyPayment({
          entryId: 1,
          nextPurpose: "copier_subscription",
          reason: "Attempted category correction",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.reclassifyFinancialPaymentPurpose).not.toHaveBeenCalled();
    }
  );

  it("rejects non-receipt purposes before invoking the correction workflow", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    await expect(
      caller().financialControls.reclassifyPayment({
        entryId: 1,
        nextPurpose: "legacy_migration" as any,
        reason: "Cannot turn cash into nonfinancial migration",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.reclassifyFinancialPaymentPurpose).not.toHaveBeenCalled();
  });

  it.each([null, "clerk", "viewer"] as const)(
    "denies workspace access to %s authority",
    async access => {
      vi.mocked(db.resolveFinanceActor).mockResolvedValue(
        access ? actor(access) : null
      );
      await expect(
        caller().financialControls.workspace()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );

  it("allows a manager to prepare and independently review, but not lock or reverse", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("manager"));
    await expect(caller().financialControls.workspace()).resolves.toMatchObject(
      {
        access: "manager",
        canReverse: false,
        canManageLocks: false,
      }
    );
    await caller().financialControls.reviewAdjustment({
      adjustmentId: 1,
      decision: "approved",
      reason: "Reviewed independently",
    });
    expect(db.reviewFinancialAdjustment).toHaveBeenCalledWith({
      actor: actor("manager"),
      adjustmentId: 1,
      decision: "approved",
      reason: "Reviewed independently",
    });
    await expect(
      caller().financialControls.setPeriodLock({
        month: "2026-07",
        action: "locked",
        reason: "Monthly close",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().financialControls.reverseEntry({
        entryId: 1,
        effectiveDate: "2026-09-11",
        reason: "Correction needed",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().financialControls.reclassifyPayment({
        entryId: 1,
        nextPurpose: "renewal",
        reason: "Verified renewal",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.setFinancialPeriodLock).not.toHaveBeenCalled();
    expect(db.reverseFinancialLedgerEntry).not.toHaveBeenCalled();
  });

  it("allows only the explicit owner to lock periods and append reversals", async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor("owner"));
    await caller().financialControls.setPeriodLock({
      month: "2026-07",
      action: "locked",
      reason: "Monthly close",
    });
    await caller().financialControls.reverseEntry({
      entryId: 1,
      effectiveDate: "2026-09-11",
      reason: "Owner-approved correction",
      replacementAmountIlsMinor: 9000,
      replacementDescription: "Corrected entry",
    });
    await caller().financialControls.reclassifyPayment({
      entryId: 1,
      nextPurpose: "renewal",
      reason: "Verified renewal",
    });
    expect(db.setFinancialPeriodLock).toHaveBeenCalledWith({
      actor: actor("owner"),
      month: "2026-07",
      action: "locked",
      reason: "Monthly close",
    });
    expect(db.reverseFinancialLedgerEntry).toHaveBeenCalledWith({
      actor: actor("owner"),
      entryId: 1,
      effectiveDate: "2026-09-11",
      reason: "Owner-approved correction",
      replacementAmountIlsMinor: 9000,
      replacementDescription: "Corrected entry",
    });
    expect(db.reclassifyFinancialPaymentPurpose).toHaveBeenCalledWith({
      actor: actor("owner"),
      entryId: 1,
      nextPurpose: "renewal",
      reason: "Verified renewal",
    });
  });
});
