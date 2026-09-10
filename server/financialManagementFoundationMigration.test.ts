import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../database/migrations/106_financial_management_foundation.sql', import.meta.url),
  'utf8',
);
const paymentGuardMigration = readFileSync(
  new URL('../database/migrations/107_financial_payment_confirmation_guard.sql', import.meta.url),
  'utf8',
);
const sourceIdempotencyMigration = readFileSync(
  new URL('../database/migrations/108_financial_ledger_source_idempotency.sql', import.meta.url),
  'utf8',
);

describe('financial management foundation migration', () => {
  it('is additive and idempotent on a production-shaped SQLite fixture', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE orderItems (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL);
      CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY);
      CREATE TABLE account_refunds (id INTEGER PRIMARY KEY);
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE admins (id INTEGER PRIMARY KEY);
      CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    `);

    expect(() => sqlite.exec(migration)).not.toThrow();
    expect(() => sqlite.exec(migration)).not.toThrow();
    expect(() => sqlite.exec(paymentGuardMigration)).not.toThrow();
    expect(() => sqlite.exec(paymentGuardMigration)).not.toThrow();
    expect(() => sqlite.exec(sourceIdempotencyMigration)).not.toThrow();
    expect(() => sqlite.exec(sourceIdempotencyMigration)).not.toThrow();
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financial_ledger_entries'").get()).toBeTruthy();
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'order_payment_confirmations'").get()).toBeTruthy();
    expect(sqlite.prepare("SELECT migration_name FROM schema_migrations WHERE migration_name = '106_financial_management_foundation.sql'").get()).toBeTruthy();
    expect(sqlite.prepare("SELECT migration_name FROM schema_migrations WHERE migration_name = '107_financial_payment_confirmation_guard.sql'").get()).toBeTruthy();
    expect(sqlite.prepare("SELECT migration_name FROM schema_migrations WHERE migration_name = '108_financial_ledger_source_idempotency.sql'").get()).toBeTruthy();
    sqlite.close();
  });

  it('deduplicates non-null source events while preserving legacy null references', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec("CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);");
    sqlite.exec(migration);
    sqlite.exec(sourceIdempotencyMigration);
    const insert = sqlite.prepare(`INSERT INTO financial_ledger_entries (
      entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
      source_type, source_reference, created_by_type, approved_by_type, approved_at
    ) VALUES ('refund', 'approved', '2026-09-10T00:00:00.000Z', '2026-09', -1000, 'ILS', -1000,
      'account_refund', ?, 'admin', 'admin', '2026-09-10T00:00:00.000Z')`);

    expect(() => insert.run('refund-request-1')).not.toThrow();
    expect(() => insert.run('refund-request-1')).toThrow(/UNIQUE/);
    expect(() => insert.run(null)).not.toThrow();
    expect(() => insert.run(null)).not.toThrow();
    sqlite.close();
  });

  it('protects financial confirmations, approved entries, and role audit rows from rewrites', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec("CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);");
    sqlite.exec(migration);
    sqlite.prepare(`INSERT INTO order_payment_confirmations (order_id, paid_at, rationale, confirmed_by_type, source_type)
      VALUES (1, '2026-09-10T00:00:00.000Z', 'Bank payment verified', 'admin', 'order')`).run();
    expect(() => sqlite.prepare('UPDATE order_payment_confirmations SET paid_at = ? WHERE order_id = 1').run('2026-09-11T00:00:00.000Z')).toThrow(/append_only/);

    sqlite.prepare(`INSERT INTO financial_ledger_entries (
      entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor,
      source_type, created_by_type, approved_by_type, approved_at
    ) VALUES ('payment', 'approved', '2026-09-10T00:00:00.000Z', '2026-09', 10000, 'ILS', 10000, 'order', 'admin', 'admin', '2026-09-10T00:00:00.000Z')`).run();
    expect(() => sqlite.prepare('UPDATE financial_ledger_entries SET amount_minor = 1 WHERE id = 1').run()).toThrow(/approved_immutable/);
    expect(() => sqlite.prepare('DELETE FROM financial_ledger_entries WHERE id = 1').run()).toThrow(/append_only/);

    sqlite.prepare(`INSERT INTO financial_expenses (
      status, paid_at, category, amount_minor, currency, base_amount_ils_minor,
      created_by_type, created_by_id, approved_by_type, approved_at
    ) VALUES ('approved', '2026-09-10T00:00:00.000Z', 'software_and_subscriptions', 10000, 'ILS', 10000, 'staff', 2, 'admin', '2026-09-10T00:00:00.000Z')`).run();
    expect(() => sqlite.prepare('UPDATE financial_expenses SET amount_minor = 1 WHERE id = 1').run()).toThrow(/approved_immutable/);
    sqlite.close();
  });

  it('uses selective indexes for the planned period and reconciliation reads', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec("CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);");
    sqlite.exec(migration);
    const periodPlan = sqlite.prepare(`EXPLAIN QUERY PLAN
      SELECT id, effective_at, base_amount_ils_minor
      FROM financial_ledger_entries
      WHERE status = 'approved' AND reporting_month = '2026-09'
      ORDER BY effective_at, id`).all() as Array<{ detail: string }>;
    const reconciliationPlan = sqlite.prepare(`EXPLAIN QUERY PLAN
      SELECT id, status FROM financial_reconciliation_items
      WHERE source_type = 'order' AND source_reference = '42'`).all() as Array<{ detail: string }>;
    const paymentConfirmationPlan = sqlite.prepare(`EXPLAIN QUERY PLAN
      SELECT id, paid_at FROM order_payment_confirmations WHERE order_id = 42`).all() as Array<{ detail: string }>;

    expect(periodPlan.map((row) => row.detail).join('\n')).toContain('idx_financial_ledger_approved_period');
    expect(reconciliationPlan.map((row) => row.detail).join('\n')).toContain('idx_financial_reconciliation_source');
    expect(paymentConfirmationPlan.map((row) => row.detail).join('\n')).toMatch(/USING.*INDEX/i);
    sqlite.close();
  });

  it('requires the order transition before a cash confirmation can be inserted', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
      INSERT INTO orders (id, status) VALUES (7, 'cancelled');
    `);
    sqlite.exec(migration);
    sqlite.exec(paymentGuardMigration);
    expect(() => sqlite.prepare(`INSERT INTO order_payment_confirmations
      (order_id, paid_at, rationale, confirmed_by_type, source_type)
      VALUES (7, '2026-09-10T00:00:00.000Z', 'Bank payment verified', 'admin', 'order_payment_new_sale')`).run()).toThrow(/requires_completed_order/);
    expect(() => sqlite.prepare("UPDATE orders SET status = 'completed' WHERE id = 7").run()).not.toThrow();
    expect(() => sqlite.prepare(`INSERT INTO order_payment_confirmations
      (order_id, paid_at, rationale, confirmed_by_type, source_type)
      VALUES (7, '2026-09-10T00:00:00.000Z', 'Bank payment verified', 'admin', 'order_payment_new_sale')`).run()).not.toThrow();
    sqlite.close();
  });
});
