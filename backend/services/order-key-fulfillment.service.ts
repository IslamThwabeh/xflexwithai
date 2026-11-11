import { sql } from 'drizzle-orm';

export type OrderKeyFulfillmentRow = {
  orderId: number;
  confirmationId: number | null;
  keyId: number | null;
  packageId: number | null;
  isActive: number | null;
  activatedAt: string | null;
  expiresAt: string | null;
};

export function orderKeyFulfillmentQuery(orderIds: number[]) {
  // Drive from order primary keys; the explicit non-null package predicate
  // permits the existing partial (orderId, packageId) key index.
  return sql`SELECT o.id AS orderId, c.id AS confirmationId,
    k.id AS keyId, k.packageId, k.isActive, k.activatedAt, k.expiresAt
    FROM orders o
    LEFT JOIN order_payment_confirmations c ON c.order_id = o.id
    LEFT JOIN registrationKeys k ON k.orderId = o.id AND k.packageId IS NOT NULL
    WHERE o.id IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`;
}

export function renewalKeyConflictQuery(orderId: number, packageId: number, email: string) {
  // Assignment writes normalize email. This probe uses the assignment index;
  // the unchanged DB trigger also protects legacy spellings and races.
  return sql`SELECT id, orderId, expiresAt FROM registrationKeys
    WHERE email = ${email} AND isActive = 1 AND activatedAt IS NULL
      AND packageId = ${packageId} AND coalesce(isRenewal, 0) = 1
      AND coalesce(isUpgrade, 0) = 0
      AND (orderId IS NULL OR orderId <> ${orderId})
    LIMIT 1`;
}

export function describeOrderKeyFulfillment(input: {
  status: string;
  transactionPurpose?: string | null;
  packageIds: number[];
  rows: OrderKeyFulfillmentRow[];
  now?: number;
}) {
  const paymentConfirmed = input.rows.some(row => row.confirmationId != null);
  if (!input.packageIds.length || input.transactionPurpose === 'copier_subscription') {
    return { paymentConfirmed, keyStatus: 'not_applicable' as const };
  }
  const keys = input.rows.filter(row => row.keyId != null && input.packageIds.includes(Number(row.packageId)));
  if (input.status !== 'completed') return { paymentConfirmed, keyStatus: 'awaiting_approval' as const };
  // Historical completed orders must never become new revenue through retry.
  if (!paymentConfirmed) return { paymentConfirmed, keyStatus: 'historical_review' as const };
  const missing = input.packageIds.some(id => !keys.some(key => Number(key.packageId) === id));
  if (missing) return { paymentConfirmed, keyStatus: 'issuance_pending' as const };
  if (keys.every(key => !!key.activatedAt)) return { paymentConfirmed, keyStatus: 'redeemed' as const };
  // A deliberately closed/deactivated key is not a failed issuance. Never
  // present routine retry as permission to reopen that entitlement.
  if (keys.some(key => !key.activatedAt && !key.isActive)) return { paymentConfirmed, keyStatus: 'closed' as const };
  if (keys.some(key => !key.activatedAt && key.expiresAt && Date.parse(key.expiresAt) <= (input.now ?? Date.now()))) {
    return { paymentConfirmed, keyStatus: 'redemption_expired' as const };
  }
  return { paymentConfirmed, keyStatus: 'key_ready' as const };
}
