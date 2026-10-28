import type { D1Database } from '@cloudflare/workers-types';
import { unavailableClientPaymentSummary, type ClientPaymentSummary } from '../../shared/clientPaymentSummary';

// This on-demand read is intentionally bounded at both the SQL and response
// layers. Exceeding the source ceiling fails closed; partial money is unsafe.
export const CLIENT_PAYMENT_SOURCE_LIMIT = 5000;
export const CLIENT_PAYMENT_SOURCE_SQL = {
  orders: `SELECT id, userId, status, transactionPurpose, isGift FROM orders ORDER BY id LIMIT ?`,
  ledger: `SELECT id, entry_type AS entryType, status, base_amount_ils_minor AS amountMinor,
    order_id AS orderId, refund_id AS refundId, registration_key_id AS keyId,
    source_type AS sourceType, source_reference AS sourceReference,
    reversal_of_entry_id AS reversalOfEntryId
    FROM financial_ledger_entries WHERE status = 'approved' ORDER BY id LIMIT ?`,
  confirmations: `SELECT id, order_id AS orderId FROM order_payment_confirmations ORDER BY id LIMIT ?`,
  keys: `SELECT id, email, packageId, orderId, price, activatedAt, isActive,
    issuancePurpose, legacyMigrationId FROM registrationKeys ORDER BY id LIMIT ?`,
  refunds: `SELECT id, user_id AS userId, order_id AS orderId FROM account_refunds ORDER BY id LIMIT ?`,
  reconciliations: `SELECT id, source_type AS sourceType, source_reference AS sourceReference,
    status, proposed_treatment AS proposedTreatment FROM financial_reconciliation_items ORDER BY id LIMIT ?`,
};

export type ClientPaymentClient = { id: number; email: string | null };
export type ClientPaymentSources = {
  orders: Array<{ id: number; userId: number; status: string; transactionPurpose: string | null; isGift: number }>;
  ledger: Array<{ id: number; entryType: string; status: string; amountMinor: number; orderId: number | null;
    refundId: number | null; keyId: number | null; sourceType: string; sourceReference: string | null; reversalOfEntryId: number | null }>;
  confirmations: Array<{ id: number; orderId: number }>;
  keys: Array<{ id: number; email: string | null; packageId: number | null; orderId: number | null;
    price: number; activatedAt: string | null; isActive: number; issuancePurpose: string; legacyMigrationId: number | null }>;
  refunds: Array<{ id: number; userId: number; orderId: number | null }>;
  reconciliations: Array<{ id: number; sourceType: string; sourceReference: string; status: string; proposedTreatment: string }>;
};

