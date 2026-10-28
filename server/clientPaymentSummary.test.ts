import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  buildClientPaymentSummaries, readClientPaymentSummaries, CLIENT_PAYMENT_SOURCE_SQL,
  CLIENT_PAYMENT_SOURCE_LIMIT, type ClientPaymentSources,
} from '../backend/services/client-payment-summary.service';
import { clientPaymentExportFields, isAvailableClientPaymentSummary, clientPaymentCoverageLabel } from '../shared/clientPaymentSummary';
import { ENV } from '../backend/_core/env';

const clients = [{ id: 50, email: 'buyer@example.com' }, { id: 51, email: 'recipient@example.com' }];
const empty = (): ClientPaymentSources => ({ orders: [], ledger: [], keys: [], refunds: [], confirmations: [], reconciliations: [] });
const order = (id = 109, userId = 50, status = 'completed') => ({ id, userId, status, transactionPurpose: 'renewal', isGift: 0 });
const payment = (id = 1, orderId: number | null = 109, amountMinor = 35000) => ({
  id, orderId, amountMinor, entryType: 'payment', status: 'approved', refundId: null, keyId: null,
  sourceType: 'order_payment_renewal', sourceReference: `order:${orderId}`, reversalOfEntryId: null,
});
const key = (id: number, orderId: number | null = null, activatedAt: string | null = '2026-01-01') => ({
  id, orderId, activatedAt, email: 'buyer@example.com', packageId: 2, price: 350,
  isActive: 1, issuancePurpose: 'commercial', legacyMigrationId: null,
});
const summary = (sources: ClientPaymentSources, userId = 50) => buildClientPaymentSummaries(clients, sources).summaries.get(userId)!;

