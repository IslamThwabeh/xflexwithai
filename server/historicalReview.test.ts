import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { historicalReviewDatabase } from "./fixtures/historicalReviewDatabase";
import {
  getHistoricalSourceReview,
  historicalDraftVersion,
  listHistoricalReviewItems,
  previewHistoricalDecision,
  saveHistoricalDraft,
} from "../backend/services/historical-review.service";
import {
  getFinancialReconciliationDashboard,
  resolveFinancialReconciliationItem,
} from "../backend/db";
import {
  focusedPackageKeyId,
  formatHistoricalReviewDate,
  parseReconciliationIls,
  reconciliationLabel,
  reconciliationSourcePath,
} from "../shared/financialReconciliation";
import type { FinanceActor } from "../backend/services/financial-expense.service";

const owner: FinanceActor = { actorType: "admin", actorId: 1, access: "owner" },
  manager: FinanceActor = {
    actorType: "staff",
    actorId: 20,
    access: "manager",
  };
let fixture: Awaited<ReturnType<typeof historicalReviewDatabase>>;
beforeEach(async () => {
  fixture = await historicalReviewDatabase();
});
afterEach(() => {
  vi.restoreAllMocks();
  fixture.close();
});
const request = (itemId = 1) => ({
  itemId,
  decision: "approved_adjustment" as const,
  reason: "Genuine synthetic receipt independently verified",
  effectiveDate: "2026-10-02",
  amountIlsMinor: 10000,
});
const counts = async () => ({
  ledger: Number(
    await fixture.client
      .prepare("SELECT COUNT(*) AS n FROM financial_ledger_entries")
      .first("n")
  ),
  terminal: Number(
    await fixture.client
      .prepare(
        "SELECT COUNT(*) AS n FROM financial_reconciliation_events WHERE next_status IN ('excluded','approved_adjustment')"
      )
      .first("n")
  ),
});
function racingClient(change: () => Promise<unknown>): D1Database {
  let raced = false;
  return {
    ...fixture.client,
    batch: async statements => {
      if (!raced) {
        raced = true;
        await change();
      }
      return fixture.client.batch(statements);
    },
  } as D1Database;
}
describe("historical queue and source reads", () => {
  it("pages beyond the previous100 limit with tie-stable cursors and no duplicate rows", async () => {
    const ids: number[] = [];
    let before;
    do {
      const page = await listHistoricalReviewItems(fixture.client, manager, {
        status: "unresolved",
        before,
      });
      expect(page.items.length).toBeLessThanOrEqual(20);
      ids.push(...page.items.map(row => row.id));
      before = page.nextCursor ?? undefined;
    } while (before);
    expect(ids).toHaveLength(154);
    expect(new Set(ids).size).toBe(154);
    expect(ids.slice(0, 2)).toEqual([249, 248]);
    expect(ids).toContain(1);
  });
  it("applies exact source/item and classification filters without treating results as totals", async () => {
    const exact = await listHistoricalReviewItems(fixture.client, owner, {
      status: "unresolved",
      exact: { type: "order", id: 1 },
    });
    expect(exact.items.map(row => row.id)).toEqual([1]);
    expect(exact.items[0].draftVersion).toHaveLength(64);
    expect(
      (
        await listHistoricalReviewItems(fixture.client, owner, {
          status: "unresolved",
          exact: { type: "key", id: 10 },
        })
      ).items.map(row => row.id)
    ).toEqual([3]);
    expect(
      (
        await listHistoricalReviewItems(fixture.client, owner, {
          status: "unresolved",
          confidence: "medium",
          treatment: "historical_payment_known_date",
          sourceType: "order",
        })
      ).items.map(row => row.id)
    ).toEqual([1]);
    const sql = vi.spyOn(fixture.client, "prepare");
    const summary = await getFinancialReconciliationDashboard(
      "unresolved",
      fixture.orm,
      { includeItems: false }
    );
    expect(summary.items).toEqual([]);
    expect(summary.counts.unresolved).toBe(154);
    expect(sql.mock.calls.some(([query]) => query.includes("LIMIT 101"))).toBe(
      false
    );
  });
  it("uses existing ordered/source indexes and returns only one bounded page statement", async () => {
    const spy = vi.spyOn(fixture.client, "prepare");
    await listHistoricalReviewItems(fixture.client, owner, {
      status: "unresolved",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const query = spy.mock.calls[0][0];
    spy.mockRestore();
    const plan = await fixture.client
      .prepare("EXPLAIN QUERY PLAN " + query)
      .bind("unresolved", 21)
      .all();
    const details = JSON.stringify(plan.results);
    expect(details).toContain("idx_financial_reconciliation_status_updated");
    expect(details).not.toContain("TEMP B-TREE");
    const exactSpy = vi.spyOn(fixture.client, "prepare");
    await listHistoricalReviewItems(fixture.client, owner, {
      status: "unresolved",
      exact: { type: "order", id: 1 },
    });
    const exactQuery = exactSpy.mock.calls[0][0];
    exactSpy.mockRestore();
    expect(
      JSON.stringify(
        (
          await fixture.client
            .prepare("EXPLAIN QUERY PLAN " + exactQuery)
            .bind("unresolved", "1", 21)
            .all()
        ).results
      )
    ).toContain("idx_financial_reconciliation_source");
  });
  it("projects private source review and paged audit without receipt URLs, identities, key codes or metadata", async () => {
    const first = await getHistoricalSourceReview(fixture.client, owner, 1);
    expect(first.events).toHaveLength(20);
    expect(first.nextEventCursor).not.toBeNull();
    const next = await getHistoricalSourceReview(
      fixture.client,
      owner,
      1,
      first.nextEventCursor!
    );
    expect(next.events).toHaveLength(10);
    expect(
      new Set([...first.events, ...next.events].map(event => event.id)).size
    ).toBe(30);
    const key = await getHistoricalSourceReview(fixture.client, owner, 3);
    expect(key.source).toMatchObject({
      id: 10,
      kind: "key",
      nativeAmountMinor: 50000,
      currency: "USD",
      paymentConfirmed: 0,
    });
    const visible = JSON.stringify([first, next, key]);
    for (const privateValue of [
      "https://private.invalid",
      "private@example.invalid",
      "XFLEX-PRIVATE-KEY",
      "privateEmail",
    ])
      expect(visible).not.toContain(privateValue);
    expect(first.source?.proofAvailable).toBe(true);
  });
  it("keeps legacy/unknown source dates and categories explicit instead of inventing values", async () => {
    const review = await getHistoricalSourceReview(fixture.client, owner, 4);
    expect(formatHistoricalReviewDate(review.source?.createdAt, "en")).toBe(
      "Unknown"
    );
    expect(reconciliationLabel("new_unknown_code", "ar")).toContain(
      "تصنيف غير معروف"
    );
    expect(formatHistoricalReviewDate("2026-10-01 10:00:00", "en")).toBe(
      formatHistoricalReviewDate("2026-10-01T10:00:00Z", "en")
    );
  });
  it.each(["clerk", "viewer"] as const)(
    "denies %s before reading a queue/source",
    async role => {
      const spy = vi.spyOn(fixture.client, "prepare"),
        actor = { ...manager, access: role };
      await expect(
        listHistoricalReviewItems(fixture.client, actor, {
          status: "unresolved",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        getHistoricalSourceReview(fixture.client, actor, 1)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(spy).not.toHaveBeenCalled();
    }
  );
  it("keeps source and decision detail owner-only", async () => {
    const spy = vi.spyOn(fixture.client, "prepare");
    await expect(
      getHistoricalSourceReview(fixture.client, manager, 1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      previewHistoricalDecision(fixture.client, manager, request())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(spy).not.toHaveBeenCalled();
  });
});
describe("historical decisions and concurrent review changes", () => {
  it("previews without writes and recognizes exactly one documented receipt across retries", async () => {
    const before = await counts(),
      preview = await previewHistoricalDecision(
        fixture.client,
        owner,
        request()
      );
    expect(await counts()).toEqual(before);
    const input = {
      actor: owner,
      ...request(),
      expectedReviewVersion: preview.reviewVersion,
      expectedPeriodLocked: preview.periodLocked,
    };
    const first = await resolveFinancialReconciliationItem(input, fixture.orm);
    expect(first.item.status).toBe("approved_adjustment");
    expect(
      (await resolveFinancialReconciliationItem(input, fixture.orm)).idempotent
    ).toBe(true);
    expect(await counts()).toEqual({ ledger: 1, terminal: 1 });
  });
  it("requires a verified positive amount and genuine date; a proposal never fills either in", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      previewHistoricalDecision(fixture.client, owner, {
        ...request(),
        effectiveDate: tomorrow,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      previewHistoricalDecision(fixture.client, owner, {
        ...request(),
        effectiveDate: null,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const preview = await previewHistoricalDecision(
      fixture.client,
      owner,
      request()
    );
    await expect(
      resolveFinancialReconciliationItem(
        {
          actor: owner,
          ...request(),
          effectiveDate: tomorrow,
          expectedReviewVersion: preview.reviewVersion,
          expectedPeriodLocked: false,
        },
        fixture.orm
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      previewHistoricalDecision(fixture.client, owner, {
        ...request(),
        amountIlsMinor: -1,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      previewHistoricalDecision(fixture.client, owner, request(4))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await counts()).toEqual({ ledger: 0, terminal: 0 });
  });
  it("blocks recognition of a covered source for both new preview and legacy mutation callers", async () => {
    await expect(
      previewHistoricalDecision(fixture.client, owner, request(2))
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      resolveFinancialReconciliationItem(
        { actor: owner, ...request(2) },
        fixture.orm
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await counts()).toEqual({ ledger: 0, terminal: 0 });
  });
  it.each(["draft", "period", "payment", "source"] as const)(
    "atomically rejects a %s change after preview, rolling back ledger and terminal audit",
    async race => {
      const preview = await previewHistoricalDecision(
        fixture.client,
        owner,
        request()
      );
      const raceClient = racingClient(() =>
        race === "draft"
          ? fixture.client.exec(
              "UPDATE financial_reconciliation_items SET notes='Changed during review' WHERE id=1"
            )
          : race === "period"
            ? fixture.client.exec(
                "INSERT INTO financial_period_locks(month,locked_by_admin_id,note) VALUES('2026-10',1,'Newly closed')"
              )
            : race === "payment"
              ? fixture.client.exec(
                  "INSERT INTO order_payment_confirmations(order_id,paid_at,rationale,confirmed_by_type,source_type) VALUES(1,'2026-10-02','New receipt','admin','order_payment_new_sale')"
                )
              : fixture.client.exec(
                  "UPDATE orders SET paymentProofUrl='https://private.invalid/replaced-proof' WHERE id=1"
                )
      );
      await expect(
        resolveFinancialReconciliationItem(
          {
            actor: owner,
            ...request(),
            expectedReviewVersion: preview.reviewVersion,
            expectedPeriodLocked: preview.periodLocked,
          },
          drizzle(raceClient)
        )
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await counts()).toEqual({ ledger: 0, terminal: 0 });
    }
  );
  it("requires another preview when the proposal changed before the submission read", async () => {
    const preview = await previewHistoricalDecision(
      fixture.client,
      owner,
      request()
    );
    await fixture.client.exec(
      "UPDATE financial_reconciliation_items SET notes='Rechecked before submit' WHERE id=1"
    );
    await expect(
      resolveFinancialReconciliationItem(
        {
          actor: owner,
          ...request(),
          expectedReviewVersion: preview.reviewVersion,
          expectedPeriodLocked: false,
        },
        fixture.orm
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await counts()).toEqual({ ledger: 0, terminal: 0 });
  });
  it("allows an explicitly reviewed locked-month receipt while keeping the lock", async () => {
    await fixture.client.exec(
      "INSERT INTO financial_period_locks(month,locked_by_admin_id,note) VALUES('2026-10',1,'Closed')"
    );
    const preview = await previewHistoricalDecision(
      fixture.client,
      owner,
      request()
    );
    expect(preview.periodLocked).toBe(true);
    await resolveFinancialReconciliationItem(
      {
        actor: owner,
        ...request(),
        expectedReviewVersion: preview.reviewVersion,
        expectedPeriodLocked: true,
      },
      fixture.orm
    );
    expect(
      await fixture.client
        .prepare(
          "SELECT month FROM financial_period_locks WHERE month='2026-10'"
        )
        .first("month")
    ).toBe("2026-10");
  });
  it("excludes a missing candidate without a cash entry or deletion", async () => {
    const proposal = {
      itemId: 100,
      decision: "excluded" as const,
      reason: "No genuine payment evidence; preserve original review",
    };
    const preview = await previewHistoricalDecision(
      fixture.client,
      owner,
      proposal
    );
    expect(preview.amountIlsMinor).toBe(0);
    await resolveFinancialReconciliationItem(
      {
        actor: owner,
        ...proposal,
        expectedReviewVersion: preview.reviewVersion,
      },
      fixture.orm
    );
    expect(await counts()).toEqual({ ledger: 0, terminal: 1 });
    expect(
      await fixture.client
        .prepare("SELECT id FROM financial_reconciliation_items WHERE id=100")
        .first("id")
    ).toBe(100);
    await fixture.client.exec(
      "INSERT INTO financial_reconciliation_items(id,source_type,source_reference,issue_type,confidence_level,proposed_treatment) VALUES(500,'order','1abc','completed_order_without_cash_confirmation','low','requires_owner_review')"
    );
    const malformed = { ...proposal, itemId: 500 };
    const malformedPreview = await previewHistoricalDecision(
      fixture.client,
      owner,
      malformed
    );
    await resolveFinancialReconciliationItem(
      {
        actor: owner,
        ...malformed,
        expectedReviewVersion: malformedPreview.reviewVersion,
      },
      fixture.orm
    );
    expect(await counts()).toEqual({ ledger: 0, terminal: 2 });
  });
});
describe("proposal audit concurrency and exact source links", () => {
  it("saves a manager proposal once and rejects its stale retry without recognizing cash", async () => {
    const item = (
      await listHistoricalReviewItems(fixture.client, manager, {
        status: "unresolved",
        exact: { type: "item", id: 1 },
      })
    ).items[0];
    const input = {
      actor: manager,
      itemId: 1,
      proposedTreatment: "historical_payment_known_date",
      proposedAmountIlsMinor: 10000,
      notes: "Updated synthetic evidence",
      expectedDraftVersion: item.draftVersion,
    };
    await expect(
      saveHistoricalDraft(fixture.client, {
        ...input,
        proposedAmountIlsMinor: 0,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const updated = await saveHistoricalDraft(fixture.client, input);
    expect(historicalDraftVersion(updated!)).not.toBe(item.draftVersion);
    await expect(
      saveHistoricalDraft(fixture.client, input)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await counts()).toEqual({ ledger: 0, terminal: 0 });
    expect(
      await fixture.client
        .prepare(
          "SELECT COUNT(*) AS n FROM financial_reconciliation_events WHERE reconciliation_item_id=1"
        )
        .first("n")
    ).toBe(31);
  });
  it("does not log an unearned draft update when a terminal decision wins the race", async () => {
    const item = (
      await listHistoricalReviewItems(fixture.client, manager, {
        status: "unresolved",
        exact: { type: "item", id: 1 },
      })
    ).items[0];
    const client = racingClient(() =>
      resolveFinancialReconciliationItem(
        {
          actor: owner,
          itemId: 1,
          decision: "excluded",
          reason: "Owner reviewed and excluded this source",
        },
        fixture.orm
      )
    );
    await expect(
      saveHistoricalDraft(client, {
        actor: manager,
        itemId: 1,
        proposedTreatment: "requires_owner_review",
        notes: "Late draft",
        expectedDraftVersion: item.draftVersion,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await fixture.client
        .prepare(
          "SELECT COUNT(*) AS n FROM financial_reconciliation_events WHERE reconciliation_item_id=1"
        )
        .first("n")
    ).toBe(31);
  });
  it("parses exact key links safely and preserves money precision", () => {
    expect(reconciliationSourcePath("renewal_key", "11")).toBe(
      "/admin/package-keys?keyId=11"
    );
    expect(reconciliationSourcePath("renewal_key", "11", null)).toBeNull();
    expect(reconciliationSourcePath("order", "1")).toBe(
      "/admin/orders?orderId=1"
    );
    expect(reconciliationSourcePath("order", "1&other=2")).toBeNull();
    expect(focusedPackageKeyId("?keyId=11")).toBe(11);
    expect(focusedPackageKeyId("?keyId=9007199254740992")).toBeNull();
    expect(parseReconciliationIls("1.01", true)).toBe(101);
    for (const value of ["1.001", "1e3", "0", "Infinity", "-1"])
      expect(parseReconciliationIls(value, true)).toBeNull();
  });
});
