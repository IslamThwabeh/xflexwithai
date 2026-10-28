import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const auditSql = readFileSync(new URL('../scripts/sql/client-payment-reporting-audit.sql', import.meta.url), 'utf8');

// Minimal physical production columns used by the one-time audit. This does
// not stand in for the full migration/constraint fixture required for release.
function fixture() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, isStaff INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, isGift INTEGER);
    CREATE TABLE order_payment_confirmations (id INTEGER PRIMARY KEY, order_id INTEGER UNIQUE);
    CREATE TABLE financial_ledger_entries (id INTEGER PRIMARY KEY, order_id INTEGER,
      entry_type TEXT, status TEXT, base_amount_ils_minor INTEGER, refund_id INTEGER);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, packageId INTEGER,
      activatedAt TEXT, orderId INTEGER, price INTEGER, isActive INTEGER);
    CREATE TABLE account_refunds (id INTEGER PRIMARY KEY);
    CREATE TABLE financial_reconciliation_items (id INTEGER PRIMARY KEY);
    CREATE TABLE legacy_customer_migrations (id INTEGER PRIMARY KEY);
  `);
  return sqlite;
}

describe('aggregate-only client payment reporting audit', () => {
  it('returns explicit zero counts for an empty source without mutating it', () => {
    const sqlite = fixture();
    try {
      const row = sqlite.prepare(auditSql).get() as Record<string, number>;
      expect(Object.keys(row)).toHaveLength(18);
      expect(Object.values(row).every(value => value === 0)).toBe(true);
      expect(sqlite.prepare('SELECT total_changes() AS changes').get()).toEqual({ changes: 0 });
    } finally { sqlite.close(); }
  });

  it('separates missing evidence and unused keys without multiplying cash by key count', () => {
    const sqlite = fixture();
    try {
      sqlite.exec(`
        INSERT INTO users VALUES (1,0), (2,0), (3,1);
        INSERT INTO orders VALUES (1,'completed',0), (2,'completed',0), (3,'pending',1);
        INSERT INTO order_payment_confirmations VALUES (1,1);
        INSERT INTO financial_ledger_entries VALUES (1,1,'payment','approved',35000,NULL);
        INSERT INTO registrationKeys VALUES
          (1,2,NULL,1,350,1), (2,2,NULL,1,350,1),
          (3,2,'2026-01-01',NULL,350,1), (4,2,'2026-02-01',2,350,1);
      `);
      const before = sqlite.prepare('SELECT total_changes() AS changes').get();
      expect(sqlite.prepare(auditSql).get()).toMatchObject({
        client_accounts: 2, orders: 3, completed_or_paid_orders: 2,
        completed_or_paid_without_confirmation: 1, payment_confirmations: 1,
        confirmations_without_approved_payment_entry: 0, approved_payment_entries: 1,
        approved_payment_ils_minor: 35000, activated_package_keys: 2,
        activated_manual_priced_package_keys: 1, unused_active_keys_for_confirmed_orders: 2,
        gift_orders: 1,
      });
      expect(sqlite.prepare('SELECT total_changes() AS changes').get()).toEqual(before);
    } finally { sqlite.close(); }
  });

  it('flags unmatched approved payments and refund references', () => {
    const sqlite = fixture();
    try {
      sqlite.exec(`
        INSERT INTO orders VALUES (1,'completed',0);
        INSERT INTO order_payment_confirmations VALUES (1,1);
        INSERT INTO account_refunds VALUES (1), (2);
        INSERT INTO financial_ledger_entries VALUES
          (1,999,'payment','approved',70000,NULL),
          (2,1,'refund','approved',-10000,1),
          (3,1,'refund','draft',-10000,2);
      `);
      expect(sqlite.prepare(auditSql).get()).toMatchObject({
        confirmations_without_approved_payment_entry: 1,
        approved_payments_without_matching_order: 1,
        account_refunds: 2, refunds_without_approved_refund_entry: 1,
      });
    } finally { sqlite.close(); }
  });
});
