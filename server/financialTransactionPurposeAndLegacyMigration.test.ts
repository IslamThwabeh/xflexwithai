import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { buildRenewalProjection, getCanonicalRenewalTerms, projectRenewalEnd } from '../backend/services/paid-renewal.service';
import { assertLegacyMigrationOwner, canAccessLegacyMigration, normalizeHistoricDate, validateLegacyOriginalAmount } from '../backend/services/legacy-customer-migration.service';
import { paymentSourceTypeForPurpose } from '../shared/financialTransactionPurpose';

const migration = readFileSync(new URL('../database/migrations/114_financial_transaction_purpose_and_legacy_migration.sql', import.meta.url), 'utf8');
let sqlite: Database.Database;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE orderItems (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL);
    CREATE TABLE order_payment_confirmations (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, source_type TEXT NOT NULL);
    CREATE TABLE financial_ledger_entries (id INTEGER PRIMARY KEY, entry_type TEXT NOT NULL, status TEXT, effective_at TEXT, order_id INTEGER, source_type TEXT);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, orderId INTEGER, price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'ILS', issuancePurpose TEXT NOT NULL DEFAULT 'legacy');
  `);
  sqlite.exec(migration);
});
afterEach(() => sqlite.close());

function order(id: number, purpose: string, status = 'pending', userId = id) {
  sqlite.prepare('INSERT INTO orders(id,userId,status,createdAt,transactionPurpose) VALUES(?,?,?,?,?)')
    .run(id, userId, status, '2026-09-12T00:00:00.000Z', purpose);
}

describe('corrective financial transaction purpose and legacy migration release', () => {
  it('1 requires an explicit purpose on every new order', () => {
    expect(() => sqlite.prepare("INSERT INTO orders(id,userId,status,createdAt) VALUES(1,1,'pending','2026-09-12')").run()).toThrow(/purpose_required/);
  });
  it('2 accepts a new-sale order', () => { expect(() => order(1, 'new_sale')).not.toThrow(); });
  it('3 accepts a paid-renewal order', () => { expect(() => order(1, 'renewal')).not.toThrow(); });
  it('4 accepts an upgrade order', () => { expect(() => order(1, 'upgrade')).not.toThrow(); });
  it('5 makes order purpose immutable after classification', () => {
    order(1, 'new_sale');
    expect(() => sqlite.prepare("UPDATE orders SET transactionPurpose='renewal' WHERE id=1").run()).toThrow(/immutable/);
  });
  it('6 requires order items to carry the same purpose', () => {
    order(1, 'renewal');
    expect(() => sqlite.prepare("INSERT INTO orderItems(id,orderId,transactionPurpose) VALUES(1,1,'new_sale')").run()).toThrow(/mismatch/);
  });
  it('7 permits a matching immutable order item', () => {
    order(1, 'renewal');
    expect(() => sqlite.prepare("INSERT INTO orderItems(id,orderId,transactionPurpose) VALUES(1,1,'renewal')").run()).not.toThrow();
  });
  it('8 validates confirmation purpose and source together', () => {
    order(1, 'renewal');
    expect(() => sqlite.prepare("INSERT INTO order_payment_confirmations(id,order_id,source_type,transaction_purpose) VALUES(1,1,'order_payment_new_sale','renewal')").run()).toThrow(/mismatch/);
  });
  it('9 accepts exactly matched renewal confirmation evidence', () => {
    order(1, 'renewal');
    expect(() => sqlite.prepare("INSERT INTO order_payment_confirmations(id,order_id,source_type,transaction_purpose) VALUES(1,1,'order_payment_renewal','renewal')").run()).not.toThrow();
  });
  it('10 prevents a legacy migration from becoming a payment ledger entry', () => {
    order(1, 'legacy_migration');
    expect(() => sqlite.prepare("INSERT INTO financial_ledger_entries(id,entry_type,order_id,source_type,transaction_purpose) VALUES(1,'payment',1,'order_payment_legacy_migration','legacy_migration')").run()).toThrow(/mismatch/);
  });
  it('11 allows only one open renewal order per client', () => {
    order(1, 'renewal', 'pending', 7);
    expect(() => order(2, 'renewal', 'awaiting_confirmation', 7)).toThrow(/UNIQUE/);
  });
  it('12 permits a new renewal after the prior one is terminal', () => {
    order(1, 'renewal', 'completed', 7);
    expect(() => order(2, 'renewal', 'pending', 7)).not.toThrow();
  });
  it('13 allows one renewal key per paid order', () => {
    order(1, 'renewal', 'completed');
    sqlite.prepare("INSERT INTO registrationKeys(id,orderId,price,currency,issuancePurpose,transactionPurpose) VALUES(1,1,17500,'ILS','commercial','renewal')").run();
    expect(() => sqlite.prepare("INSERT INTO registrationKeys(id,orderId,price,currency,issuancePurpose,transactionPurpose) VALUES(2,1,17500,'ILS','commercial','renewal')").run()).toThrow(/UNIQUE/);
  });
  it('14 enforces zero-value ILS migration keys without an order', () => {
    expect(() => sqlite.prepare("INSERT INTO registrationKeys(id,price,currency,issuancePurpose,transactionPurpose,legacyMigrationId) VALUES(1,1,'ILS','migration','legacy_migration',1)").run()).toThrow(/zero_impact/);
  });
  it('15 makes approved migration records non-deletable and immutable', () => {
    sqlite.prepare("INSERT INTO legacy_customer_migrations(id,status,user_id,package_id,reason,created_by_type,created_by_id) VALUES(1,'approved',7,2,'Historic receipt','admin',1)").run();
    expect(() => sqlite.prepare('DELETE FROM legacy_customer_migrations WHERE id=1').run()).toThrow(/no_hard_delete/);
    expect(() => sqlite.prepare("UPDATE legacy_customer_migrations SET notes='changed' WHERE id=1").run()).toThrow(/terminal_immutable/);
  });
  it('16 keeps purpose and migration event streams append-only', () => {
    order(1, 'new_sale');
    sqlite.prepare("INSERT INTO order_transaction_purpose_events(order_id,next_purpose,actor_type,actor_id,reason) VALUES(1,'new_sale','admin',1,'classified')").run();
    expect(() => sqlite.prepare("UPDATE order_transaction_purpose_events SET reason='changed'").run()).toThrow(/append_only/);
  });
  it('17 uses the purpose/date and legacy workflow indexes', () => {
    const plan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT id FROM orders INDEXED BY idx_orders_purpose_created WHERE transactionPurpose='renewal' AND createdAt >= '2026-07-01' ORDER BY createdAt,id").all() as Array<{ detail: string }>;
    const legacyPlan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT id FROM legacy_customer_migrations INDEXED BY idx_legacy_customer_migrations_status_updated WHERE status='pending_approval' ORDER BY updated_at DESC,id DESC LIMIT 101").all() as Array<{ detail: string }>;
    expect(plan.map(row => row.detail).join('\n')).toContain('idx_orders_purpose_created');
    expect(legacyPlan.map(row => row.detail).join('\n')).toContain('idx_legacy_customer_migrations_status_updated');
  });
  it('18 preserves operational dates separately and enforces owner-reviewed historic facts', () => {
    expect(paymentSourceTypeForPurpose('renewal')).toBe('order_payment_renewal');
    expect(getCanonicalRenewalTerms({ slug: 'basic', renewalPeriodDays: 30 })).toMatchObject({ amountIlsMinor: 17500, entitlementDays: 30, currency: 'ILS' });
    expect(projectRenewalEnd('2026-10-01T00:00:00.000Z', 30, new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-10-31T00:00:00.000Z');
    expect(buildRenewalProjection({ pkg: { slug: 'comprehensive', durationDays: 30, includesRecommendations: true, includesLexai: true }, recommendationsCurrentEndAt: null, lexaiCurrentEndAt: null, now: new Date('2026-09-01T00:00:00.000Z') })).toMatchObject({ amountIlsMinor: 35000, recommendationsProjectedEndAt: '2026-10-01T00:00:00.000Z', lexaiProjectedEndAt: '2026-10-01T00:00:00.000Z' });
    expect(normalizeHistoricDate('2026-07-01')).toBe('2026-07-01');
    expect(validateLegacyOriginalAmount(20000, 'usd')).toEqual({ amountMinor: 20000, currency: 'USD' });
    expect(canAccessLegacyMigration({ actorType: 'staff', actorId: 8, canReviewAll: false }, { createdByType: 'staff', createdById: 8 })).toBe(true);
    expect(() => assertLegacyMigrationOwner({ actorType: 'staff', actorId: 8, access: 'manager' })).toThrow(/Only the finance owner/);
  });
});