export function buildClientPaymentSummaries(clients: ClientPaymentClient[], sources: ClientPaymentSources, generatedAt = new Date().toISOString()) {
  const summaries = new Map<number, ClientPaymentSummary>();
  const reasons = new Map<number, Set<string>>();
  const references = new Map<number, { orders: Set<number>; keys: Set<number> }>();
  const emailOwners = new Map<string, number[]>();
  for (const client of clients) {
    summaries.set(client.id, { ...unavailableClientPaymentSummary(generatedAt), coverage: 'no_payment_recorded',
      receiptsMinor: 0, refundsMinor: 0, netPaidMinor: 0, reasons: [] });
    reasons.set(client.id, new Set());
    references.set(client.id, { orders: new Set(), keys: new Set() });
    const email = client.email?.trim().toLowerCase();
    if (email) emailOwners.set(email, [...(emailOwners.get(email) ?? []), client.id]);
  }
  const orders = new Map(sources.orders.map(row => [row.id, row]));
  const refunds = new Map(sources.refunds.map(row => [row.id, row]));
  const reconciliations = new Map(sources.reconciliations.map(row => [row.id, row]));
  const historicalReceipts = new Set<number>();
  const ordinaryPaymentOrders = new Set(sources.ledger.filter(row => row.status === 'approved' && row.entryType === 'payment').map(row => row.orderId));
  const ledger = new Map(sources.ledger.filter(row => row.status === 'approved').map(source => {
    const row = { ...source };
    // Owner-reviewed order reconciliation has an immutable payer through the
    // order. Manual-key reconciliation lacks that payer link and remains in
    // the unallocated adjustment bridge rather than following a mutable email.
    const item = row.sourceType === 'historical_reconciliation'
      ? reconciliations.get(Number(/^reconciliation:(\d+)$/.exec(row.sourceReference ?? '')?.[1])) : null;
    if (row.entryType === 'adjustment' && item?.status === 'approved_adjustment'
      && item.proposedTreatment === 'historical_payment_known_date' && item.sourceType === 'order'
      && /^\d+$/.test(item.sourceReference) && orders.has(Number(item.sourceReference))) {
      row.orderId = Number(item.sourceReference);
      // A later ordinary payment against the same source requires review,
      // rather than counting an owner reconciliation and the payment twice.
      if (!ordinaryPaymentOrders.has(row.orderId)) historicalReceipts.add(row.id);
    }
    return [row.id, row];
  }));
  const confirmations = new Set(sources.confirmations.map(row => row.orderId));
  const paidOrders = new Set<number>();
  const recordedRefunds = new Set<number>();
  const orderNet = new Map<number, number>();
  const classification = new Map<number, 'receipt' | 'refund' | null>();
  const rootClient = new Map<number, number | null>();
  const rootOrder = new Map<number, number | null>();
  let unattributedMinor = 0;
  let excludedAdjustmentMinor = 0;
  const attributedEntryIds = new Map<number, number[]>();
  const invalidClients = new Set<number>();

  const flag = (userId: number | null | undefined, reason: string, orderId?: number | null, keyId?: number | null) => {
    if (userId == null || !summaries.has(userId)) return;
    reasons.get(userId)!.add(reason);
    if (orderId) references.get(userId)!.orders.add(orderId);
    if (keyId) references.get(userId)!.keys.add(keyId);
  };
  // Iterative resolution handles chained replacements without recursion/stack
  // growth. A missing parent, cycle or conflicting payer never invents cash.
  const resolve = (id: number): void => {
    const chain: number[] = [];
    const seen = new Set<number>();
    let current: number | null = id;
    while (current != null && !classification.has(current)) {
      const row = ledger.get(current);
      if (!row || seen.has(current)) break;
      seen.add(current); chain.push(current);
      const parent: number | null = row.entryType === 'reversal' ? row.reversalOfEntryId
        : row.entryType === 'adjustment' && ['financial_replacement', 'financial_reclassification'].includes(row.sourceType)
          ? Number(/^ledger:(\d+):/.exec(row.sourceReference ?? '')?.[1]) || null : null;
      if (parent != null) { current = parent; continue; }
      const kind = row.entryType === 'payment' || historicalReceipts.has(row.id) ? 'receipt' : row.entryType === 'refund' ? 'refund' : null;
      const order = row.orderId ? orders.get(row.orderId) : null;
      const refund = row.refundId ? refunds.get(row.refundId) : null;
      const owner = kind === 'refund' ? refund?.userId ?? order?.userId ?? null : order?.userId ?? null;
      const conflict = order && refund && order.userId !== refund.userId;
      classification.set(current, conflict ? null : kind);
      rootClient.set(current, owner);
      rootOrder.set(current, row.orderId);
      if (conflict) {
        flag(order.userId, 'conflicting_financial_source', row.orderId);
        flag(refund.userId, 'conflicting_financial_source', row.orderId);
      }
      break;
    }
    for (const childId of chain.reverse()) {
      if (classification.has(childId)) continue;
      const row = ledger.get(childId)!;
      const parent = row.entryType === 'reversal' ? row.reversalOfEntryId
        : Number(/^ledger:(\d+):/.exec(row.sourceReference ?? '')?.[1]) || null;
      classification.set(childId, parent ? classification.get(parent) ?? null : null);
      rootClient.set(childId, parent ? rootClient.get(parent) ?? null : null);
      rootOrder.set(childId, parent ? rootOrder.get(parent) ?? null : null);
    }
  };

  for (const row of ledger.values()) {
    resolve(row.id);
    const kind = classification.get(row.id);
    const userId = rootClient.get(row.id);
    const directOwner = row.orderId ? orders.get(row.orderId)?.userId : undefined;
    const refundOwner = row.refundId ? refunds.get(row.refundId)?.userId : undefined;
    if (!Number.isSafeInteger(row.amountMinor) || (userId != null
      && ((directOwner != null && directOwner !== userId) || (refundOwner != null && refundOwner !== userId)))) {
      for (const owner of [userId, directOwner, refundOwner]) if (owner != null) invalidClients.add(owner);
      flag(userId, 'conflicting_financial_source', row.orderId);
      flag(directOwner, 'conflicting_financial_source', row.orderId);
      flag(refundOwner, 'conflicting_financial_source', row.orderId);
      continue;
    }
    if (!kind) {
      if (['adjustment', 'reversal'].includes(row.entryType)) {
        excludedAdjustmentMinor += row.amountMinor;
        flag(directOwner, 'unallocated_correction', row.orderId);
      }
      continue;
    }
    if ((row.entryType === 'payment' || historicalReceipts.has(row.id)) && row.orderId) paidOrders.add(row.orderId);
    if (row.entryType === 'refund' && row.refundId) recordedRefunds.add(row.refundId);
    const summary = userId == null ? null : summaries.get(userId);
    if (!summary) { unattributedMinor += row.amountMinor; continue; }
    const entries = attributedEntryIds.get(userId!) ?? [];
    entries.push(row.id); attributedEntryIds.set(userId!, entries);
    if (kind === 'receipt') summary.receiptsMinor! += row.amountMinor;
    else summary.refundsMinor! -= row.amountMinor;
    const financialOrderId = rootOrder.get(row.id);
    if (financialOrderId) orderNet.set(financialOrderId, (orderNet.get(financialOrderId) ?? 0) + row.amountMinor);
    if (row.entryType === 'payment' || historicalReceipts.has(row.id)) summary.receiptCount++;
    if (row.orderId) references.get(userId!)!.orders.add(row.orderId);
    if (row.entryType === 'payment' && row.orderId && !confirmations.has(row.orderId)) {
      flag(userId, 'payment_confirmation_missing', row.orderId);
    }
  }
  for (const order of sources.orders) {
    if (['paid', 'completed'].includes(order.status) && !paidOrders.has(order.id)
      && order.transactionPurpose !== 'legacy_migration') {
      const summary = summaries.get(order.userId);
      if (summary) summary.historicalOrderCount++;
      flag(order.userId, 'historical_order_without_confirmed_payment', order.id);
    }
    if (confirmations.has(order.id) && !paidOrders.has(order.id)) flag(order.userId, 'confirmation_without_approved_payment', order.id);
  }
  for (const key of sources.keys) {
    if (!key.packageId) continue;
    if (key.orderId && paidOrders.has(key.orderId) && (orderNet.get(key.orderId) ?? 0) > 0 && !key.activatedAt && key.isActive) {
      const userId = orders.get(key.orderId)?.userId;
      const summary = userId == null ? null : summaries.get(userId);
      if (summary) {
        summary.unusedPaidKeyCount++;
        references.get(userId!)!.keys.add(key.id);
      }
    }
    if (!key.orderId && key.activatedAt && key.price > 0 && !key.legacyMigrationId
      && !['internal', 'compensation', 'migration'].includes(key.issuancePurpose)) {
      // Email is only a hint for an unresolved operational reference, never a
      // basis for attributing a receipt. Duplicate email owners stay flagged.
      for (const userId of emailOwners.get(key.email?.trim().toLowerCase() ?? '') ?? []) {
        summaries.get(userId)!.historicalKeyCount++;
        flag(userId, 'manual_key_without_payment_evidence', null, key.id);
      }
    }
  }
  for (const refund of sources.refunds) {
    if (!recordedRefunds.has(refund.id)) flag(refund.userId, 'refund_without_approved_entry', refund.orderId);
  }
  for (const [id, summary] of summaries) {
    summary.netPaidMinor = summary.receiptsMinor! - summary.refundsMinor!;
    if (invalidClients.has(id) || ![summary.receiptsMinor, summary.refundsMinor, summary.netPaidMinor].every(Number.isSafeInteger)) {
      summaries.set(id, unavailableClientPaymentSummary(generatedAt)); continue;
    }
    summary.reasons = [...reasons.get(id)!].sort();
    summary.coverage = summary.reasons.length ? 'needs_reconciliation'
      : summary.receiptCount || summary.refundsMinor ? 'recorded_evidence_only' : 'no_payment_recorded';
    const refs = references.get(id)!;
    summary.orderIds = [...refs.orders].sort((a, b) => a - b).slice(0, 10);
    summary.keyIds = [...refs.keys].sort((a, b) => a - b).slice(0, 10);
    summary.referencesTruncated = refs.orders.size > 10 || refs.keys.size > 10;
  }
  return { summaries, unattributedMinor, excludedAdjustmentMinor, attributedEntryIds };
}

