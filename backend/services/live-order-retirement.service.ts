import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../db';
import type { FinanceActor } from './financial-expense.service';

export type RetirementInput = { orderId: number; replacementOrderId: number; paidIlsMinor: number; reason: string };
export type RetirementPlan = RetirementInput & {
  actorAdminId: number; userId: number; sourceLedgerEntryId: number;
  replacementLedgerEntryId: number; replacementIlsMinor: number; now: string;
};
export type RetirementStatement = { sql: string; params: Array<string | number | null> };

async function retirementClient() {
  const connection = await getDb();
  const client = (connection as { $client?: D1Database } | null)?.$client;
  if (!client) throw new Error('Database unavailable');
  return client;
}
export function buildLiveOrderRetirementStatements(plan: RetirementPlan): RetirementStatement[] {
  const { orderId, replacementOrderId, paidIlsMinor, reason, actorAdminId, userId, sourceLedgerEntryId, replacementLedgerEntryId, replacementIlsMinor, now } = plan;
  if (![orderId, replacementOrderId, paidIlsMinor, actorAdminId, userId, sourceLedgerEntryId, replacementLedgerEntryId, replacementIlsMinor].every(value => Number.isSafeInteger(value) && value > 0)
    || paidIlsMinor < replacementIlsMinor || orderId === replacementOrderId || reason.trim().length < 5 || reason.length > 1000
    || !Number.isFinite(Date.parse(now))) throw new Error('Invalid Live replacement terms');
  const credit = paidIlsMinor - replacementIlsMinor;
  const audit = JSON.stringify({ workflowVersion: 1, ownerAuthorizedLockedPeriod: true, oldOrderId: orderId, replacementOrderId, originalLedgerEntryId: sourceLedgerEntryId, confirmedPaidIlsMinor: paidIlsMinor, renewalCreditIlsMinor: credit });
  const statements: RetirementStatement[] = [{
    sql: 'INSERT INTO order_retirements (order_id,replacement_order_id,user_id,source_ledger_entry_id,replacement_ledger_entry_id,paid_ils_minor,replacement_ils_minor,credit_ils_minor,reason,actor_admin_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    params: [orderId,replacementOrderId,userId,sourceLedgerEntryId,replacementLedgerEntryId,paidIlsMinor,replacementIlsMinor,credit,reason,actorAdminId,now],
  }, {
    sql: "INSERT INTO financial_ledger_entries (entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,order_id,source_type,source_reference,description,reason,created_by_type,created_by_id,approved_by_type,approved_by_id,approved_at,reversal_of_entry_id,audit_metadata,transaction_purpose,created_at) SELECT 'reversal','approved',?,substr(?,1,7),-amount_minor,currency,-base_amount_ils_minor,order_id,'financial_reversal',?,'Superseded Live payment allocation reversed',?,'admin',?,'admin',?,?,id,?,transaction_purpose,? FROM financial_ledger_entries WHERE id = ?",
    params: [now,now,'ledger:' + sourceLedgerEntryId + ':reversal',reason,actorAdminId,actorAdminId,now,audit,now,sourceLedgerEntryId],
  }];
  if (credit) statements.push({
    // The existing Comprehensive posting already represents its allocation.
    // This replacement is only the prepaid remainder, not another receipt.
    sql: "INSERT INTO financial_ledger_entries (entry_type,status,effective_at,reporting_month,amount_minor,currency,base_amount_ils_minor,order_id,source_type,source_reference,description,reason,created_by_type,created_by_id,approved_by_type,approved_by_id,approved_at,audit_metadata,transaction_purpose,created_at) VALUES ('adjustment','approved',?,substr(?,1,7),?,'ILS',?,?,'financial_replacement',?,'Prepaid credit reserved for future renewals',?,'admin',?,'admin',?,?,?,'renewal',?)",
    params: [now,now,credit,credit,orderId,'ledger:' + sourceLedgerEntryId + ':replacement',reason,actorAdminId,actorAdminId,now,audit,now],
  }, {
    sql: "INSERT INTO customer_renewal_credits (user_id,source_order_id,amount_ils_minor,entry_type,source_reference,reason,actor_admin_id,created_at) VALUES (?,?,?,'grant',?,?,?,?)",
    params: [userId,orderId,credit,'live-replacement:' + orderId + ':credit',reason,actorAdminId,now],
  });
  statements.push({
    sql: 'UPDATE registrationKeys SET isActive = 0, notes = COALESCE(notes,?) || ? WHERE orderId = ?',
    params: ['', ' | Replaced by Comprehensive order #' + replacementOrderId, orderId],
  }, {
    sql: 'UPDATE live_package_entitlements SET isActive = 0, updatedAt = ? WHERE orderId = ?',
    params: [now,orderId],
  }, {
    sql: "UPDATE orders SET status = 'cancelled', updatedAt = ? WHERE id = ?",
    params: [now,orderId],
  }, {
    sql: 'UPDATE orders SET notes = COALESCE(notes,?) || ?, updatedAt = ? WHERE id = ?',
    params: ['', ' | Payment transferred from superseded Live order #' + orderId + '; confirmed total ILS ' + (paidIlsMinor / 100).toFixed(2) + '; remaining renewal credit ILS ' + (credit / 100).toFixed(2) + '; no additional cash received.', now,replacementOrderId],
  }, {
    sql: "INSERT INTO order_status_history (order_id,user_id,previous_status,new_status,actor_type,actor_id,reason,created_at) VALUES (?,?,'completed','cancelled','admin',?,?,?)",
    params: [orderId,userId,actorAdminId,reason,now],
  });
  return statements;
}