describe('client payment evidence', () => {
  it('supports disabling the new reporting reads with the emergency flag', () => {
    const previous = process.env.CLIENT_PAYMENT_SUMMARIES_ENABLED;
    try {
      process.env.CLIENT_PAYMENT_SUMMARIES_ENABLED = 'false';
      expect(ENV.clientPaymentSummariesEnabled).toBe(false);
      process.env.CLIENT_PAYMENT_SUMMARIES_ENABLED = 'true';
      expect(ENV.clientPaymentSummariesEnabled).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CLIENT_PAYMENT_SUMMARIES_ENABLED;
      else process.env.CLIENT_PAYMENT_SUMMARIES_ENABLED = previous;
    }
  });
  it('reproduces the Omar-shaped incomplete history without calling 700 a paid total', () => {
    const data = empty();
    data.orders.push(order(), order(78));
    data.ledger.push(payment()); data.confirmations.push({ id: 1, orderId: 109 });
    data.keys.push(key(63), key(139), key(184, 109, null));
    expect(summary(data)).toMatchObject({ receiptsMinor: 35000, netPaidMinor: 35000, receiptCount: 1,
      historicalOrderCount: 1, historicalKeyCount: 2, unusedPaidKeyCount: 1, coverage: 'needs_reconciliation' });
    expect(clientPaymentExportFields(summary(data)).slice(0, 4)).toEqual(['350.00', '0.00', '350.00', 'needs_reconciliation']);
  });
  it('keeps payer cash independent of recipient email, unused keys, package and order status', () => {
    const data = empty(); data.orders.push({ ...order(109, 50, 'cancelled'), isGift: 1 });
    data.ledger.push(payment()); data.confirmations.push({ id: 1, orderId: 109 });
    data.keys.push({ ...key(2, 109, null), email: 'recipient@example.com' }, { ...key(3, 109, null), email: 'recipient@example.com' });
    expect(summary(data)).toMatchObject({ receiptsMinor: 35000, unusedPaidKeyCount: 2, receiptCount: 1 });
    expect(summary(data, 51)).toMatchObject({ receiptsMinor: 0, receiptCount: 0 });
  });
  it('does not subtract an unrecognized refund or infer a debt from historical keys', () => {
    const data = empty(); data.keys.push(key(1)); data.refunds.push({ id: 8, userId: 50, orderId: null });
    expect(summary(data)).toMatchObject({ receiptsMinor: 0, refundsMinor: 0, netPaidMinor: 0, coverage: 'needs_reconciliation' });
    expect(summary(data).reasons).toContain('refund_without_approved_entry');
    expect(clientPaymentCoverageLabel(summary(data), 'en')).toBe('Historical payments need verification');
  });
  it('counts partial refunds, refund reversals and signed fractions once', () => {
    const data = empty(); data.orders.push(order()); data.ledger.push(payment(1, 109, 35001));
    data.confirmations.push({ id: 1, orderId: 109 }); data.refunds.push({ id: 9, userId: 50, orderId: 109 });
    data.ledger.push({ ...payment(2, 109, -10001), entryType: 'refund', refundId: 9, sourceType: 'account_refund', sourceReference: 'refund:9' });
    expect(summary(data)).toMatchObject({ receiptsMinor: 35001, refundsMinor: 10001, netPaidMinor: 25000 });
    data.ledger.push({ ...payment(3, 109, 10001), entryType: 'reversal', reversalOfEntryId: 2, refundId: 9, sourceType: 'financial_reversal', sourceReference: 'ledger:2:reversal' });
    expect(summary(data)).toMatchObject({ receiptsMinor: 35001, refundsMinor: 0, netPaidMinor: 35001 });
  });
  it('handles a reversal, replacement, and balanced reclassification without duplicating cash', () => {
    const data = empty(); data.orders.push(order()); data.confirmations.push({ id: 1, orderId: 109 }); data.ledger.push(payment());
    data.ledger.push({ ...payment(2, 109, -35000), entryType: 'reversal', reversalOfEntryId: 1, sourceType: 'financial_reversal' });
    data.ledger.push({ ...payment(3, 109, 25001), entryType: 'adjustment', sourceType: 'financial_replacement', sourceReference: 'ledger:1:replacement' });
    data.ledger.push({ ...payment(4, 109, -25001), entryType: 'adjustment', sourceType: 'financial_reclassification', sourceReference: 'ledger:3:reclass:renewal:debit' });
    data.ledger.push({ ...payment(5, 109, 25001), entryType: 'adjustment', sourceType: 'financial_reclassification', sourceReference: 'ledger:3:reclass:new_sale:credit' });
    expect(summary(data)).toMatchObject({ receiptsMinor: 25001, receiptCount: 1, coverage: 'recorded_evidence_only' });
  });
  it('does not call a fully reversed payment an unused paid key', () => {
    const data = empty(); data.orders.push(order()); data.confirmations.push({ id: 1, orderId: 109 }); data.keys.push(key(1, 109, null));
    data.ledger.push(payment(), { ...payment(2, 109, -35000), entryType: 'reversal', reversalOfEntryId: 1 });
    expect(summary(data)).toMatchObject({ netPaidMinor: 0, unusedPaidKeyCount: 0 });
  });
  it('excludes drafts, expenses, opening balances and complimentary/migration keys', () => {
    const data = empty(); data.orders.push({ ...order(), transactionPurpose: 'legacy_migration' });
    data.ledger.push({ ...payment(), status: 'draft' }, { ...payment(2), entryType: 'expense' }, { ...payment(3), entryType: 'opening_balance' });
    data.keys.push({ ...key(1), issuancePurpose: 'migration', legacyMigrationId: 1 }, { ...key(2), issuancePurpose: 'compensation' }, { ...key(3), price: 0 });
    expect(summary(data)).toMatchObject({ netPaidMinor: 0, historicalKeyCount: 0, historicalOrderCount: 0, coverage: 'no_payment_recorded' });
  });
  it('recognizes owner-reviewed historical order evidence and excludes unattributed adjustments', () => {
    const data = empty(); data.orders.push(order());
    data.reconciliations.push({ id: 7, sourceType: 'order', sourceReference: '109', status: 'approved_adjustment', proposedTreatment: 'historical_payment_known_date' });
    data.ledger.push({ ...payment(1, null, 170000), entryType: 'adjustment', sourceType: 'historical_reconciliation', sourceReference: 'reconciliation:7' },
      { ...payment(2, null, 12000), entryType: 'adjustment', sourceType: 'manual_adjustment' });
    const result = buildClientPaymentSummaries(clients, data);
    expect(result.summaries.get(50)).toMatchObject({ receiptsMinor: 170000, historicalOrderCount: 0 });
    expect(result.excludedAdjustmentMinor).toBe(12000);
  });
  it('flags a conflicting refund payer and does not allocate its reversal to either client', () => {
    const data = empty(); data.orders.push(order()); data.refunds.push({ id: 1, userId: 51, orderId: 109 });
    data.ledger.push({ ...payment(1, 109, -100), entryType: 'refund', refundId: 1 },
      { ...payment(2, 109, 100), entryType: 'reversal', reversalOfEntryId: 1, refundId: 1 });
    expect(summary(data).netPaidMinor).toBeNull(); expect(summary(data, 51).netPaidMinor).toBeNull();
    expect(summary(data).coverage).toBe('unavailable');
  });
  it('bounds references, rejects unsafe totals and never exports unavailable money as zero', async () => {
    const data = empty();
    for (let i = 1; i <= 15; i++) data.orders.push(order(i));
    expect(summary(data)).toMatchObject({ referencesTruncated: true, historicalOrderCount: 15 });
    expect(summary(data).orderIds).toHaveLength(10);
    const unavailable = await readClientPaymentSummaries({ batch: async () => { throw new Error('failed'); }, prepare: () => ({ bind: () => null }) } as any, clients);
    expect(isAvailableClientPaymentSummary(unavailable.summaries.get(50))).toBe(false);
    expect(clientPaymentExportFields(unavailable.summaries.get(50)).slice(0, 4)).toEqual(['', '', '', 'unavailable']);
    expect(clientPaymentExportFields(undefined).slice(0, 4)).toEqual(['', '', '', 'unavailable']);
    const unsafe = empty(); unsafe.orders.push(order());
    unsafe.ledger.push(payment(1, 109, Number.MAX_SAFE_INTEGER), payment(2, 109, 1));
    expect(summary(unsafe).coverage).toBe('unavailable');
  });
});

