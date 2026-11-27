import type { D1Database } from "@cloudflare/workers-types";
import { createHash } from "node:crypto";
import type { FinanceActor } from "./financial-expense.service";
import {
  normalizeFinancialPostingDate,
  validateAdjustmentAmount,
} from "./financial-control.service";
import type {
  ReconciliationDecision,
  ReconciliationDecisionPreview,
  ReconciliationFilter,
  ReconciliationItem,
} from "../../shared/financialReconciliation";
import {
  RECONCILIATION_CONFIDENCE,
  RECONCILIATION_SOURCES,
  RECONCILIATION_STATUSES,
  RECONCILIATION_TREATMENTS,
} from "../../shared/financialReconciliation";

export class HistoricalReviewError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT",
    message: string
  ) {
    super(message);
  }
}
function access(actor: FinanceActor, ownerOnly = false) {
  if (
    !["owner", "manager"].includes(actor.access) ||
    (ownerOnly && (actor.access !== "owner" || actor.actorType !== "admin"))
  ) {
    throw new HistoricalReviewError(
      "FORBIDDEN",
      ownerOnly
        ? "Only the finance owner can review historical sources and decisions."
        : "Finance reconciliation access is required."
    );
  }
}
const positiveId = (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "Use a positive exact record ID."
    );
};
const itemFields = `id,source_type AS sourceType,source_reference AS sourceReference,issue_type AS issueType,
 confidence_level AS confidenceLevel,status,proposed_treatment AS proposedTreatment,
 proposed_amount_ils_minor AS proposedAmountIlsMinor,notes,created_at AS createdAt,updated_at AS updatedAt`;
export function historicalDraftVersion(item: ReconciliationItem) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        item.id,
        item.sourceType,
        item.sourceReference,
        item.issueType,
        item.confidenceLevel,
        item.status,
        item.proposedTreatment,
        item.proposedAmountIlsMinor,
        item.notes,
        item.createdAt,
        item.updatedAt,
      ])
    )
    .digest("hex");
}

/** One indexed result page; summaries are separate and never derive totals from it. */
export async function listHistoricalReviewItems(
  client: D1Database,
  actor: FinanceActor,
  input: ReconciliationFilter
) {
  access(actor);
  if (
    !RECONCILIATION_STATUSES.includes(input.status) ||
    (input.sourceType && !RECONCILIATION_SOURCES.includes(input.sourceType)) ||
    (input.treatment && !RECONCILIATION_TREATMENTS.includes(input.treatment)) ||
    (input.confidence && !RECONCILIATION_CONFIDENCE.includes(input.confidence))
  )
    throw new HistoricalReviewError("BAD_REQUEST", "Invalid review filters.");
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "Use a page size between 1 and 25."
    );
  const where = ["status=?"],
    values: unknown[] = [input.status];
  if (input.sourceType) {
    where.push("source_type=?");
    values.push(input.sourceType);
  }
  if (input.treatment) {
    where.push("proposed_treatment=?");
    values.push(input.treatment);
  }
  if (input.confidence) {
    where.push("confidence_level=?");
    values.push(input.confidence);
  }
  if (input.exact) {
    positiveId(input.exact.id);
    if (input.exact.type === "item") {
      where.push("id=?");
      values.push(input.exact.id);
    } else {
      where.push(
        input.exact.type === "order"
          ? "source_type='order'"
          : "source_type IN ('registration_key','renewal_key','upgrade_key')"
      );
      where.push("source_reference=?");
      values.push(String(input.exact.id));
    }
  }
  if (input.before) {
    positiveId(input.before.id);
    if (!input.before.updatedAt || input.before.updatedAt.length > 50)
      throw new HistoricalReviewError(
        "BAD_REQUEST",
        "Invalid review-page cursor."
      );
    where.push("updated_at<=? AND (updated_at<? OR (updated_at=? AND id<?))");
    values.push(
      input.before.updatedAt,
      input.before.updatedAt,
      input.before.updatedAt,
      input.before.id
    );
  }
  // Exact IDs use their PK/source indexes; the ordinary cursor uses the ordered status index.
  const index = input.exact
    ? input.exact.type === "item"
      ? ""
      : "INDEXED BY idx_financial_reconciliation_source"
    : "INDEXED BY idx_financial_reconciliation_status_updated";
  const result = await client
    .prepare(
      `SELECT ${itemFields} FROM financial_reconciliation_items ${index}
    WHERE ${where.join(" AND ")} ORDER BY updated_at DESC,id DESC LIMIT ?`
    )
    .bind(...values, limit + 1)
    .all<ReconciliationItem>();
  const items = result.results
      .slice(0, limit)
      .map(item => ({ ...item, draftVersion: historicalDraftVersion(item) })),
    last = items.at(-1);
  return {
    items,
    hasMore: result.results.length > limit,
    nextCursor:
      result.results.length > limit && last
        ? { updatedAt: last.updatedAt, id: last.id }
        : null,
  };
}

