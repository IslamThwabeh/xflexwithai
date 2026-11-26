import type { D1Database } from "@cloudflare/workers-types";
import {
  getOrderCancellationBlock,
  type OrderCancellationAuthority,
  type OrderCancellationFacts,
} from "../../shared/orderCancellation";

type Snapshot = {
  id: number;
  userId: number;
  status: string;
  updatedAt: string;
  paymentProofUrl: string | null;
  paymentConfirmed: number;
  keysIssued: number;
  financialHistory: number;
  accessHistory: number;
  retired: number;
};

export class OrderCancellationError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "BAD_REQUEST",
    message: string
  ) {
    super(message);
  }
}

type OrderHistoryEntry = {
  id: number;
  previousStatus: string;
  newStatus: string;
  actorType: string;
  actorId: number;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
};
export function orderStatusHistorySql(beforeId?: number) {
  return `SELECT h.id,h.previous_status AS previousStatus,h.new_status AS newStatus,
    h.actor_type AS actorType,h.actor_id AS actorId,
    CASE WHEN h.actor_type='admin' THEN a.name WHEN h.actor_type='staff' THEN u.name ELSE NULL END AS actorName,
    h.reason,h.created_at AS createdAt FROM order_status_history h
    LEFT JOIN admins a ON h.actor_type='admin' AND a.id=h.actor_id
    LEFT JOIN users u ON h.actor_type='staff' AND u.id=h.actor_id
    WHERE h.order_id=? ${beforeId === undefined ? "" : "AND h.id<?"} ORDER BY h.id DESC LIMIT 11`;
}

export async function readOrderStatusHistory(
  database: D1Database,
  orderId: number,
  beforeId?: number
) {
  if (
    !(await database
      .prepare("SELECT id FROM orders WHERE id=?")
      .bind(orderId)
      .first())
  ) {
    throw new OrderCancellationError("NOT_FOUND", "Order not found.");
  }
  const params = beforeId === undefined ? [orderId] : [orderId, beforeId];
  const result = await database
    .prepare(orderStatusHistorySql(beforeId))
    .bind(...params)
    .all<OrderHistoryEntry>();
  const entries = result.results.slice(0, 10);
  return {
    orderId,
    entries,
    nextCursor: result.results.length > 10 ? entries.at(-1)!.id : null,
  };
}

// All relationships are checked by order ID. Migration139 supplies the remaining
// non-unique lookup indexes; confirmation, retirement and Copier use existing keys.
const relationships = {
  paymentConfirmed:
    "EXISTS(SELECT 1 FROM order_payment_confirmations p WHERE p.order_id=o.id)",
  keysIssued: "EXISTS(SELECT 1 FROM registrationKeys k WHERE k.orderId=o.id)",
  financialHistory:
    "EXISTS(SELECT 1 FROM financial_ledger_entries l WHERE l.order_id=o.id)",
  accessHistory: `(EXISTS(SELECT 1 FROM live_package_entitlements e WHERE e.orderId=o.id)
    OR EXISTS(SELECT 1 FROM packageSubscriptions s WHERE s.orderId=o.id)
    OR EXISTS(SELECT 1 FROM trade_copier_subscriptions c WHERE c.order_id=o.id))`,
  retired: "EXISTS(SELECT 1 FROM order_retirements r WHERE r.order_id=o.id)",
} as const;

export const ORDER_CANCELLATION_REVIEW_SQL = `SELECT o.id,o.userId,o.status,o.updatedAt,o.paymentProofUrl,
  ${Object.entries(relationships)
    .map(([key, sql]) => `${sql} AS ${key}`)
    .join(",\n")}
  FROM orders o WHERE o.id=? LIMIT 1`;

export async function readOrderCancellationReview(
  database: D1Database,
  orderId: number,
  authority: OrderCancellationAuthority
) {
  const row = await database
    .prepare(ORDER_CANCELLATION_REVIEW_SQL)
    .bind(orderId)
    .first<Snapshot>();
  if (!row) throw new OrderCancellationError("NOT_FOUND", "Order not found.");
  const facts: OrderCancellationFacts = {
    status: row.status,
    receiptPresent: !!row.paymentProofUrl?.trim(),
    paymentConfirmed: !!row.paymentConfirmed,
    keysIssued: !!row.keysIssued,
    financialHistory: !!row.financialHistory,
    accessHistory: !!row.accessHistory,
    retired: !!row.retired,
  };
  const block = getOrderCancellationBlock(facts, authority);
  return {
    orderId: row.id,
    facts,
    canCancel: block === null,
    block,
    version: {
      status: row.status,
      updatedAt: row.updatedAt,
      paymentProofUrl: row.paymentProofUrl,
    },
  };
}

