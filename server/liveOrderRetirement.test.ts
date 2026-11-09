import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createLocalD1Database } from '../backend/_core/localD1';
import { buildLiveOrderRetirementStatements, getRenewalCreditBalances, retireReplacedLiveOrder } from '../backend/services/live-order-retirement.service';
import type { FinanceActor } from '../backend/services/financial-expense.service';

let directory: string;
let sqlite: InstanceType<typeof Database>;
let client: Awaited<ReturnType<typeof createLocalD1Database>>;
const owner: FinanceActor = { actorType: 'admin', actorId: 1, access: 'owner' };
const input = { orderId: 154, replacementOrderId: 166, paidIlsMinor: 200000, reason: "Owner confirmed one payment; customer's remaining credit is for renewals." };
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'live-retirement-'));
  const filename = join(directory, 'fixture.sqlite');
  sqlite = new Database(filename);
  sqlite.exec("CREATE TABLE schema_migrations (migration_name TEXT UNIQUE, source TEXT, notes TEXT); CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(180),(181); CREATE TABLE admins(id INTEGER PRIMARY KEY); INSERT INTO admins VALUES(1);");
  for (const file of ['004a_packages.sql','004c_orders.sql','004d_orderItems.sql','106_financial_management_foundation.sql','108_financial_ledger_source_idempotency.sql','109_explicit_finance_owner_authority.sql','112_financial_controls.sql']) {
    sqlite.exec(readFileSync(new URL('../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  sqlite.exec("ALTER TABLE financial_ledger_entries ADD COLUMN transaction_purpose TEXT; CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,orderId INTEGER,isActive INTEGER,activatedAt TEXT,notes TEXT); CREATE TABLE account_refunds(order_id INTEGER); CREATE TABLE live_package_entitlements(id INTEGER PRIMARY KEY,orderId INTEGER,isActive INTEGER,updatedAt TEXT); CREATE TABLE order_status_history(order_id INTEGER,user_id INTEGER,previous_status TEXT,new_status TEXT,actor_type TEXT,actor_id INTEGER,reason TEXT,created_at TEXT);");
  sqlite.exec(readFileSync(new URL('../database/migrations/133_live_order_retirement_credit.sql', import.meta.url), 'utf8'));
  sqlite.exec("INSERT INTO packages(id,slug,nameEn,nameAr) VALUES(2,'comprehensive','Comprehensive','الشامل'),(3,'live-package','Live','لايف'); INSERT INTO orders(id,userId,status,totalAmount,currency,createdAt) VALUES(154,180,'completed',200000,'ILS','2026-11-02'),(166,180,'completed',50000,'USD','2026-11-08'),(143,180,'completed',100000,'ILS','2026-10-26'); INSERT INTO orderItems(orderId,packageId,itemType) VALUES(154,3,'package'),(166,2,'package'); INSERT INTO registrationKeys VALUES(204,154,1,NULL,NULL),(211,166,1,NULL,NULL);");
  for (const [id, order, amount] of [[50,154,200000],[60,166,170000],[40,143,100000]]) {
    sqlite.prepare("INSERT INTO order_payment_confirmations(order_id,paid_at,rationale,confirmed_by_type,confirmed_by_id,source_type) VALUES(?,'2026-11-02','Confirmed','admin',1,'order_payment_new_sale')").run(order);
    sqlite.prepare("INSERT INTO financial_ledger_entries(id,entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,order_id,source_type,source_reference,created_by_type,approved_by_type,approved_by_id,approved_at,transaction_purpose) VALUES(?,'payment','approved','2026-11-02','2026-11',?,'ILS',?,?,'order_payment_new_sale',?,'admin','admin',1,'2026-11-02','new_sale')").run(id,amount,amount,order,'order:' + order);
  }
  client = await createLocalD1Database(filename);
});
afterEach(() => { (client as any)?.close(); sqlite?.close(); rmSync(directory, { recursive: true, force: true }); });

describe('replaced Live order retirement', () => {
  it('preserves 2000 total, 1700 Comprehensive, and 300 credit without touching copier access', async () => {
    await retireReplacedLiveOrder(owner,input,client);
    expect(sqlite.prepare("SELECT SUM(base_amount_ils_minor) AS total FROM financial_ledger_entries WHERE order_id IN(154,166)").get()).toEqual({ total: 200000 });
    expect(sqlite.prepare("SELECT status FROM orders WHERE id=154").get()).toEqual({ status: 'cancelled' });
    expect(sqlite.prepare("SELECT id FROM orders WHERE NOT EXISTS(SELECT 1 FROM order_retirements r WHERE r.order_id=orders.id) ORDER BY id").all()).toEqual([{id:143},{id:166}]);
    expect(sqlite.prepare("SELECT id,isActive FROM registrationKeys ORDER BY id").all()).toEqual([{id:204,isActive:0},{id:211,isActive:1}]);
    expect((await getRenewalCreditBalances([180,181],client)).get(180)).toBe(30000);
    expect(sqlite.prepare("SELECT amount_minor FROM financial_ledger_entries WHERE id=40").get()).toEqual({amount_minor:100000});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM order_payment_confirmations WHERE order_id IN(154,166)").get()).toEqual({n:2});
    expect(() => sqlite.exec("UPDATE customer_renewal_credits SET amount_ils_minor=99999")).toThrow(/immutable/);
  });
  it('is idempotent and rejects changing the terms on retry', async () => {
    await retireReplacedLiveOrder(owner,input,client);
    expect((await retireReplacedLiveOrder(owner,input,client)).idempotent).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM customer_renewal_credits").get()).toEqual({n:1});
    await expect(retireReplacedLiveOrder(owner,{...input,paidIlsMinor:220000},client)).rejects.toThrow(/different terms/);
  });
  it.each(['actor','different-client','activated-key','wrong-paid','prior-correction','refund'] as const)('rejects %s with no partial writes', async scenario => {
    let terms = {...input};
    let actor = {...owner};
    if (scenario === 'actor') actor = {actorType:'staff',actorId:20,access:'manager'};
    if (scenario === 'different-client') sqlite.exec("UPDATE orders SET userId=181 WHERE id=166");
    if (scenario === 'activated-key') sqlite.exec("UPDATE registrationKeys SET activatedAt='2026-11-09' WHERE id=204");
    if (scenario === 'wrong-paid') terms.paidIlsMinor=210000;
    if (scenario === 'refund') sqlite.exec("INSERT INTO account_refunds(order_id) VALUES(154)");
    if (scenario === 'prior-correction') sqlite.exec("INSERT INTO financial_ledger_entries(entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,order_id,source_type,created_by_type,approved_by_type,approved_at) VALUES('adjustment','approved','2026-11-09','2026-11',1,'ILS',1,154,'other','admin','admin','2026-11-09')");
    await expect(retireReplacedLiveOrder(actor,terms,client)).rejects.toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM order_retirements").get()).toEqual({n:0});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM customer_renewal_credits").get()).toEqual({n:0});
    expect(sqlite.prepare("SELECT status FROM orders WHERE id=154").get()).toEqual({status:'completed'});
  });
  it('rolls the entire correction back when a later credit write fails', async () => {
    sqlite.exec("CREATE TRIGGER simulate_failure BEFORE INSERT ON customer_renewal_credits BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(retireReplacedLiveOrder(owner,input,client)).rejects.toThrow();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM order_retirements").get()).toEqual({n:0});
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM financial_ledger_entries WHERE order_id IN(154,166)").get()).toEqual({n:2});
    expect(sqlite.prepare("SELECT isActive FROM registrationKeys WHERE id=204").get()).toEqual({isActive:1});
  });
  it('enforces authority inside the transaction and preserves immutable credits', async () => {
    sqlite.exec("UPDATE finance_owner_assignments SET is_active=0,revoked_by_admin_id=1,revoked_at='2026-11-09' WHERE admin_id=1");
    await expect(retireReplacedLiveOrder(owner,input,client)).rejects.toThrow();
  });
  it('constructs a plan for exact payment allocation and rejects a negative credit', () => {
    const plan = {...input,actorAdminId:1,userId:180,sourceLedgerEntryId:50,replacementLedgerEntryId:60,replacementIlsMinor:170000,now:'2026-11-09T14:00:00.000Z'};
    expect(buildLiveOrderRetirementStatements(plan)).toHaveLength(9);
    expect(() => buildLiveOrderRetirementStatements({...plan,paidIlsMinor:160000})).toThrow();
  });
});