export async function retireReplacedLiveOrder(actor: FinanceActor, input: RetirementInput, database?: D1Database) {
  if (actor.actorType !== 'admin' || actor.access !== 'owner') throw new Error('Finance owner access required');
  const client = database ?? await retirementClient();
  const existing = await client.prepare('SELECT * FROM order_retirements WHERE order_id = ?').bind(input.orderId).first();
  if (existing) {
    if (existing.replacement_order_id !== input.replacementOrderId || existing.paid_ils_minor !== input.paidIlsMinor) throw new Error('This order was retired using different terms');
    return { retirement: existing, idempotent: true };
  }
  const source = await client.prepare("SELECT o.userId,l.id AS ledger_id FROM orders o JOIN financial_ledger_entries l ON l.order_id=o.id AND l.entry_type='payment' AND l.status='approved' WHERE o.id=?").bind(input.orderId).first<{ userId: number; ledger_id: number }>();
  const replacement = await client.prepare("SELECT id,base_amount_ils_minor FROM financial_ledger_entries WHERE order_id=? AND entry_type='payment' AND status='approved'").bind(input.replacementOrderId).first<{ id: number; base_amount_ils_minor: number }>();
  if (!source || !replacement) throw new Error('Both orders require verified payment entries');
  const statements = buildLiveOrderRetirementStatements({
    ...input, actorAdminId: actor.actorId, userId: source.userId,
    sourceLedgerEntryId: source.ledger_id, replacementLedgerEntryId: replacement.id,
    replacementIlsMinor: replacement.base_amount_ils_minor, now: new Date().toISOString(),
  });
  await client.batch(statements.map(statement => client.prepare(statement.sql).bind(...statement.params)));
  return { retirement: await client.prepare('SELECT * FROM order_retirements WHERE order_id=?').bind(input.orderId).first(), idempotent: false };
}

export async function getRenewalCreditBalances(userIds: number[], database?: D1Database) {
  const ids = [...new Set(userIds)];
  const balances = new Map<number, number>();
  if (!ids.length) return balances;
  const connection = database ? null : await getDb();
  const client = database ?? (connection as { $client?: D1Database } | null)?.$client;
  if (!client) return balances;
  for (let offset = 0; offset < ids.length; offset += 100) {
    const group = ids.slice(offset, offset + 100);
    const rows = await client.prepare('SELECT user_id,SUM(amount_ils_minor) AS balance FROM customer_renewal_credits WHERE user_id IN (' + group.map(() => '?').join(',') + ') GROUP BY user_id').bind(...group).all<{ user_id: number; balance: number }>();
    for (const row of rows.results) balances.set(row.user_id, row.balance);
  }
  return balances;
}

export async function findRetiredOrder(orderId: number) {
  const connection = await getDb();
  const client = (connection as { $client?: D1Database } | null)?.$client;
  return client ? client.prepare('SELECT order_id,replacement_order_id FROM order_retirements WHERE order_id=?').bind(orderId).first() : null;
}
