import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import {
  getFinancialReconciliationDashboard,
  prepareFinancialReconciliationQueue,
  previewFinancialReconciliation,
  resolveFinancialReconciliationItem,
  updateFinancialReconciliationDraft,
} from '../backend/db';
import type { FinanceActor } from '../backend/services/financial-expense.service';

const files = [106, 108, 110, 111, 112, 113].map(number => {
  const names: Record<number, string> = {
    106: 'financial_management_foundation',
    108: 'financial_ledger_source_idempotency',
    110: 'financial_expense_workflow',
    111: 'financial_reporting_indexes',
    112: 'financial_controls',
    113: 'historical_financial_reconciliation',
  };
  return readFileSync(new URL(`../database/migrations/${number}_${names[number]}.sql`, import.meta.url), 'utf8');
});
const temporaryDirectories: string[] = [];
const owner: FinanceActor = { actorType: 'admin', actorId: 1, access: 'owner' };
const manager: FinanceActor = { actorType: 'staff', actorId: 20, access: 'manager' };

function createSqlite(filename = ':memory:') {
  const sqlite = new Database(filename);
  sqlite.exec(`
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY, status TEXT NOT NULL,
      totalAmount INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'ILS',
      paymentReference TEXT, paymentProofUrl TEXT
    );
    CREATE TABLE registrationKeys (
      id INTEGER PRIMARY KEY, activatedAt TEXT, packageId INTEGER,
      orderId INTEGER, price INTEGER NOT NULL DEFAULT 0,
      isRenewal INTEGER DEFAULT 0, isUpgrade INTEGER DEFAULT 0
    );
  `);
  for (const migration of files) sqlite.exec(migration);
  return sqlite;
}

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-financial-reconciliation-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'fixture.sqlite');
  const sqlite = createSqlite(filename);
  sqlite.exec(`
    INSERT INTO orders (id, status, totalAmount, currency, paymentReference) VALUES
      (1, 'completed', 25000, 'ILS', 'bank-ref-1'),
      (2, 'completed', 30000, 'ILS', 'bank-ref-2'),
      (3, 'pending', 20000, 'ILS', NULL);
    INSERT INTO order_payment_confirmations
      (order_id, paid_at, rationale, confirmed_by_type, source_type)
      VALUES (2, '2026-08-01T00:00:00.000Z', 'historic evidence', 'admin', 'order_payment_new_sale');
    INSERT INTO registrationKeys (id, orderId, price, isRenewal, isUpgrade) VALUES
      (10, NULL, 200, 0, 0),
      (11, NULL, 100, 1, 0),
      (12, NULL, 300, 0, 1),
      (13, 2, 200, 0, 0),
      (14, NULL, 0, 0, 0);
  `);
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('historical financial reconciliation', () => {
  it('uses bounded indexed source, queue, and ledger queries', () => {
    const sqlite = createSqlite();
    const plan = (query: string, ...values: unknown[]) => (sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...values) as Array<{ detail: string }>).map(row => row.detail).join('\n');
    expect(plan(`SELECT o.id FROM orders AS o INDEXED BY idx_orders_financial_reconciliation_status_id
      WHERE o.status IN ('paid','completed') AND NOT EXISTS
        (SELECT 1 FROM order_payment_confirmations c WHERE c.order_id = o.id)
      ORDER BY o.status, o.id LIMIT 251`)).toContain('idx_orders_financial_reconciliation_status_id');
    expect(plan(`SELECT k.id FROM registrationKeys AS k INDEXED BY idx_registration_keys_financial_reconciliation_manual
      WHERE k.orderId IS NULL AND k.price > 0 AND COALESCE(k.isRenewal, 0) = 0 AND COALESCE(k.isUpgrade, 0) = 0 ORDER BY k.id LIMIT 251`)).toContain('idx_registration_keys_financial_reconciliation_manual');
    expect(plan(`SELECT k.id FROM registrationKeys AS k INDEXED BY idx_registration_keys_financial_reconciliation_renewal
      WHERE k.orderId IS NULL AND k.price > 0 AND k.isRenewal = 1 ORDER BY k.id LIMIT 251`)).toContain('idx_registration_keys_financial_reconciliation_renewal');
    expect(plan(`SELECT k.id FROM registrationKeys AS k INDEXED BY idx_registration_keys_financial_reconciliation_upgrade
      WHERE k.orderId IS NULL AND k.price > 0 AND COALESCE(k.isRenewal, 0) = 0 AND k.isUpgrade = 1 ORDER BY k.id LIMIT 251`)).toContain('idx_registration_keys_financial_reconciliation_upgrade');
    expect(plan(`SELECT COUNT(*) FROM registrationKeys AS k INDEXED BY idx_registration_keys_financial_reconciliation_free
      WHERE k.orderId IS NULL AND k.price <= 0`)).toContain('idx_registration_keys_financial_reconciliation_free');
    expect(plan(`SELECT id FROM financial_reconciliation_items INDEXED BY idx_financial_reconciliation_status_updated
      WHERE status = ? ORDER BY updated_at DESC, id DESC LIMIT 101`, 'unresolved')).toContain('idx_financial_reconciliation_status_updated');
    expect(plan(`SELECT COUNT(*) FROM financial_ledger_entries INDEXED BY idx_financial_ledger_source_link
      WHERE source_type = 'historical_reconciliation' AND entry_type IN ('opening_balance','adjustment') AND status = 'approved'`)).toContain('idx_financial_ledger_source_link');
    expect(plan(`SELECT COUNT(*) FROM order_payment_confirmations INDEXED BY idx_order_payment_confirmations_reconciliation_count`)).toContain('idx_order_payment_confirmations_reconciliation_count');
    expect(plan(`SELECT COUNT(*) FROM registrationKeys INDEXED BY idx_registration_keys_order_activation_reconciliation
      WHERE orderId IS NOT NULL`)).toContain('idx_registration_keys_order_activation_reconciliation');
    expect(plan(`SELECT COUNT(*) FROM registrationKeys INDEXED BY idx_registration_keys_order_activation_reconciliation
      WHERE orderId IS NOT NULL AND activatedAt IS NOT NULL`)).toContain('idx_registration_keys_order_activation_reconciliation');
    sqlite.close();
  });

  it('previews without writes and materializes an idempotent ID-only queue', async () => {
    const { database, orm } = await fixture();
    try {
      const preview = await previewFinancialReconciliation(orm);
      expect(preview).toMatchObject({
        readOnly: true,
        totalCandidates: 4,
        safeToMaterialize: true,
        counts: { ordersWithoutConfirmation: 1, manualPricedKeys: 1, renewalKeys: 1, upgradeKeys: 1 },
        classifications: { automaticallyReconcilable: 0, requiresOwnerEvidence: 3, openingBalanceCandidates: 1, excludedByRule: 1 },
      });
      expect(await database.prepare('SELECT COUNT(*) AS total FROM financial_reconciliation_items').first('total')).toBe(0);
      await expect(prepareFinancialReconciliationQueue(manager, orm)).resolves.toMatchObject({ itemsAdded: 4 });
      const first = await prepareFinancialReconciliationQueue(owner, orm);
      expect(first).toMatchObject({ queueBefore: 4, queueAfter: 4, itemsAdded: 0 });
      const queue = await getFinancialReconciliationDashboard('unresolved', orm);
      expect(queue).toMatchObject({
        counts: { unresolved: 4, unresolvedProposedMinor: 25000 },
        recognized: { entries: 0, historicalNetMinor: 0 },
        operationalIndicators: { confirmedPayments: 1, issuedOrderKeys: 1, activatedOrderKeys: 0 },
      });
      const draft = queue.items.find((item: any) => item.sourceType === 'renewal_key') as any;
      const updated = await updateFinancialReconciliationDraft({
        actor: manager,
        itemId: draft.id,
        proposedTreatment: 'opening_balance_candidate',
        proposedAmountIlsMinor: 10000,
        notes: 'Bank evidence requested from owner',
      }, orm);
      expect(updated).toMatchObject({ proposedTreatment: 'opening_balance_candidate', proposedAmountIlsMinor: 10000 });
      expect(await database.prepare("SELECT COUNT(*) FROM financial_reconciliation_events WHERE action = 'draft_updated'").first('COUNT(*)')).toBe(1);
      const retry = await prepareFinancialReconciliationQueue(owner, orm);
      expect(retry).toMatchObject({ queueBefore: 4, queueAfter: 4, itemsAdded: 0 });
      const sourceCounts = await database.prepare(`SELECT (SELECT COUNT(*) FROM orders) AS ordersCount, (SELECT COUNT(*) FROM registrationKeys) AS keysCount`).first();
      expect(sourceCounts).toEqual({ ordersCount: 3, keysCount: 5 });
    } finally { (database as any).close(); }
  });

  it('keeps owner decisions immutable and creates one opening balance with before/after metadata', async () => {
    const { database, orm } = await fixture();
    try {
      await prepareFinancialReconciliationQueue(owner, orm);
      const queue = await getFinancialReconciliationDashboard('unresolved', orm);
      const orderItem = queue.items.find((item: any) => item.sourceType === 'order') as any;
      const manualItem = queue.items.find((item: any) => item.sourceType === 'registration_key') as any;
      const excluded = await resolveFinancialReconciliationItem({ actor: owner, itemId: manualItem.id, decision: 'excluded', reason: 'No payment evidence exists' }, orm);
      expect(excluded).toMatchObject({ idempotent: false, item: { status: 'excluded' }, ledgerEntry: null });
      const approved = await resolveFinancialReconciliationItem({ actor: owner, itemId: orderItem.id, decision: 'approved_opening_balance', reason: 'Owner verified the bank statement', effectiveDate: '2026-09-01', amountIlsMinor: 25000 }, orm);
      expect(approved).toMatchObject({ idempotent: false, item: { status: 'approved_opening_balance' }, ledgerEntry: { entryType: 'opening_balance', baseAmountIlsMinor: 25000 } });
      const retry = await resolveFinancialReconciliationItem({ actor: owner, itemId: orderItem.id, decision: 'approved_opening_balance', reason: 'Retry', effectiveDate: '2026-09-01', amountIlsMinor: 25000 }, orm);
      expect(retry.idempotent).toBe(true);
      expect(await database.prepare("SELECT COUNT(*) FROM financial_ledger_entries WHERE source_type = 'historical_reconciliation'").first('COUNT(*)')).toBe(1);
      const metadata = JSON.parse(String(await database.prepare('SELECT resolution_metadata FROM financial_reconciliation_items WHERE id = ?').bind(orderItem.id).first('resolution_metadata')));
      expect(metadata).toMatchObject({ before: { recognizedIlsMinor: 0, ledgerEntries: 0 }, after: { recognizedIlsMinor: 25000, ledgerEntries: 1 }, deltaIlsMinor: 25000 });
      await expect(database.prepare('DELETE FROM financial_reconciliation_items WHERE id = ?').bind(orderItem.id).run()).rejects.toThrow(/no_hard_delete/);
      await expect(database.prepare("UPDATE financial_reconciliation_items SET notes = 'changed' WHERE id = ?").bind(orderItem.id).run()).rejects.toThrow(/terminal_immutable/);
      expect(await database.prepare('SELECT status FROM orders WHERE id = 1').first('status')).toBe('completed');
      expect(await database.prepare('SELECT price FROM registrationKeys WHERE id = 10').first('price')).toBe(200);

      const renewalItem = queue.items.find((item: any) => item.sourceType === 'renewal_key') as any;
      await database.prepare("INSERT INTO financial_period_locks (month, locked_by_admin_id, note) VALUES ('2026-07', 1, 'closed')").run();
      const adjusted = await resolveFinancialReconciliationItem({ actor: owner, itemId: renewalItem.id, decision: 'approved_adjustment', reason: 'Owner verified renewal cash evidence', effectiveDate: '2026-07-01', amountIlsMinor: 10000 }, orm);
      expect(adjusted).toMatchObject({ item: { status: 'approved_adjustment' }, ledgerEntry: { entryType: 'adjustment', baseAmountIlsMinor: 10000 } });
    } finally { (database as any).close(); }
  });

  it('rejects owner opening balances in locked periods and direct ledger bypasses', async () => {
    const { database, orm } = await fixture();
    try {
      await prepareFinancialReconciliationQueue(owner, orm);
      const queue = await getFinancialReconciliationDashboard('unresolved', orm);
      const item = queue.items[0] as any;
      await database.prepare("INSERT INTO financial_period_locks (month, locked_by_admin_id, note) VALUES ('2026-08', 1, 'closed')").run();
      await expect(resolveFinancialReconciliationItem({ actor: owner, itemId: item.id, decision: 'approved_opening_balance', reason: 'Verified evidence', effectiveDate: '2026-08-01', amountIlsMinor: 100 }, orm)).rejects.toThrow(/period is locked/i);
      await expect(database.prepare("UPDATE financial_reconciliation_items SET status = 'excluded' WHERE id = ?").bind(item.id).run()).rejects.toThrow(/terminal_event_required/);
      await expect(database.prepare(`INSERT INTO financial_ledger_entries
        (entry_type, status, effective_at, reporting_month, amount_minor, currency, base_amount_ils_minor, source_type, source_reference, created_by_type, approved_by_type, approved_at)
        VALUES ('opening_balance', 'approved', '2026-09-01T00:00:00.000Z', '2026-09', 100, 'ILS', 100, 'historical_reconciliation', 'reconciliation:999', 'admin', 'admin', '2026-09-01T00:00:00.000Z')`).run()).rejects.toThrow(/must_be_unresolved/);
    } finally { (database as any).close(); }
  });
});
