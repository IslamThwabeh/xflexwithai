import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Sqlite from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLocalD1Database } from "../backend/_core/localD1";
import {
  loadFinancialReport,
  FINANCIAL_REPORT_SOURCE_LIMIT,
} from "../backend/services/financial-report-engine";
import { scopedReceiptTotals } from "../shared/financialReport";
let raw: Sqlite.Database,
  local: Awaited<ReturnType<typeof createLocalD1Database>>,
  dir: string;
const names = [
  "106_financial_management_foundation",
  "108_financial_ledger_source_idempotency",
  "110_financial_expense_workflow",
  "111_financial_reporting_indexes",
  "112_financial_controls",
];
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "finance-accuracy-"));
  const file = join(dir, "fixture.db");
  raw = new Sqlite(file);
  raw.exec(
    "CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT,applied_at TEXT);CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,activatedAt TEXT,packageId INTEGER);"
  );
  for (const name of names)
    raw.exec(readFileSync(`database/migrations/${name}.sql`, "utf8"));
  raw.exec(
    "ALTER TABLE financial_ledger_entries ADD COLUMN transaction_purpose TEXT;"
  );
  local = await createLocalD1Database(file);
});
afterEach(() => {
  local?.close();
  raw?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});
type Input = {
  id: number;
  type?: string;
  amount: number;
  date?: string;
  purpose?: string;
  source?: string;
  parent?: number;
  order?: number;
  expense?: number;
  reference?: string;
  status?: string;
  refund?: number;
  paymentReference?: string;
};
function add(input: Input) {
  const type = input.type ?? "payment",
    date = input.date ?? "2026-11-10T12:00:00.000Z";
  const source =
    input.source ??
    (type === "payment"
      ? `order_payment_${input.purpose ?? "new_sale"}`
      : type === "reversal"
        ? "financial_reversal"
        : "synthetic_source");
  const reference =
    input.reference ??
    (type === "reversal"
      ? `ledger:${input.parent}:reversal`
      : source === "financial_replacement"
        ? `ledger:${input.parent}:replacement`
        : `test:${input.id}`);
  raw
    .prepare(
      `INSERT INTO financial_ledger_entries(id,entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,source_type,source_reference,transaction_purpose,reversal_of_entry_id,order_id,expense_id,refund_id,payment_reference,created_by_type,approved_by_type,approved_at)
 VALUES(?,?,?,?,?,?,'ILS',?,?,?,?,?,?,?,?,?, 'admin','admin','2026-11-25T00:00:00Z')`
    )
    .run(
      input.id,
      type,
      input.status ?? "approved",
      date,
      date.slice(0, 7),
      input.amount,
      input.amount,
      source,
      reference,
      input.purpose ?? null,
      type === "reversal" ? (input.parent ?? null) : null,
      input.order ?? null,
      input.expense ?? null,
      input.refund ?? null,
      input.paymentReference ?? null
    );
}
const report = (
  extra: Partial<Parameters<typeof loadFinancialReport>[1]> = {}
) =>
  loadFinancialReport(local as any, {
    from: "2026-11-01",
    to: "2026-11-30",
    grouping: "month",
    includeLedger: true,
    ...extra,
  });
