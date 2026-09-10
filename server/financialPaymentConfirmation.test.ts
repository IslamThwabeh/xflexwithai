import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import { confirmOrderPayment } from '../backend/db';

const temporaryDirectories: string[] = [];
const migration = readFileSync(new URL('../database/migrations/106_financial_management_foundation.sql', import.meta.url), 'utf8');
const paymentGuardMigration = readFileSync(new URL('../database/migrations/107_financial_payment_confirmation_guard.sql', import.meta.url), 'utf8');

async function createFinancialFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-financial-payment-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'test.db');
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      userId INTEGER NOT NULL,
      status TEXT NOT NULL,
      totalAmount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      paymentMethod TEXT,
      paymentReference TEXT,
      paymentProofUrl TEXT,
      isUpgrade INTEGER NOT NULL DEFAULT 0,
      completedAt TEXT,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE orderItems (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY);
    CREATE TABLE account_refunds (id INTEGER PRIMARY KEY);
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE admins (id INTEGER PRIMARY KEY);
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    INSERT INTO orders (id, userId, status, totalAmount, currency, paymentMethod, paymentProofUrl, isUpgrade, updatedAt)
    VALUES (41, 7, 'awaiting_confirmation', 12500, 'ILS', 'bank_transfer', 'https://videos.xflexacademy.com/payment-proofs/41.jpg', 0, '2026-09-10T00:00:00.000Z');
  `);
  sqlite.exec(migration);
  sqlite.exec(paymentGuardMigration);
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('financial payment confirmation', () => {
  it('atomically records exactly one approved cash entry and never relies on key activation', async () => {
    const { database, orm } = await createFinancialFixture();
    try {
      const order = {
        id: 41, userId: 7, status: 'awaiting_confirmation', totalAmount: 12500,
        currency: 'ILS', paymentMethod: 'bank_transfer', paymentReference: null,
        paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/41.jpg', isUpgrade: false,
      } as any;
      const input = {
        order,
        actorType: 'admin' as const,
        actorId: 11,
        paidAt: '2026-09-09T14:30:00.000Z',
        baseAmountIlsMinor: 12500,
        rationale: 'Transfer and payment proof matched.',
      };

      const first = await confirmOrderPayment(input, orm);
      const second = await confirmOrderPayment(input, orm);

      expect(first.idempotent).toBe(false);
      expect(second.idempotent).toBe(true);
      expect(await database.prepare('SELECT status FROM orders WHERE id = 41').first('status')).toBe('completed');
      expect(await database.prepare('SELECT COUNT(*) AS total FROM order_payment_confirmations WHERE order_id = 41').first('total')).toBe(1);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM financial_ledger_entries WHERE order_id = 41 AND entry_type = \'payment\'').first('total')).toBe(1);
      expect(await database.prepare('SELECT reporting_month FROM financial_ledger_entries WHERE order_id = 41').first('reporting_month')).toBe('2026-09');
      expect(await database.prepare('SELECT source_type FROM financial_ledger_entries WHERE order_id = 41').first('source_type')).toBe('order_payment_new_sale');
    } finally {
      (database as any).close();
    }
  });

  it('records a legacy USD-marked upgrade as an ILS cash entry without an exchange rate', async () => {
    const { database, orm } = await createFinancialFixture();
    try {
      await database.prepare("UPDATE orders SET currency = 'USD', totalAmount = 10000, isUpgrade = 1 WHERE id = 41").run();
      const order = {
        id: 41, userId: 7, status: 'awaiting_confirmation', totalAmount: 10000,
        currency: 'USD', paymentMethod: 'bank_transfer', paymentReference: null,
        paymentProofUrl: null, isUpgrade: true,
      } as any;
      await confirmOrderPayment({
        order, actorType: 'admin', actorId: 11, paidAt: '2026-09-09T14:30:00.000Z',
        baseAmountIlsMinor: 35000, rationale: 'Bank transfer matched.',
      }, orm);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM order_payment_confirmations').first('total')).toBe(1);
      expect(await database.prepare('SELECT source_type FROM financial_ledger_entries WHERE order_id = 41').first('source_type')).toBe('order_payment_upgrade');
      expect(await database.prepare('SELECT currency FROM financial_ledger_entries WHERE order_id = 41').first('currency')).toBe('ILS');
      expect(await database.prepare('SELECT amount_minor FROM financial_ledger_entries WHERE order_id = 41').first('amount_minor')).toBe(35000);
      expect(await database.prepare('SELECT exchange_rate FROM financial_ledger_entries WHERE order_id = 41').first('exchange_rate')).toBeNull();
    } finally {
      (database as any).close();
    }
  });

  it('rolls back the whole batch if the order is no longer confirmable', async () => {
    const { database, orm } = await createFinancialFixture();
    try {
      await database.prepare("UPDATE orders SET status = 'cancelled' WHERE id = 41").run();
      const staleOrder = {
        id: 41, userId: 7, status: 'awaiting_confirmation', totalAmount: 12500,
        currency: 'ILS', paymentMethod: 'bank_transfer', paymentReference: null,
        paymentProofUrl: null, isUpgrade: false,
      } as any;
      await expect(confirmOrderPayment({
        order: staleOrder, actorType: 'admin', actorId: 11,
        paidAt: '2026-09-09T14:30:00.000Z', baseAmountIlsMinor: 12500,
        rationale: 'Transfer matched to the receipt.',
      }, orm)).rejects.toThrow(/requires_completed_order/);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM order_payment_confirmations').first('total')).toBe(0);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM financial_ledger_entries').first('total')).toBe(0);
      expect(await database.prepare('SELECT status FROM orders WHERE id = 41').first('status')).toBe('cancelled');
    } finally {
      (database as any).close();
    }
  });
});