export type HistoricalSourceRecord = {
  kind: "order" | "key";
  id: number;
  orderId: number | null;
  status: string | null;
  nativeAmountMinor: number;
  currency: string;
  createdAt: string | null;
  activatedAt: string | null;
  isActive: number | null;
  packageId: number | null;
  proofUrl: string | null;
  paymentConfirmed: number;
  confirmedAt: string | null;
};
export async function readHistoricalSnapshot(
  client: D1Database,
  itemId: number
) {
  positiveId(itemId);
  const item = await client
    .prepare(
      `SELECT ${itemFields} FROM financial_reconciliation_items WHERE id=?`
    )
    .bind(itemId)
    .first<ReconciliationItem>();
  if (!item)
    throw new HistoricalReviewError("NOT_FOUND", "Review item was not found.");
  const id = Number(item.sourceReference);
  let source: HistoricalSourceRecord | null = null;
  if (
    /^\d+$/.test(item.sourceReference) &&
    Number.isSafeInteger(id) &&
    id > 0
  ) {
    if (item.sourceType === "order")
      source = await client
        .prepare(
          `SELECT 'order' AS kind,o.id,o.id AS orderId,o.status,
      o.totalAmount AS nativeAmountMinor,o.currency,o.createdAt,NULL AS activatedAt,NULL AS isActive,NULL AS packageId,
      o.paymentProofUrl AS proofUrl,EXISTS(SELECT 1 FROM order_payment_confirmations c WHERE c.order_id=o.id) AS paymentConfirmed,
      (SELECT c.paid_at FROM order_payment_confirmations c WHERE c.order_id=o.id LIMIT 1) AS confirmedAt
      FROM orders o WHERE o.id=?`
        )
        .bind(id)
        .first<HistoricalSourceRecord>();
    else if (
      ["registration_key", "renewal_key", "upgrade_key"].includes(
        item.sourceType
      )
    )
      source = await client
        .prepare(
          `SELECT 'key' AS kind,k.id,k.orderId,NULL AS status,
      k.price*100 AS nativeAmountMinor,k.currency,k.createdAt,k.activatedAt,k.isActive,k.packageId,NULL AS proofUrl,
      EXISTS(SELECT 1 FROM order_payment_confirmations c WHERE c.order_id=k.orderId) AS paymentConfirmed,
      (SELECT c.paid_at FROM order_payment_confirmations c WHERE c.order_id=k.orderId LIMIT 1) AS confirmedAt
      FROM registrationKeys k WHERE k.id=?`
        )
        .bind(id)
        .first<HistoricalSourceRecord>();
  }
  const reviewVersion = createHash("sha256")
    .update(JSON.stringify({ item, source }))
    .digest("hex");
  return { item, source, reviewVersion };
}