describe("financial dashboard source accuracy", () => {
  it("replays the production aggregate: 40,075 gross, 38,375 net, including 13,000 Copier", async () => {
    let id = 1;
    for (let index = 0; index < 13; index++)
      add({
        id: id++,
        amount: 100000,
        purpose: "copier_subscription",
        order: id,
      });
    const corrected = id;
    add({ id: id++, amount: 200000, purpose: "new_sale", order: 99 });
    for (let index = 0; index < 16; index++)
      add({ id: id++, amount: 136250, purpose: "new_sale", order: id });
    for (const amount of [35000, 35000, 35000, 17500])
      add({ id: id++, amount, purpose: "renewal", order: id });
    for (const amount of [100000, 35000, 35000, 35000])
      add({ id: id++, amount, purpose: "upgrade", order: id });
    add({
      id: id++,
      type: "reversal",
      amount: -200000,
      purpose: "new_sale",
      parent: corrected,
      order: 99,
    });
    add({
      id: id++,
      type: "adjustment",
      amount: 30000,
      purpose: "renewal",
      source: "financial_replacement",
      parent: corrected,
      order: 99,
    });
    const data = await report();
    expect(data.totals).toMatchObject({
      recordedReceiptsMinor: 4007500,
      receiptCorrectionsMinor: -170000,
      confirmedIncomeMinor: 3837500,
      newSalesMinor: 2180000,
      renewalsMinor: 152500,
      upgradesMinor: 205000,
      copierMinor: 1300000,
      operatingProfitLossMinor: 3837500,
    });
    expect(scopedReceiptTotals(data.totals, "academy").net).toBe(2537500);
    expect(scopedReceiptTotals(data.totals, "copier").net).toBe(1300000);
    expect(data.receiptCount).toBe(38);
    expect(data.correctionCount).toBe(2);
    expect(data.totals.confirmedIncomeMinor).toBe(
      data.totals.newSalesMinor +
        data.totals.renewalsMinor +
        data.totals.upgradesMinor +
        data.totals.copierMinor +
        data.totals.unclassifiedIncomeMinor
    );
  });
  it("keeps expense replacement chains as expenses and excludes opening balances from profit", async () => {
    raw.exec(
      "INSERT INTO financial_expenses(id,status,paid_at,category,amount_minor,currency,base_amount_ils_minor,created_by_type,created_by_id)VALUES(1,'pending_approval','2026-10-01','payroll',10000,'ILS',10000,'admin',1)"
    );
    add({
      id: 1,
      type: "expense",
      amount: -10000,
      date: "2026-10-01T12:00:00Z",
      expense: 1,
    });
    add({ id: 2, type: "reversal", amount: 10000, parent: 1, expense: 1 });
    add({
      id: 3,
      type: "adjustment",
      amount: -8000,
      parent: 1,
      source: "financial_replacement",
      expense: 1,
    });
    add({ id: 4, type: "reversal", amount: 8000, parent: 3, expense: 1 });
    add({
      id: 5,
      type: "adjustment",
      amount: -7000,
      parent: 3,
      source: "financial_replacement",
      expense: 1,
    });
    add({ id: 6, type: "opening_balance", amount: 500000 });
    add({ id: 7, type: "adjustment", amount: 1000 });
    const data = await report();
    expect(data.totals).toMatchObject({
      confirmedIncomeMinor: 0,
      expensesMinor: -3000,
      operatingProfitLossMinor: 3000,
      openingBalancesMinor: 500000,
      netAdjustmentsMinor: 1000,
      ledgerMovementMinor: 504000,
    });
    expect(data.categories).toEqual([
      { category: "payroll", amountMinor: -3000 },
    ]);
  });
  it("reverses and replaces refunds as refunds, including Copier scope from the immutable payment", async () => {
    add({
      id: 1,
      amount: 10000,
      purpose: "copier_subscription",
      order: 7,
      date: "2026-10-01T12:00:00Z",
    });
    add({
      id: 2,
      type: "refund",
      amount: -2000,
      order: 7,
      refund: 8,
      date: "2026-10-02T12:00:00Z",
    });
    add({
      id: 3,
      type: "reversal",
      amount: 2000,
      parent: 2,
      order: 7,
      refund: 8,
    });
    add({
      id: 4,
      type: "adjustment",
      amount: -1500,
      parent: 2,
      source: "financial_replacement",
      order: 7,
      refund: 8,
    });
    const data = await report();
    expect(data.totals).toMatchObject({
      confirmedIncomeMinor: 0,
      refundsMinor: -500,
      copierRefundsMinor: -500,
      netRevenueMinor: 500,
    });
    expect(scopedReceiptTotals(data.totals, "copier").net).toBe(500);
  });
  it("does not count balanced reclassification legs as new receipts", async () => {
    add({ id: 1, amount: 10000, purpose: "new_sale" });
    add({
      id: 2,
      type: "adjustment",
      amount: -10000,
      purpose: "new_sale",
      source: "financial_reclassification",
      reference: "ledger:1:reclass:new_sale:debit",
    });
    add({
      id: 3,
      type: "adjustment",
      amount: 10000,
      purpose: "renewal",
      source: "financial_reclassification",
      reference: "ledger:1:reclass:renewal:credit",
    });
    const data = await report();
    expect(data.totals).toMatchObject({
      confirmedIncomeMinor: 10000,
      newSalesMinor: 0,
      renewalsMinor: 10000,
      receiptCorrectionsMinor: 0,
    });
    expect(data.receiptCount).toBe(1);
  });
  it("scopes refunds using a balanced owner reclassification outside the report range", async () => {
    add({
      id: 1,
      amount: 10000,
      purpose: "copier_subscription",
      order: 7,
      date: "2026-10-01T12:00:00Z",
    });
    add({
      id: 2,
      type: "adjustment",
      amount: -10000,
      purpose: "copier_subscription",
      order: 7,
      source: "financial_reclassification",
      reference: "ledger:1:reclass:copier_subscription:debit",
      date: "2026-10-01T12:00:00Z",
    });
    add({
      id: 3,
      type: "adjustment",
      amount: 10000,
      purpose: "new_sale",
      order: 7,
      source: "financial_reclassification",
      reference: "ledger:1:reclass:new_sale:credit",
      date: "2026-10-01T12:00:00Z",
    });
    add({ id: 4, type: "refund", amount: -1000, order: 7 });
    const data = await report();
    expect(data.totals).toMatchObject({
      refundsMinor: 1000,
      academyRefundsMinor: 1000,
      copierRefundsMinor: 0,
    });
    add({
      id: 5,
      type: "reversal",
      amount: -10000,
      parent: 3,
      order: 7,
      date: "2026-10-02T12:00:00Z",
    });
    const ambiguous = await report();
    expect(ambiguous.totals).toMatchObject({
      refundsMinor: 1000,
      academyRefundsMinor: 0,
      unclassifiedRefundsMinor: 1000,
    });
    expect(ambiguous.quality.unclassifiedRefundEntries).toBe(1);
  });
  it("handles SQL UTC timestamps at the first-day boundary and signed/unknown receipts without guessing", async () => {
    add({
      id: 1,
      amount: 10000,
      date: "2026-11-01 00:00:00",
      source: "manual_receipt",
    });
    add({
      id: 2,
      amount: 5000,
      date: "2026-12-01T00:00:00Z",
      purpose: "upgrade",
    });
    const data = await report({ includeLedger: false });
    expect(data.totals).toMatchObject({
      confirmedIncomeMinor: 10000,
      unclassifiedIncomeMinor: 10000,
      academyReceiptsMinor: 0,
    });
    expect(data.ledger).toEqual([]);
    expect(data.quality.unclassifiedReceiptEntries).toBe(1);
  });
  it("flags a shared payment reference for review without deleting legitimate money", async () => {
    add({
      id: 1,
      amount: 10000,
      purpose: "new_sale",
      order: 1,
      paymentReference: "shared reference",
    });
    add({
      id: 2,
      amount: 10000,
      purpose: "upgrade",
      order: 2,
      paymentReference: "shared reference",
    });
    const data = await report();
    expect(data.quality.sharedPaymentReferenceGroups).toBe(1);
    expect(data.totals.confirmedIncomeMinor).toBe(20000);
  });
  it("fails closed on a missing correction parent rather than showing partial money", async () => {
    add({
      id: 1,
      type: "adjustment",
      amount: 1000,
      parent: 999,
      source: "financial_replacement",
    });
    await expect(report()).rejects.toThrow(/source is missing/);
  });
  it("fails closed on mismatched reversal amounts", async () => {
    add({ id: 1, amount: 10000, purpose: "new_sale", order: 1 });
    add({ id: 2, type: "reversal", amount: -9000, parent: 1, order: 1 });
    await expect(report()).rejects.toThrow(/amount does not match/);
  });
  it("rejects cross-order correction ancestry and cycles", async () => {
    add({ id: 1, amount: 10000, purpose: "new_sale", order: 1 });
    add({
      id: 2,
      type: "adjustment",
      amount: 9000,
      source: "financial_replacement",
      parent: 1,
      order: 2,
    });
    await expect(report()).rejects.toThrow(/conflicting source ownership/);
    add({
      id: 3,
      type: "adjustment",
      amount: 1000,
      source: "financial_replacement",
      parent: 4,
      date: "2026-12-01T12:00:00Z",
    });
    add({
      id: 4,
      type: "adjustment",
      amount: 1000,
      source: "financial_replacement",
      parent: 3,
      date: "2026-12-01T12:00:00Z",
    });
    await expect(
      report({ from: "2026-12-01", to: "2026-12-31" })
    ).rejects.toThrow(/source is missing or cyclic/);
  });
  it("recognizes owner-approved historical receipts once and keeps covered history out of receipts", async () => {
    raw.exec(`INSERT INTO financial_reconciliation_items(id,source_type,source_reference,issue_type,confidence_level,proposed_treatment,status) VALUES
      (1,'order','7','missing_receipt','high','historical_payment_known_date','approved_adjustment'),
      (2,'order','8','missing_receipt','high','historical_payment_known_date','approved_adjustment'),
      (3,'order','9','missing_receipt','low','needs_review','unresolved')`);
    add({
      id: 1,
      amount: 10000,
      order: 7,
      purpose: "new_sale",
      date: "2026-10-01T12:00:00Z",
    });
    add({
      id: 2,
      type: "adjustment",
      amount: 10000,
      source: "historical_reconciliation",
      reference: "reconciliation:1",
      purpose: "new_sale",
    });
    add({
      id: 3,
      type: "adjustment",
      amount: 20000,
      source: "historical_reconciliation",
      reference: "reconciliation:2",
      purpose: "renewal",
    });
    add({
      id: 4,
      type: "adjustment",
      amount: 5000,
      source: "historical_reconciliation",
      reference: "reconciliation:3",
    });
    const data = await report();
    expect(data.totals).toMatchObject({
      confirmedIncomeMinor: 20000,
      renewalsMinor: 20000,
      netAdjustmentsMinor: 15000,
      ledgerMovementMinor: 35000,
    });
    expect(data.quality).toMatchObject({
      duplicateHistoricalEntries: 1,
      unallocatedAdjustmentEntries: 2,
    });
    expect(data.receiptCount).toBe(1);
  });
  it("reconciles month/year periods, applies corrections by their own date, and excludes pending entries", async () => {
    add({
      id: 1,
      amount: 10000,
      purpose: "new_sale",
      date: "2026-10-31T23:59:59Z",
    });
    add({ id: 2, type: "reversal", amount: -10000, parent: 1 });
    add({ id: 3, amount: 5000, purpose: "upgrade" });
    add({
      id: 4,
      amount: 999999,
      purpose: "new_sale",
      status: "pending_approval",
    });
    const month = await report({ from: "2026-10-01" });
    const year = await report({ from: "2026-10-01", grouping: "year" });
    expect(month.periods.map(row => row.confirmedIncomeMinor)).toEqual([
      10000, -5000,
    ]);
    expect(month.totals).toEqual(year.totals);
    expect(year.periods).toHaveLength(1);
    expect(year.totals.ledgerMovementMinor).toBe(
      year.totals.operatingProfitLossMinor +
        year.totals.openingBalancesMinor +
        year.totals.netAdjustmentsMinor
    );
  });
  it("enforces a complete source limit and uses the existing date and PK indexes", async () => {
    const plan = raw
      .prepare(
        "EXPLAIN QUERY PLAN SELECT l.id FROM financial_ledger_entries l INDEXED BY idx_financial_ledger_approved_effective_type LEFT JOIN financial_expenses e ON e.id=l.expense_id WHERE l.status='approved' AND l.effective_at>=? AND l.effective_at<? ORDER BY l.effective_at,l.id LIMIT ?"
      )
      .all("2026-11-01", "2026-12-01", FINANCIAL_REPORT_SOURCE_LIMIT + 1);
    expect(JSON.stringify(plan)).toContain(
      "SEARCH l USING INDEX idx_financial_ledger_approved_effective_type"
    );
    raw.transaction(() => {
      for (let id = 1; id <= FINANCIAL_REPORT_SOURCE_LIMIT + 1; id++)
        add({ id, amount: 100 });
    })();
    await expect(report()).rejects.toThrow(/more than 10,000/);
  }, 20_000);
});
