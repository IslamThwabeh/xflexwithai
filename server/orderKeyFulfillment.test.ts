import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { describeOrderKeyFulfillment, orderKeyFulfillmentQuery, renewalKeyConflictQuery, type OrderKeyFulfillmentRow } from '../backend/services/order-key-fulfillment.service';

const dialect = new SQLiteSyncDialect();
const duplicateGuard = readFileSync(new URL('../database/migrations/094_prevent_duplicate_unused_package_keys.sql', import.meta.url), 'utf8');

function fixture() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY);
    CREATE TABLE order_payment_confirmations(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL UNIQUE);
    CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY, orderId INTEGER, packageId INTEGER,
      email TEXT, isActive INTEGER, activatedAt TEXT, expiresAt TEXT, isRenewal INTEGER, isUpgrade INTEGER);
    CREATE INDEX idx_registration_keys_assignment ON registrationKeys(email, activatedAt, isActive);
    CREATE UNIQUE INDEX idx_registration_keys_order_package ON registrationKeys(orderId, packageId)
      WHERE orderId IS NOT NULL AND packageId IS NOT NULL;
    INSERT INTO orders VALUES (109),(173),(174);
    INSERT INTO order_payment_confirmations VALUES (13,109),(67,173);
    INSERT INTO registrationKeys VALUES (184,109,2,'student@example.invalid',1,NULL,'2026-10-31T23:59:59.999Z',1,0);`);
  sqlite.exec(duplicateGuard);
  return sqlite;
}

describe('order key fulfillment SQL and recovery states', () => {
  it('finds expired unused renewal conflicts through the existing assignment index', () => {
    const sqlite = fixture();
    try {
      const query = dialect.sqlToQuery(renewalKeyConflictQuery(173, 2, 'student@example.invalid'));
      expect(sqlite.prepare(query.sql).all(...query.params)).toEqual([{ id: 184, orderId: 109, expiresAt: '2026-10-31T23:59:59.999Z' }]);
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.params) as any[];
      expect(plan.map(row => row.detail).join(' ')).toContain('SEARCH registrationKeys USING INDEX idx_registration_keys_assignment');
      expect(plan.some(row => /SCAN/.test(row.detail))).toBe(false);
      // Expiry is not permission to consume or discard a paid entitlement.
      expect(() => sqlite.exec(`INSERT INTO registrationKeys VALUES(210,173,2,'student@example.invalid',1,NULL,NULL,1,0)`)).toThrow(/duplicate active unused/);
      sqlite.exec('UPDATE registrationKeys SET isActive=0 WHERE id=184');
      expect(sqlite.prepare(query.sql).all(...query.params)).toEqual([]);
      expect(() => sqlite.exec(`INSERT INTO registrationKeys VALUES(210,173,2,'student@example.invalid',1,NULL,NULL,1,0)`)).not.toThrow();
    } finally { sqlite.close(); }
  });

  it('preserves other packages, key kinds and the same order when checking conflicts', () => {
    const sqlite = fixture();
    try {
      for (const [orderId, packageId, email] of [[109, 2, 'student@example.invalid'], [173, 1, 'student@example.invalid'], [173, 2, 'other@example.invalid']] as const) {
        const query = dialect.sqlToQuery(renewalKeyConflictQuery(orderId, packageId, email));
        expect(sqlite.prepare(query.sql).all(...query.params)).toEqual([]);
      }
      sqlite.exec('UPDATE registrationKeys SET isUpgrade=NULL WHERE id=184');
      const query = dialect.sqlToQuery(renewalKeyConflictQuery(173, 2, 'student@example.invalid'));
      expect(sqlite.prepare(query.sql).all(...query.params)).toHaveLength(1);
    } finally { sqlite.close(); }
  });

  it('loads only requested orders using primary/unique/partial indexes, including orders without keys', () => {
    const sqlite = fixture();
    try {
      const query = dialect.sqlToQuery(orderKeyFulfillmentQuery([109, 173, 174]));
      const rows = sqlite.prepare(query.sql).all(...query.params) as OrderKeyFulfillmentRow[];
      expect(rows).toHaveLength(3);
      expect(rows.find(row => row.orderId === 173)).toMatchObject({ confirmationId: 67, keyId: null });
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.params) as any[];
      const details = plan.map(row => row.detail).join(' ');
      expect(details).toContain('SEARCH o USING INTEGER PRIMARY KEY');
      expect(details).toContain('sqlite_autoindex_order_payment_confirmations_1');
      expect(details).toContain('idx_registration_keys_order_package');
      expect(details).not.toMatch(/SCAN/);
    } finally { sqlite.close(); }
  });

  it('distinguishes pending issuance, closed, expired, ready and redeemed keys from cash', () => {
    const base = { status: 'completed', transactionPurpose: 'renewal', packageIds: [2], now: Date.parse('2026-11-11T12:00:00Z') };
    const row = { orderId: 173, confirmationId: 67, keyId: null, packageId: null, isActive: null, activatedAt: null, expiresAt: null } as OrderKeyFulfillmentRow;
    expect(describeOrderKeyFulfillment({ ...base, rows: [row] }).keyStatus).toBe('issuance_pending');
    const key = { ...row, keyId: 210, packageId: 2, isActive: 1 };
    expect(describeOrderKeyFulfillment({ ...base, rows: [key] }).keyStatus).toBe('key_ready');
    expect(describeOrderKeyFulfillment({ ...base, rows: [{ ...key, isActive: 0 }] }).keyStatus).toBe('closed');
    expect(describeOrderKeyFulfillment({ ...base, rows: [{ ...key, expiresAt: '2026-10-31T00:00:00Z' }] }).keyStatus).toBe('redemption_expired');
    expect(describeOrderKeyFulfillment({ ...base, rows: [{ ...key, activatedAt: '2026-11-11T12:00:00Z' }] }).keyStatus).toBe('redeemed');
    expect(describeOrderKeyFulfillment({ ...base, packageIds: [1,2], rows: [key] }).keyStatus).toBe('issuance_pending');
    expect(describeOrderKeyFulfillment({ ...base, rows: [] }).keyStatus).toBe('historical_review');
    expect(describeOrderKeyFulfillment({ ...base, transactionPurpose: 'copier_subscription', rows: [row] }).keyStatus).toBe('not_applicable');
    expect(describeOrderKeyFulfillment({ ...base, status: 'cancelled', rows: [row] }).keyStatus).toBe('awaiting_approval');
  });
});