export async function getHistoricalSourceReview(
  client: D1Database,
  actor: FinanceActor,
  itemId: number,
  before?: { createdAt: string; id: number }
) {
  access(actor, true);
  if (before) {
    positiveId(before.id);
    if (!before.createdAt || before.createdAt.length > 50)
      throw new HistoricalReviewError("BAD_REQUEST", "Invalid history cursor.");
  }
  const snapshot = await readHistoricalSnapshot(client, itemId);
  const result = await client
    .prepare(
      `SELECT id,action,previous_status AS previousStatus,next_status AS nextStatus,
    actor_type AS actorType,actor_id AS actorId,reason,created_at AS createdAt
    FROM financial_reconciliation_events INDEXED BY idx_financial_reconciliation_events_item_created WHERE reconciliation_item_id=?
    ${before ? "AND created_at<=? AND (created_at<? OR (created_at=? AND id<?))" : ""}
    ORDER BY created_at DESC,id DESC LIMIT 21`
    )
    .bind(
      itemId,
      ...(before
        ? [before.createdAt, before.createdAt, before.createdAt, before.id]
        : [])
    )
    .all();
  // Do not expose receipt URLs, identity/key fields or arbitrary audit metadata.
  const source = snapshot.source
    ? (({ proofUrl, ...row }) => ({
        ...row,
        proofAvailable: Boolean(proofUrl),
      }))(snapshot.source)
    : null;
  const events = result.results.slice(0, 20),
    last = events.at(-1);
  return {
    ...snapshot,
    source,
    events,
    nextEventCursor:
      result.results.length > 20 && last
        ? { createdAt: String(last.createdAt), id: Number(last.id) }
        : null,
  };
}

/** Both writes share the same optimistic predicate and one D1 transaction. */
export async function saveHistoricalDraft(
  client: D1Database,
  input: {
    actor: FinanceActor;
    itemId: number;
    proposedTreatment: string;
    proposedAmountIlsMinor?: number | null;
    notes: string;
    expectedDraftVersion?: string;
  }
) {
  access(input.actor);
  positiveId(input.itemId);
  if (!RECONCILIATION_TREATMENTS.includes(input.proposedTreatment as any))
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "Choose a supported proposal classification."
    );
  if (input.proposedAmountIlsMinor != null) {
    try {
      validateAdjustmentAmount(input.proposedAmountIlsMinor);
    } catch (error) {
      throw new HistoricalReviewError(
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Invalid proposed amount."
      );
    }
  }
  const item = await client
    .prepare(
      `SELECT ${itemFields} FROM financial_reconciliation_items WHERE id=?`
    )
    .bind(input.itemId)
    .first<ReconciliationItem>();
  if (!item)
    throw new HistoricalReviewError("NOT_FOUND", "Review item was not found.");
  if (
    item.status !== "unresolved" ||
    (input.expectedDraftVersion &&
      input.expectedDraftVersion !== historicalDraftVersion(item))
  ) {
    throw new HistoricalReviewError(
      "CONFLICT",
      "This proposal changed. Refresh it before saving your edits."
    );
  }
  const previousTime = Date.parse(item.updatedAt);
  const now = new Date(
    Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)
  ).toISOString();
  const notes = input.notes.trim().slice(0, 1000),
    amount = input.proposedAmountIlsMinor ?? null;
  const metadata = JSON.stringify({
    reconciliationVersion: 1,
    previousTreatment: item.proposedTreatment,
    nextTreatment: input.proposedTreatment,
    previousAmountIlsMinor: item.proposedAmountIlsMinor,
    nextAmountIlsMinor: amount,
  });
  const predicate =
    "id=? AND status='unresolved' AND updated_at=? AND proposed_treatment=? AND proposed_amount_ils_minor IS ? AND notes IS ? AND source_type=? AND source_reference=? AND issue_type=? AND confidence_level=? AND created_at=?";
  const snapshot = [
    item.id,
    item.updatedAt,
    item.proposedTreatment,
    item.proposedAmountIlsMinor,
    item.notes,
    item.sourceType,
    item.sourceReference,
    item.issueType,
    item.confidenceLevel,
    item.createdAt,
  ];
  const results = await client.batch([
    client
      .prepare(
        `INSERT INTO financial_reconciliation_events(reconciliation_item_id,action,previous_status,next_status,actor_type,actor_id,reason,metadata,created_at)
      SELECT id,'draft_updated','unresolved','unresolved',?,?,'Reconciliation draft proposal updated',?,?
      FROM financial_reconciliation_items WHERE ${predicate}`
      )
      .bind(
        input.actor.actorType,
        input.actor.actorId,
        metadata,
        now,
        ...snapshot
      ),
    client
      .prepare(
        `UPDATE financial_reconciliation_items SET proposed_treatment=?,proposed_amount_ils_minor=?,notes=?,updated_at=?
      WHERE ${predicate}`
      )
      .bind(input.proposedTreatment, amount, notes, now, ...snapshot),
  ]);
  if (Number(results[1].meta.changes) !== 1)
    throw new HistoricalReviewError(
      "CONFLICT",
      "This proposal changed. Refresh it before saving your edits."
    );
  return client
    .prepare(
      `SELECT ${itemFields} FROM financial_reconciliation_items WHERE id=?`
    )
    .bind(item.id)
    .first<ReconciliationItem>();
}