export type CancelOrderInput = {
  orderId: number;
  reason: string;
  confirmed: true;
  version: {
    status: string;
    updatedAt: string;
    paymentProofUrl: string | null;
  };
  actorType: "admin" | "staff";
  actorId: number;
  authority: OrderCancellationAuthority;
  ipAddress?: string | null;
};

const noRelatedRecords = Object.values(relationships)
  .map(predicate => `NOT ${predicate}`)
  .join(" AND ");
export const ORDER_CANCELLATION_UPDATE_SQL = `UPDATE orders AS o SET status='cancelled',updatedAt=?
  WHERE o.id=? AND o.status IN ('pending','awaiting_confirmation')
  AND o.status=? AND o.updatedAt IS ? AND o.paymentProofUrl IS ?
  AND ((length(trim(COALESCE(o.paymentProofUrl,'')))=0 AND ?=1)
    OR (length(trim(COALESCE(o.paymentProofUrl,'')))>0 AND ?=1))
  AND ${noRelatedRecords} RETURNING id`;

const blockError = (
  block: NonNullable<ReturnType<typeof getOrderCancellationBlock>>
) =>
  new OrderCancellationError(
    block === "finance_review" || block === "operational_access"
      ? "FORBIDDEN"
      : "CONFLICT",
    `Order cancellation requires review: ${block}.`
  );

/** Status and audit append succeed together, or the complete batch rolls back.
 * Never revokes keys/access, alters receipts/cash, deletes a record or notifies a provider. */
export async function cancelReviewedUnpaidOrder(
  database: D1Database,
  input: CancelOrderInput
) {
  const reason = input.reason.trim();
  if (
    input.confirmed !== true ||
    reason.length < 5 ||
    reason.length > 500 ||
    !Number.isSafeInteger(input.actorId) ||
    input.actorId <= 0
  ) {
    throw new OrderCancellationError(
      "BAD_REQUEST",
      "Confirm the reviewed cancellation and supply a reason of 5–500 characters."
    );
  }
  const current = await readOrderCancellationReview(
    database,
    input.orderId,
    input.authority
  );
  if (current.facts.status === "cancelled") {
    const prior = await database
      .prepare(
        `SELECT actor_type,actor_id,reason,previous_status,created_at
      FROM order_status_history WHERE order_id=? AND new_status='cancelled' ORDER BY id DESC LIMIT 1`
      )
      .bind(input.orderId)
      .first<{
        actor_type: string;
        actor_id: number;
        reason: string;
        previous_status: string;
        created_at: string;
      }>();
    if (
      prior?.actor_type === input.actorType &&
      prior.actor_id === input.actorId &&
      prior.reason === reason &&
      prior.previous_status === input.version.status &&
      prior.created_at === current.version.updatedAt &&
      input.version.paymentProofUrl === current.version.paymentProofUrl &&
      getOrderCancellationBlock(
        { ...current.facts, status: input.version.status },
        input.authority
      ) === null
    ) {
      return { orderId: input.orderId, idempotent: true };
    }
  }
  if (current.block) throw blockError(current.block);
  if (
    current.version.status !== input.version.status ||
    current.version.updatedAt !== input.version.updatedAt ||
    current.version.paymentProofUrl !== input.version.paymentProofUrl
  ) {
    throw new OrderCancellationError(
      "CONFLICT",
      "The order changed after review. Load its latest cancellation review."
    );
  }
  const now = new Date().toISOString();
  const [updated] = await database.batch([
    database
      .prepare(ORDER_CANCELLATION_UPDATE_SQL)
      .bind(
        now,
        input.orderId,
        input.version.status,
        input.version.updatedAt,
        input.version.paymentProofUrl,
        Number(input.authority.operational),
        Number(input.authority.financeReview)
      ),
    database
      .prepare(
        `INSERT INTO order_status_history
      (order_id,user_id,previous_status,new_status,actor_type,actor_id,reason,ip_address,created_at)
      SELECT id,userId,?,'cancelled',?,?,?,?,? FROM orders WHERE id=? AND status='cancelled' AND changes()>0`
      )
      .bind(
        input.version.status,
        input.actorType,
        input.actorId,
        reason,
        input.ipAddress ?? null,
        now,
        input.orderId
      ),
  ]);
  if (!updated.results?.length) {
    throw new OrderCancellationError(
      "CONFLICT",
      "The order changed during cancellation. Reload and review the latest payment, evidence and access state."
    );
  }
  return { orderId: input.orderId, idempotent: false };
}