const databases: Database.Database[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function sqlFixture() {
  const sqlite = new Database(':memory:'); databases.push(sqlite);
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL, isGift INTEGER DEFAULT 0);
    CREATE TABLE orderItems (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, email TEXT, packageId INTEGER, orderId INTEGER, price INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'ILS', activatedAt TEXT, isActive INTEGER DEFAULT 1, isRenewal INTEGER DEFAULT 0, isUpgrade INTEGER DEFAULT 0,
      issuancePurpose TEXT DEFAULT 'legacy');
    CREATE TABLE account_refunds (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, order_id INTEGER);
  `);
  for (const name of ['106_financial_management_foundation', '107_financial_payment_confirmation_guard', '108_financial_ledger_source_idempotency',
    '111_financial_reporting_indexes', '112_financial_controls', '113_historical_financial_reconciliation', '114_financial_transaction_purpose_and_legacy_migration']) {
    sqlite.exec(readFileSync(new URL(`../database/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  return sqlite;
}
describe('client summary exact SQL contract', () => {
  it('executes every exact statement against real migrated physical columns without writes', () => {
    const sqlite = sqlFixture();
    const before = sqlite.prepare('SELECT total_changes() AS changes').get();
    for (const query of Object.values(CLIENT_PAYMENT_SOURCE_SQL)) {
      expect(sqlite.prepare(query).all(CLIENT_PAYMENT_SOURCE_LIMIT + 1)).toEqual([]);
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(CLIENT_PAYMENT_SOURCE_LIMIT + 1) as Array<{ detail: string }>;
      expect(plan.length).toBeGreaterThan(0);
      // One bounded ordered pass per small source; never a per-client subquery.
      expect(plan.some(row => /CORRELATED/.test(row.detail))).toBe(false);
    }
    expect(sqlite.prepare('SELECT total_changes() AS changes').get()).toEqual(before);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
  it('fails closed if a source is truncated', async () => {
    const result = await readClientPaymentSummaries({
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => Object.keys(CLIENT_PAYMENT_SOURCE_SQL).map(() => ({ success: true, results: Array(CLIENT_PAYMENT_SOURCE_LIMIT + 1).fill({}) })),
    } as any, clients);
    expect(result.summaries.get(50)?.coverage).toBe('unavailable');
  });
});
