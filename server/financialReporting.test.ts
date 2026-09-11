import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import { getFinancialManagementDashboard } from '../backend/db';
import {
  buildFinancialManagementCsv,
  normalizeFinancialPeriodRows,
  normalizeFinancialReportRange,
  totalFinancialPeriods,
} from '../backend/services/financial-reporting.service';

const migrations = [106, 108, 110, 111, 112].map(number => readFileSync(
  new URL(`../database/migrations/${number}_${number === 106 ? 'financial_management_foundation' : number === 108 ? 'financial_ledger_source_idempotency' : number === 110 ? 'financial_expense_workflow' : number === 111 ? 'financial_reporting_indexes' : 'financial_controls'}.sql`, import.meta.url),
  'utf8',
));
const temporaryDirectories: string[] = [];

function createSqlite(filename = ':memory:') {
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, activatedAt TEXT, packageId INTEGER);
  `);
  for (const migration of migrations) sqlite.exec(migration);
  return sqlite;
}

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-financial-reporting-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'fixture.db');
  const sqlite = createSqlite(filename);
  sqlite.exec(`
    INSERT INTO financial_ledger_entries
      (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
       source_type, source_reference, created_by_type, approved_by_type, approved_at)
    VALUES
      ('payment', 'approved', '2026-07-05T12:00:00.000Z', '2026-07', 10000, 'ILS', 10000, 'order_payment_new_sale', 'order:1', 'admin', 'admin', '2026-07-05T12:00:00.000Z'),
      ('refund', 'approved', '2026-07-20T12:00:00.000Z', '2026-07', -2000, 'ILS', -2000, 'account_refund', 'refund:1', 'admin', 'admin', '2026-07-20T12:00:00.000Z'),
      ('payment', 'approved', '2026-08-02T12:00:00.000Z', '2026-08', 5000, 'ILS', 5000, 'order_payment_upgrade', 'order:2', 'staff', 'staff', '2026-08-02T12:00:00.000Z');
    INSERT INTO financial_expenses
      (status, paid_at, category, amount_minor, currency, base_amount_ils_minor, created_by_type, created_by_id, submitted_by_type, submitted_by_id)
    VALUES ('pending_approval', '2026-07-25', 'software_and_subscriptions', 3000, 'ILS', 3000, 'staff', 20, 'staff', 20);
    INSERT INTO financial_ledger_entries
      (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
       expense_id, source_type, source_reference, created_by_type, submitted_by_type, submitted_by_id,
       approved_by_type, approved_by_id, approved_at)
    VALUES ('expense', 'approved', '2026-07-25T00:00:00.000Z', '2026-07', -3000, 'ILS', -3000,
      1, 'financial_expense', 'expense:1', 'staff', 'staff', 20, 'admin', 1, '2026-07-25T12:00:00.000Z');
    UPDATE financial_expenses
      SET status = 'approved', approved_by_type = 'admin', approved_by_id = 1,
          approved_at = '2026-07-25T12:00:00.000Z', ledger_entry_id = 4
      WHERE id = 1;
  `);
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('financial management reporting', () => {
  it('reconciles cash-basis monthly and annual P&L without activation dates', async () => {
    const { database, orm } = await fixture();
    try {
      const monthly = await getFinancialManagementDashboard({
        from: '2026-07-01', to: '2026-08-31', grouping: 'month', includeLedger: true,
      }, orm);
      expect(monthly.periods).toEqual([
        { period: '2026-07', confirmedIncomeMinor: 10000, refundsMinor: 2000, netRevenueMinor: 8000, expensesMinor: 3000, netAdjustmentsMinor: 0, operatingProfitLossMinor: 5000 },
        { period: '2026-08', confirmedIncomeMinor: 5000, refundsMinor: 0, netRevenueMinor: 5000, expensesMinor: 0, netAdjustmentsMinor: 0, operatingProfitLossMinor: 5000 },
      ]);
      expect(monthly.totals).toEqual({ confirmedIncomeMinor: 15000, refundsMinor: 2000, netRevenueMinor: 13000, expensesMinor: 3000, netAdjustmentsMinor: 0, operatingProfitLossMinor: 10000 });
      expect(monthly.categories).toEqual([{ category: 'software_and_subscriptions', amountMinor: 3000 }]);
      expect(monthly.ledger).toHaveLength(4);

      const viewer = await getFinancialManagementDashboard({
        from: '2026-01-01', to: '2026-12-31', grouping: 'year', includeLedger: false,
      }, orm);
      expect(viewer.periods).toEqual([{ period: '2026', confirmedIncomeMinor: 15000, refundsMinor: 2000, netRevenueMinor: 13000, expensesMinor: 3000, netAdjustmentsMinor: 0, operatingProfitLossMinor: 10000 }]);
      expect(viewer.ledger).toEqual([]);
    } finally { (database as any).close(); }
  });

  it('validates ranges and exports the exact filtered totals', () => {
    expect(normalizeFinancialReportRange('2026-07-01', '2026-07-31').endExclusiveTimestamp).toBe('2026-08-01T00:00:00.000Z');
    expect(() => normalizeFinancialReportRange('2026-08-01', '2026-07-01')).toThrow(/before end date/i);
    const periods = normalizeFinancialPeriodRows([{ period: '2026-07', confirmedIncomeMinor: 10000, refundsSignedMinor: -2000, expensesSignedMinor: -3000 }]);
    const totals = totalFinancialPeriods(periods);
    const csv = buildFinancialManagementCsv({ from: '2026-07-01', to: '2026-07-31', grouping: 'month', periods, totals, categories: [{ category: 'software', amountMinor: 3000 }] });
    expect(csv).toContain('"TOTAL","100.00","20.00","80.00","30.00","0.00","50.00"');
    expect(csv).toContain('"TOTAL EXPENSES","30.00"');
  });

  it('uses indexes for every new reporting and activation query shape', () => {
    const sqlite = createSqlite();
    const plans = {
      periods: sqlite.prepare(`EXPLAIN QUERY PLAN SELECT reporting_month,
        SUM(CASE WHEN entry_type = 'payment' THEN base_amount_ils_minor ELSE 0 END)
        FROM financial_ledger_entries INDEXED BY idx_financial_ledger_approved_effective_type
        WHERE status = 'approved' AND effective_at >= '2026-01-01T00:00:00.000Z'
          AND effective_at < '2027-01-01T00:00:00.000Z'
          AND entry_type IN ('payment','refund','expense','adjustment','reversal','opening_balance')
        GROUP BY reporting_month`).all(),
      categories: sqlite.prepare(`EXPLAIN QUERY PLAN SELECT e.category, -SUM(l.base_amount_ils_minor)
        FROM financial_ledger_entries l INDEXED BY idx_financial_ledger_approved_effective_type
          INNER JOIN financial_expenses e ON e.id = l.expense_id
        WHERE l.status = 'approved' AND l.effective_at >= '2026-01-01T00:00:00.000Z'
          AND l.effective_at < '2027-01-01T00:00:00.000Z' AND l.entry_type = 'expense'
        GROUP BY e.category`).all(),
      ledger: sqlite.prepare(`EXPLAIN QUERY PLAN SELECT id, entry_type, effective_at
        FROM financial_ledger_entries INDEXED BY idx_financial_ledger_approved_effective_type
        WHERE status = 'approved' AND effective_at >= '2026-01-01T00:00:00.000Z'
          AND effective_at < '2027-01-01T00:00:00.000Z'
          AND entry_type IN ('payment','refund','expense','adjustment','reversal','opening_balance')
        ORDER BY effective_at DESC, id DESC LIMIT 101`).all(),
      activations: sqlite.prepare(`EXPLAIN QUERY PLAN SELECT id, activatedAt
        FROM registrationKeys
        WHERE activatedAt IS NOT NULL AND packageId IS NOT NULL
        ORDER BY activatedAt DESC, id DESC LIMIT 501`).all(),
    } as Record<string, Array<{ detail: string }>>;
    expect(plans.periods.map(row => row.detail).join('\n')).toContain('idx_financial_ledger_approved_effective_type');
    expect(plans.categories.map(row => row.detail).join('\n')).toContain('idx_financial_ledger_approved_effective_type');
    expect(plans.categories.map(row => row.detail).join('\n')).toMatch(/INTEGER PRIMARY KEY/);
    expect(plans.ledger.map(row => row.detail).join('\n')).toContain('idx_financial_ledger_approved_effective_type');
    expect(plans.activations.map(row => row.detail).join('\n')).toContain('idx_registration_keys_recent_activation');
    sqlite.close();
  });
});
