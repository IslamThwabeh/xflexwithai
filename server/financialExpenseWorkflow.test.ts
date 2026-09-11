import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import {
  createFinancialExpenseDraft,
  listFinancialExpenses,
  reviewFinancialExpense,
  submitFinancialExpense,
} from '../backend/db';
import {
  assertIndependentReviewer,
  buildFinancialReceiptMetadata,
  canAccessExpense,
  validateFinancialReceipt,
  type FinanceActor,
} from '../backend/services/financial-expense.service';

const foundation = readFileSync(new URL('../database/migrations/106_financial_management_foundation.sql', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../database/migrations/110_financial_expense_workflow.sql', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../backend/_core/worker.ts', import.meta.url), 'utf8');
const workerConfig = readFileSync(new URL('../wrangler-worker.toml', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];
const clerk: FinanceActor = { actorType: 'staff', actorId: 20, access: 'clerk' };
const manager: FinanceActor = { actorType: 'staff', actorId: 21, access: 'manager' };

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-expenses-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'fixture.db');
  const sqlite = new Database(filename);
  sqlite.exec('CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);');
  sqlite.exec(foundation);
  sqlite.exec(workflow);
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

const expenseInput = {
  paidAt: '2026-09-10',
  category: 'software_and_subscriptions',
  supplierOrPayee: 'Software vendor',
  amountMinor: 12345,
  vatRateBps: 1800,
  vatAmountMinor: 1883,
  vatIncluded: true,
  paymentMethod: 'card',
  paymentReference: 'REF-1',
  description: 'Monthly service',
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('financial expense workflow', () => {
  it('creates, submits, and independently approves exactly one negative ledger entry', async () => {
    const { database, orm } = await fixture();
    try {
      const draft = await createFinancialExpenseDraft(clerk, expenseInput, orm);
      await submitFinancialExpense({ actor: clerk, expenseId: draft.id }, orm);
      const result = await reviewFinancialExpense({ actor: manager, expenseId: draft.id, decision: 'approved', reason: 'Receipt verified' }, orm);
      expect(result.idempotent).toBe(false);
      const retry = await reviewFinancialExpense({ actor: manager, expenseId: draft.id, decision: 'approved', reason: 'Receipt verified' }, orm);
      expect(retry.idempotent).toBe(true);

      const expense = await database.prepare('SELECT status, ledger_entry_id FROM financial_expenses WHERE id = ?').bind(draft.id).first();
      expect(expense?.status).toBe('approved');
      expect(Number(expense?.ledger_entry_id)).toBeGreaterThan(0);
      const ledger = await database.prepare("SELECT amount_minor, base_amount_ils_minor, currency, reporting_month FROM financial_ledger_entries WHERE expense_id = ? AND entry_type = 'expense'").bind(draft.id).all();
      expect(ledger.results).toEqual([{ amount_minor: -12345, base_amount_ils_minor: -12345, currency: 'ILS', reporting_month: '2026-09' }]);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM financial_expense_events WHERE expense_id = ?').bind(draft.id).first('total')).toBe(3);
    } finally { (database as any).close(); }
  });

  it('prevents self-review and limits a clerk to owned expenses', async () => {
    const { database, orm } = await fixture();
    try {
      const own = await createFinancialExpenseDraft(clerk, expenseInput, orm);
      await createFinancialExpenseDraft({ ...clerk, actorId: 99 }, { ...expenseInput, paymentReference: 'REF-2' }, orm);
      await submitFinancialExpense({ actor: clerk, expenseId: own.id }, orm);
      await expect(reviewFinancialExpense({ actor: { ...clerk, access: 'manager' }, expenseId: own.id, decision: 'approved', reason: 'Looks valid' }, orm)).rejects.toThrow(/own expense/i);
      const visible = await listFinancialExpenses({ actor: clerk }, orm);
      expect(visible.map((row: any) => row.id)).toEqual([own.id]);
      expect(canAccessExpense(clerk, { createdByType: 'staff', createdById: 99 })).toBe(false);
    } finally { (database as any).close(); }
  });

  it('rejects unsafe receipt content and stores only private object metadata', () => {
    expect(() => validateFinancialReceipt({ bytes: new TextEncoder().encode('not-a-file'), declaredContentType: 'image/jpeg' })).toThrow(/JPEG/);
    const bytes = new TextEncoder().encode('%PDF-1.7 safe fixture');
    const metadata = buildFinancialReceiptMetadata({
      expenseId: 7,
      bytes,
      declaredContentType: 'application/octet-stream',
      originalName: 'receipt%20September.pdf',
      actor: clerk,
      now: new Date('2026-09-10T12:00:00.000Z'),
      randomId: 'opaque',
    });
    expect(metadata.objectKey).toBe('finance-receipts/7/1789041600000-opaque.pdf');
    expect(metadata.originalName).toBe('receipt September.pdf');
    expect(metadata).not.toHaveProperty('url');
  });

  it('keeps receipt storage private and fail-closed around its dedicated R2 binding', () => {
    expect(workerSource).toContain('if (!authContext.user?.email)');
    expect(workerSource).toContain('if (!actor || actor.access === "viewer")');
    expect(workerSource).toContain('if (!expense || !canAccessExpense(actor, expense))');
    expect(workerSource).toContain('if (!env.FINANCE_RECEIPTS_BUCKET)');
    expect(workerSource).toContain('headers.set("Cache-Control", "private, no-store")');
    expect(workerSource).toContain('headers.set("X-Content-Type-Options", "nosniff")');
    expect(workerConfig).toMatch(/\[\[env\.production\.r2_buckets\]\]\s*\nbinding = "FINANCE_RECEIPTS_BUCKET"\s*\nbucket_name = "xflexacademy-finance-receipts"/);
  });

  it('keeps drafts, events, and approved rows append-only and uses selective indexes', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec('CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);');
    sqlite.exec(foundation);
    sqlite.exec(workflow);
    sqlite.exec(workflow);
    sqlite.prepare(`INSERT INTO financial_expenses
      (status, paid_at, category, amount_minor, currency, base_amount_ils_minor, created_by_type, created_by_id)
      VALUES ('draft', '2026-09-10', 'other', 1000, 'ILS', 1000, 'staff', 20)`).run();
    expect(() => sqlite.prepare('DELETE FROM financial_expenses WHERE id = 1').run()).toThrow(/no_hard_delete/);
    sqlite.prepare(`INSERT INTO financial_expense_events (expense_id, action, next_status, actor_type, actor_id)
      VALUES (1, 'created', 'draft', 'staff', 20)`).run();
    expect(() => sqlite.prepare("UPDATE financial_expense_events SET action = 'updated' WHERE id = 1").run()).toThrow(/append_only/);
    expect(() => sqlite.prepare(`INSERT INTO financial_ledger_entries
      (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor, expense_id, source_type, created_by_type, approved_by_type, approved_at)
      VALUES ('expense', 'approved', '2026-09-10T00:00:00.000Z', '2026-09', -1000, 'ILS', -1000, 1, 'financial_expense', 'staff', 'admin', '2026-09-10T00:00:00.000Z')`).run()).toThrow(/must_be_pending/);
    const ownPlan = sqlite.prepare(`EXPLAIN QUERY PLAN SELECT * FROM financial_expenses
      WHERE created_by_type = 'staff' AND created_by_id = 20 AND status = 'draft'
      ORDER BY updated_at DESC, id DESC`).all() as Array<{ detail: string }>;
    const reviewPlan = sqlite.prepare(`EXPLAIN QUERY PLAN SELECT * FROM financial_expenses
      WHERE status = 'pending_approval' ORDER BY paid_at, id`).all() as Array<{ detail: string }>;
    const allPlan = sqlite.prepare(`EXPLAIN QUERY PLAN SELECT * FROM financial_expenses
      ORDER BY updated_at DESC, id DESC LIMIT 100`).all() as Array<{ detail: string }>;
    expect(ownPlan.map(row => row.detail).join('\n')).toContain('idx_financial_expenses_creator_status_updated');
    expect(reviewPlan.map(row => row.detail).join('\n')).toContain('idx_financial_expenses_status_paid');
    expect(allPlan.map(row => row.detail).join('\n')).toContain('idx_financial_expenses_updated');
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM schema_migrations WHERE migration_name = '110_financial_expense_workflow.sql'").get()).toEqual({ total: 1 });
    sqlite.close();
  });
});
