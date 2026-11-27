import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/d1";
import { createLocalD1Database } from "../backend/_core/localD1";
import {
  listFinancialControlEntries,
  previewFinancialCorrection,
} from "../backend/services/financial-control-review.service";
import {
  createFinancialAdjustmentDraft,
  submitFinancialAdjustment,
  reviewFinancialAdjustment,
  reverseFinancialLedgerEntry,
  reclassifyFinancialPaymentPurpose,
  setFinancialPeriodLock,
} from "../backend/db";
import type { FinanceActor } from "../backend/services/financial-expense.service";

const owner: FinanceActor = { access: "owner", actorType: "admin", actorId: 1 },
  manager: FinanceActor = {
    access: "manager",
    actorType: "staff",
    actorId: 20,
  };
let client: Awaited<ReturnType<typeof createLocalD1Database>>,
  orm: ReturnType<typeof drizzle>;
const count = async () =>
  Number(
    (
      await client
        .prepare("SELECT count(*) AS total FROM financial_ledger_entries")
        .first()
    )?.total
  );
const reverse = {
  action: "reverse" as const,
  entryId: 1,
  effectiveDate: "2026-07-11",
  reason: "Source and bank evidence reviewed",
};
describe("bounded financial correction review using actual SQLite", () => {
  beforeEach(async () => {
    client = await createLocalD1Database(":memory:");
    await client.exec(
      "CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT,applied_at TEXT);CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,activatedAt TEXT,packageId INTEGER)"
    );
    for (const name of [
      "106_financial_management_foundation.sql",
      "108_financial_ledger_source_idempotency.sql",
      "110_financial_expense_workflow.sql",
      "111_financial_reporting_indexes.sql",
      "112_financial_controls.sql",
      "141_financial_control_entry_pages.sql",
    ])
      await client.exec(
        readFileSync(
          new URL("../database/migrations/" + name, import.meta.url),
          "utf8"
        )
      );
    await client.exec(
      "ALTER TABLE financial_ledger_entries ADD COLUMN transaction_purpose TEXT;CREATE INDEX idx_financial_ledger_order_guard ON financial_ledger_entries(order_id) WHERE order_id IS NOT NULL"
    );
    for (let id = 1; id <= 65; id++)
      await client
        .prepare(
          `INSERT INTO financial_ledger_entries(id,entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,order_id,source_type,source_reference,description,created_by_type,approved_by_type,approved_by_id,approved_at,transaction_purpose)
   VALUES(?,'payment','approved','2026-07-05T00:00:00.000Z','2026-07',10000,'ILS',10000,?,'order_payment_new_sale',?,'Synthetic source','admin','admin',1,'2026-07-05T00:00:00Z','new_sale')`
        )
        .bind(id, id === 1 ? 202 : id, `order:${id}`)
        .run();
    orm = drizzle(client);
  });
  it("uses one bounded indexed page, stable tie cursors and exact older ledger/order searches", async () => {
    let sql = "",
      binds: unknown[] = [],
      calls = 0;
    const recorded = {
      prepare(query: string) {
        sql = query;
        calls++;
        const statement = client.prepare(query);
        return {
          bind(...values: unknown[]) {
            binds = values;
            return statement.bind(...values);
          },
        };
      },
    } as any;
    const first = await listFinancialControlEntries(recorded, owner, {});
    expect(calls).toBe(1);
    expect(first.items.map(item => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => 65 - index)
    );
    const second = await listFinancialControlEntries(client, owner, {
      before: first.nextCursor!,
    });
    expect(second.items.map(item => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => 45 - index)
    );
    expect(
      new Set([...first.items, ...second.items].map(item => item.id)).size
    ).toBe(40);
    expect(
      (
        await listFinancialControlEntries(client, owner, { ledgerId: 1 })
      ).items.map(item => item.id)
    ).toEqual([1]);
    expect(
      (
        await listFinancialControlEntries(client, owner, { orderId: 202 })
      ).items.map(item => item.id)
    ).toEqual([1]);
    expect(
      (await listFinancialControlEntries(client, owner, { ledgerId: 999 }))
        .items
    ).toEqual([]);
    const plan = await client
      .prepare("EXPLAIN QUERY PLAN " + sql)
      .bind(...binds)
      .all();
    const details = JSON.stringify(plan.results);
    expect(details).toContain("idx_financial_controls_entry_page");
    expect(details).toContain("uq_financial_ledger_single_reversal");
    expect(details).not.toContain("TEMP B-TREE");
  });
  it("rejects unauthorized or unbounded reads before SQL", async () => {
    const blocked = {
      prepare() {
        throw Error("Should not read SQL");
      },
    } as any;
    await expect(
      listFinancialControlEntries(blocked, manager, {})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      previewFinancialCorrection(blocked, manager, reverse)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const input of [
      { limit: 26 },
      { limit: 0 },
      { ledgerId: -1 },
      { orderId: 1.5 },
    ])
      await expect(
        listFinancialControlEntries(client, owner, input)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("keeps pages bounded and non-actionable even when every source has already been reversed", async () => {
    for (let entryId = 1; entryId <= 65; entryId++)
      await reverseFinancialLedgerEntry(
        {
          actor: owner,
          entryId,
          effectiveDate: "2026-07-11",
          reason: "Synthetic reviewed reversal",
        },
        orm
      );
    const page = await listFinancialControlEntries(client, owner, {});
    expect(page.items).toHaveLength(20);
    expect(page.items.every(item => item.reversed)).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(page.items.map(item => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => 65 - index)
    );
  });
  it("previews signed reversal/replacement impact without posting or returning private metadata", async () => {
    const before = await count(),
      preview = await previewFinancialCorrection(client, owner, {
        ...reverse,
        replacementAmountIlsMinor: 9000,
        replacementDescription: "Corrected receipt amount",
      });
    expect(preview).toMatchObject({
      effectiveAt: "2026-07-11T00:00:00.000Z",
      reportingMonth: "2026-07",
      periodLocked: false,
      reversalAmountIlsMinor: -10000,
      replacementAmountIlsMinor: 9000,
      ledgerDeltaIlsMinor: -1000,
    });
    expect(preview.original).not.toHaveProperty("internalNotes");
    expect(preview.original).not.toHaveProperty("auditMetadata");
    expect(preview.original).not.toHaveProperty("status");
    expect(await count()).toBe(before);
  });
  it("previews category-only changes at the original date with zero ledger delta", async () => {
    const result = await previewFinancialCorrection(client, owner, {
      action: "reclassify",
      entryId: 1,
      nextPurpose: "copier_subscription",
      reason: "Verified Copier subscription source",
    });
    expect(result).toMatchObject({
      effectiveAt: "2026-07-05T00:00:00.000Z",
      previousPurpose: "new_sale",
      nextPurpose: "copier_subscription",
      ledgerDeltaIlsMinor: 0,
    });
    expect(await count()).toBe(65);
  });
  it("requires a fresh review when the period lock changes before reversal or reclassification", async () => {
    await previewFinancialCorrection(client, owner, reverse);
    await setFinancialPeriodLock(
      {
        actor: owner,
        month: "2026-07",
        action: "locked",
        reason: "Synthetic month-end review",
      },
      orm
    );
    const locked = await previewFinancialCorrection(client, owner, reverse);
    expect(locked.periodLocked).toBe(true);
    await expect(
      reverseFinancialLedgerEntry(
        { actor: owner, ...reverse, expectedPeriodLocked: false },
        orm
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      reclassifyFinancialPaymentPurpose(
        {
          actor: owner,
          entryId: 1,
          nextPurpose: "renewal",
          reason: "Reviewed source receipt",
          expectedPeriodLocked: false,
        },
        orm
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await count()).toBe(65);
    await reverseFinancialLedgerEntry(
      { actor: owner, ...reverse, expectedPeriodLocked: true },
      orm
    );
    expect(await count()).toBe(66);
    expect(
      (await listFinancialControlEntries(client, owner, { ledgerId: 1 })).items
    ).toMatchObject([{ id: 1, reversed: true }]);
    await expect(
      previewFinancialCorrection(client, owner, reverse)
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("requires a renewed manual-adjustment approval preview after a lock change", async () => {
    const draft = await createFinancialAdjustmentDraft(
      manager,
      {
        effectiveDate: "2026-07-05",
        amountIlsMinor: 500,
        description: "Synthetic unallocated adjustment",
        reason: "Independently reviewed adjustment",
      },
      orm
    );
    await submitFinancialAdjustment(
      { actor: manager, adjustmentId: draft!.id },
      orm
    );
    await setFinancialPeriodLock(
      {
        actor: owner,
        month: "2026-07",
        action: "locked",
        reason: "Month-end close",
      },
      orm
    );
    await expect(
      reviewFinancialAdjustment(
        {
          actor: owner,
          adjustmentId: draft!.id,
          decision: "approved",
          reason: "Reviewed approved correction",
          expectedPeriodLocked: false,
        },
        orm
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await count()).toBe(65);
  });
  it("rejects invalid and already-treated previews", async () => {
    await expect(
      previewFinancialCorrection(client, owner, { ...reverse, entryId: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      previewFinancialCorrection(client, owner, {
        action: "reclassify",
        entryId: 1,
        nextPurpose: "new_sale",
        reason: "No actual change",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await reclassifyFinancialPaymentPurpose(
      {
        actor: owner,
        entryId: 1,
        nextPurpose: "renewal",
        reason: "Reviewed renewal receipt",
      },
      orm
    );
    await expect(
      previewFinancialCorrection(client, owner, {
        action: "reclassify",
        entryId: 1,
        nextPurpose: "upgrade",
        reason: "Reviewed changed classification",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