export function normalizeHistoricalReceiptInput(input: {
  effectiveDate?: string | null;
  amountIlsMinor?: number | null;
}) {
  if (
    !input.effectiveDate ||
    input.amountIlsMinor == null ||
    input.amountIlsMinor <= 0
  ) {
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "Enter the genuine payment date and a verified positive ILS receipt amount."
    );
  }
  let effectiveAt: string;
  try {
    effectiveAt = normalizeFinancialPostingDate(input.effectiveDate);
    validateAdjustmentAmount(input.amountIlsMinor);
  } catch (error) {
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      error instanceof Error
        ? error.message
        : "Invalid historical payment details."
    );
  }
  if (effectiveAt.slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "A genuine historical payment date cannot be in the future (UTC)."
    );
  }
  return {
    effectiveAt,
    reportingMonth: effectiveAt.slice(0, 7),
    amountIlsMinor: input.amountIlsMinor,
  };
}

export async function previewHistoricalDecision(
  client: D1Database,
  actor: FinanceActor,
  request: ReconciliationDecision
): Promise<ReconciliationDecisionPreview> {
  access(actor, true);
  if (request.reason.trim().length < 5)
    throw new HistoricalReviewError(
      "BAD_REQUEST",
      "Document the evidence and reason in at least five characters."
    );
  const snapshot = await readHistoricalSnapshot(client, request.itemId);
  if (snapshot.item.status !== "unresolved")
    throw new HistoricalReviewError(
      "CONFLICT",
      "This item already has a saved decision. Refresh the queue."
    );
  let effectiveAt: string | null = null,
    amountIlsMinor = 0,
    periodLocked = false;
  if (request.decision === "approved_adjustment") {
    if (!snapshot.source)
      throw new HistoricalReviewError(
        "CONFLICT",
        "The source is missing or unsupported. Keep the item unresolved or document an exclusion."
      );
    if (snapshot.source.paymentConfirmed)
      throw new HistoricalReviewError(
        "CONFLICT",
        "A saved payment already covers this source. Do not recognize it again."
      );
    if (snapshot.item.proposedTreatment !== "historical_payment_known_date")
      throw new HistoricalReviewError(
        "BAD_REQUEST",
        "Verify the genuine payment date and amount in the draft before recognizing a historical receipt."
      );
    const receipt = normalizeHistoricalReceiptInput(request);
    effectiveAt = receipt.effectiveAt;
    amountIlsMinor = receipt.amountIlsMinor;
    periodLocked = Boolean(
      await client
        .prepare("SELECT month FROM financial_period_locks WHERE month=?")
        .bind(effectiveAt.slice(0, 7))
        .first()
    );
  }
  return {
    itemId: request.itemId,
    request,
    reviewVersion: snapshot.reviewVersion,
    effectiveAt,
    amountIlsMinor,
    periodLocked,
    generatedAt: new Date().toISOString(),
  };
}