export async function readClientPaymentSummaries(client: D1Database, clients: ClientPaymentClient[]) {
  const generatedAt = new Date().toISOString();
  try {
    // A D1 batch supplies a consistent read snapshot. Each source is fetched
    // once, not once per client. Small source scans are measured at release.
    const names = Object.keys(CLIENT_PAYMENT_SOURCE_SQL) as Array<keyof ClientPaymentSources>;
    const results = await client.batch(names.map(name => client.prepare(CLIENT_PAYMENT_SOURCE_SQL[name]).bind(CLIENT_PAYMENT_SOURCE_LIMIT + 1)));
    if (results.some(result => !result.success || (result.results?.length ?? 0) > CLIENT_PAYMENT_SOURCE_LIMIT)) throw new Error('source_limit');
    const sources = Object.fromEntries(names.map((name, i) => [name, results[i].results])) as ClientPaymentSources;
    return buildClientPaymentSummaries(clients, sources, generatedAt);
  } catch {
    // Fail closed for money while allowing support to inspect the rest of the
    // client's profile. Never convert a failed/incomplete source into paid 0.
    return { summaries: new Map(clients.map(row => [row.id, unavailableClientPaymentSummary(generatedAt)])),
      unattributedMinor: null, excludedAdjustmentMinor: null, attributedEntryIds: new Map<number, number[]>() };
  }
}
