import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import {
  createFinancialAdjustmentDraft,
  getFinancialManagementDashboard,
  reverseFinancialLedgerEntry,
  reviewFinancialAdjustment,
  setFinancialPeriodLock,
  submitFinancialAdjustment,
} from '../backend/db';
import type { FinanceActor } from '../backend/services/financial-expense.service';

const migrationFiles = [
  '106_financial_management_foundation.sql',
  '108_financial_ledger_source_idempotency.sql',
  '110_financial_expense_workflow.sql',
  '111_financial_reporting_indexes.sql',
  '112_financial_controls.sql',
];
const migrations = migrationFiles.map(name => readFileSync(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
const temporaryDirectories: string[] = [];
const owner: FinanceActor = { actorType: 'admin', actorId: 1, access: 'owner' };
const manager: FinanceActor = { actorType: 'staff', actorId: 20, access: 'manager' };
const secondManager: FinanceActor = { actorType: 'staff', actorId: 21, access: 'manager' };

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-financial-controls-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'fixture.sqlite');
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, activatedAt TEXT, packageId INTEGER);
  `);
  for (const migration of migrations) sqlite.exec(migration);
  sqlite.prepare(`INSERT INTO financial_ledger_entries
    (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
     order_id, source_type, source_reference, created_by_type, approved_by_type, approved_by_id, approved_at)
    VALUES ('payment', 'approved', '2026-07-05T00:00:00.000Z', '2026-07', 10000, 'ILS', 10000,
      1, 'order_payment_new_sale', 'order:1', 'admin', 'admin', 1, '2026-07-05T00:00:00.000Z')`).run();
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('financial adjustment and period controls', () => {
  it('uses the intended indexes for every financial-control read path', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
      CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, activatedAt TEXT, packageId INTEGER);
    `);
    for (const migration of migrations) sqlite.exec(migration);
    const detail = (query: string, ...values: unknown[]) => (sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...values) as Array<{ detail: string }>).map(row => row.detail).join('\n');
    expect(detail('SELECT id FROM financial_adjustment_requests ORDER BY updated_at DESC, id DESC LIMIT 100')).toContain('idx_financial_adjustments_updated');
    expect(detail('SELECT id FROM financial_adjustment_requests WHERE id = ? LIMIT 1', 1)).toMatch(/INTEGER PRIMARY KEY/);
    expect(detail('SELECT month FROM financial_period_locks WHERE month = ? LIMIT 1', '2026-07')).toMatch(/INDEX.*month/i);
    expect(detail("SELECT id FROM financial_ledger_entries WHERE entry_type = 'reversal' AND reversal_of_entry_id = ? LIMIT 1", 1)).toContain('uq_financial_ledger_single_reversal');
    const reversible = detail(`SELECT l.id FROM financial_ledger_entries l INDEXED BY idx_financial_ledger_approved_effective_type
      WHERE l.status = 'approved' AND l.entry_type <> 'reversal'
        AND NOT EXISTS (SELECT 1 FROM financial_ledger_entries r WHERE r.entry_type = 'reversal' AND r.reversal_of_entry_id = l.id)
      ORDER BY l.effective_at DESC, l.id DESC LIMIT 50`);
    expect(reversible).toContain('idx_financial_ledger_approved_effective_type');
    expect(reversible).toContain('uq_financial_ledger_single_reversal');
    sqlite.close();
  });

  it('requires independent approval and creates exactly one adjustment ledger entry', async () => {
    const { database, orm } = await fixture();
    try {
      const draft = await createFinancialAdjustmentDraft(manager, {
        effectiveDate: '2026-07-15',
        amountIlsMinor: 500,
        description: 'Bank fee correction',
        reason: 'Statement reconciliation',
      }, orm);
      await submitFinancialAdjustment({ actor: manager, adjustmentId: draft.id }, orm);
      await expect(reviewFinancialAdjustment({
        actor: manager,
        adjustmentId: draft.id,
        decision: 'approved',
        reason: 'Verified',
      }, orm)).rejects.toThrow(/your own adjustment/i);

      const approved = await reviewFinancialAdjustment({
        actor: secondManager,
        adjustmentId: draft.id,
        decision: 'approved',
        reason: 'Matched to bank statement',
      }, orm);
      expect(approved.idempotent).toBe(false);
      const retry = await reviewFinancialAdjustment({
        actor: secondManager,
        adjustmentId: draft.id,
        decision: 'approved',
        reason: 'Retry',
      }, orm);
      expect(retry.idempotent).toBe(true);

      const ledger = await database.prepare("SELECT amount_minor, status FROM financial_ledger_entries WHERE source_type = 'financial_adjustment'").all();
      expect(ledger.results).toEqual([{ amount_minor: 500, status: 'approved' }]);
      const events = await database.prepare('SELECT action FROM financial_adjustment_events WHERE adjustment_id = ? ORDER BY id').bind(draft.id).all();
      expect(events.results.map(row => row.action)).toEqual(['created', 'submitted', 'approved']);
      await expect(database.prepare('DELETE FROM financial_adjustment_requests WHERE id = ?').bind(draft.id).run()).rejects.toThrow(/no_hard_delete/);
    } finally { (database as any).close(); }
  });

  it('blocks ordinary locked-period postings but permits an audited owner adjustment', async () => {
    const { database, orm } = await fixture();
    try {
      await setFinancialPeriodLock({ actor: owner, month: '2026-07', action: 'locked', reason: 'July close reviewed' }, orm);
      await expect(database.prepare(`INSERT INTO financial_ledger_entries
        (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
         source_type, source_reference, created_by_type, approved_by_type, approved_at)
        VALUES ('payment', 'approved', '2026-07-20T00:00:00.000Z', '2026-07', 100, 'ILS', 100,
          'order_payment_new_sale', 'order:2', 'admin', 'admin', '2026-07-20T00:00:00.000Z')`).run()).rejects.toThrow(/financial_period_locked/);
      await expect(database.prepare(`INSERT INTO financial_ledger_entries
        (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
         source_type, source_reference, created_by_type, approved_by_type, approved_at)
        VALUES ('refund', 'approved', '2026-07-21T00:00:00.000Z', '2026-07', -100, 'ILS', -100,
          'account_refund', 'refund:locked', 'admin', 'admin', '2026-07-21T00:00:00.000Z')`).run()).rejects.toThrow(/financial_period_locked/);

      const draft = await createFinancialAdjustmentDraft(manager, {
        effectiveDate: '2026-07-20', amountIlsMinor: -200,
        description: 'Closed-month correction', reason: 'Owner evidence received',
      }, orm);
      await submitFinancialAdjustment({ actor: manager, adjustmentId: draft.id }, orm);
      await expect(reviewFinancialAdjustment({
        actor: secondManager, adjustmentId: draft.id, decision: 'approved', reason: 'Reviewed',
      }, orm)).rejects.toThrow(/only the finance owner/i);
      await expect(reviewFinancialAdjustment({
        actor: owner, adjustmentId: draft.id, decision: 'approved', reason: 'Owner-authorized closed-period correction',
      }, orm)).resolves.toMatchObject({ idempotent: false });

      await setFinancialPeriodLock({ actor: owner, month: '2026-07', action: 'unlocked', reason: 'Temporary controlled reopening' }, orm);
      const events = await database.prepare("SELECT action FROM financial_period_lock_events WHERE month = '2026-07' ORDER BY id").all();
      expect(events.results.map(row => row.action)).toEqual(['locked', 'unlocked']);
      await expect(database.prepare('UPDATE financial_period_lock_events SET reason = ? WHERE id = 1').bind('changed').run()).rejects.toThrow(/append_only/);
    } finally { (database as any).close(); }
  });

  it('preserves the original and atomically appends one reversal and optional replacement', async () => {
    const { database, orm } = await fixture();
    try {
      await setFinancialPeriodLock({ actor: owner, month: '2026-08', action: 'locked', reason: 'August closed' }, orm);
      const result = await reverseFinancialLedgerEntry({
        actor: owner,
        entryId: 1,
        effectiveDate: '2026-08-10',
        reason: 'Original amount entered incorrectly',
        replacementAmountIlsMinor: 8000,
        replacementDescription: 'Corrected payment value',
      }, orm);
      expect(result.idempotent).toBe(false);
      const retry = await reverseFinancialLedgerEntry({
        actor: owner,
        entryId: 1,
        effectiveDate: '2026-08-10',
        reason: 'Retry',
      }, orm);
      expect(retry.idempotent).toBe(true);

      const rows = await database.prepare('SELECT id, entry_type, amount_minor, status, reversal_of_entry_id FROM financial_ledger_entries ORDER BY id').all();
      expect(rows.results).toEqual([
        { id: 1, entry_type: 'payment', amount_minor: 10000, status: 'approved', reversal_of_entry_id: null },
        { id: 2, entry_type: 'reversal', amount_minor: -10000, status: 'approved', reversal_of_entry_id: 1 },
        { id: 3, entry_type: 'adjustment', amount_minor: 8000, status: 'approved', reversal_of_entry_id: null },
      ]);
      const report = await getFinancialManagementDashboard({
        from: '2026-01-01', to: '2026-12-31', grouping: 'year', includeLedger: true,
      }, orm);
      expect(report.totals).toEqual({
        confirmedIncomeMinor: 10000,
        refundsMinor: 0,
        netRevenueMinor: 10000,
        expensesMinor: 0,
        netAdjustmentsMinor: -2000,
        operatingProfitLossMinor: 8000,
      });
    } finally { (database as any).close(); }
  });
});
