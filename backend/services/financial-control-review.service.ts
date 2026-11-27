import type { D1Database } from "@cloudflare/workers-types";
import type { FinanceActor } from "./financial-expense.service";
import {
  normalizeFinancialPostingDate,
  validateAdjustmentAmount,
} from "./financial-control.service";
import { FINANCIAL_PAYMENT_PURPOSES } from "../../shared/financialTransactionPurpose";
import type {
  FinancialControlEntry,
  FinancialCorrectionPreview,
  FinancialCorrectionRequest,
} from "../../shared/financialCorrection";

export class FinancialCorrectionReviewError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND",
    message: string
  ) {
    super(message);
  }
}
const owner = (actor: FinanceActor) => {
  if (actor.access !== "owner" || actor.actorType !== "admin")
    throw new FinancialCorrectionReviewError(
      "FORBIDDEN",
      "Only the finance owner can review ledger corrections."
    );
};
const fields = `l.id,l.entry_type AS entryType,l.effective_at AS effectiveAt,l.base_amount_ils_minor AS baseAmountIlsMinor,
 l.description,l.source_type AS sourceType,l.source_reference AS sourceReference,l.order_id AS orderId,l.expense_id AS expenseId,l.refund_id AS refundId,
 COALESCE(l.transaction_purpose,CASE l.source_type WHEN 'order_payment_new_sale' THEN 'new_sale' WHEN 'order_payment_renewal' THEN 'renewal' WHEN 'order_payment_upgrade' THEN 'upgrade' WHEN 'order_payment_copier_subscription' THEN 'copier_subscription' END) AS transactionPurpose`;
export type FinancialControlEntryFilter = {
  limit?: number;
  ledgerId?: number;
  orderId?: number;
  before?: { effectiveAt: string; id: number };
};

/** No global count or text scan; output and cursor are bounded, exact IDs use their indexes. */
export async function listFinancialControlEntries(
  client: D1Database,
  actor: FinanceActor,
  input: FinancialControlEntryFilter
) {
  owner(actor);
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new FinancialCorrectionReviewError(
      "BAD_REQUEST",
      "Page size must be between 1 and 25."
    );
  for (const value of [input.ledgerId, input.orderId, input.before?.id])
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
      throw new FinancialCorrectionReviewError(
        "BAD_REQUEST",
        "Use a positive ledger/order ID."
      );
  if (
    input.before &&
    (!input.before.effectiveAt || input.before.effectiveAt.length > 50)
  )
    throw new FinancialCorrectionReviewError(
      "BAD_REQUEST",
      "Invalid page cursor."
    );
  const where = ["l.status='approved'", "l.entry_type<>'reversal'"],
    binds: unknown[] = [];
  if (input.ledgerId) {
    where.push("l.id=?");
    binds.push(input.ledgerId);
  }
  if (input.orderId) {
    where.push("l.order_id=?");
    binds.push(input.orderId);
  }
  if (input.before) {
    where.push(
      "l.effective_at<=? AND (l.effective_at<? OR (l.effective_at=? AND l.id<?))"
    );
    binds.push(
      input.before.effectiveAt,
      input.before.effectiveAt,
      input.before.effectiveAt,
      input.before.id
    );
  }
  const index = input.ledgerId
    ? ""
    : input.orderId
      ? " INDEXED BY idx_financial_ledger_order_guard"
      : " INDEXED BY idx_financial_controls_entry_page";
  const result = await client
    .prepare(
      `SELECT ${fields},EXISTS(SELECT 1 FROM financial_ledger_entries r WHERE r.entry_type='reversal' AND r.reversal_of_entry_id=l.id) AS reversed FROM financial_ledger_entries l${index} WHERE ${where.join(" AND ")} ORDER BY l.effective_at DESC,l.id DESC LIMIT ?`
    )
    .bind(...binds, limit + 1)
    .all<FinancialControlEntry>();
  const rows = result.results ?? [],
    items = rows
      .slice(0, limit)
      .map(row => ({ ...row, reversed: !!row.reversed })),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? { effectiveAt: last.effectiveAt, id: last.id }
        : null,
  };
}

export async function previewFinancialCorrection(
  client: D1Database,
  actor: FinanceActor,
  request: FinancialCorrectionRequest
): Promise<FinancialCorrectionPreview> {
  owner(actor);
  const original = await client
    .prepare(
      `SELECT ${fields},l.status FROM financial_ledger_entries l WHERE l.id=?`
    )
    .bind(request.entryId)
    .first<FinancialControlEntry & { status: string }>();
  if (!original)
    throw new FinancialCorrectionReviewError(
      "NOT_FOUND",
      "Ledger entry not found."
    );
  if (!Number.isSafeInteger(original.baseAmountIlsMinor))
    throw new FinancialCorrectionReviewError(
      "CONFLICT",
      "The original amount needs financial-source review before correction."
    );
  if (original.status !== "approved" || original.entryType === "reversal")
    throw new FinancialCorrectionReviewError(
      "CONFLICT",
      "Only an approved original entry can be corrected."
    );
  const reversed = await client
    .prepare(
      "SELECT id FROM financial_ledger_entries WHERE entry_type='reversal' AND reversal_of_entry_id=? LIMIT 1"
    )
    .bind(original.id)
    .first();
  if (reversed)
    throw new FinancialCorrectionReviewError(
      "CONFLICT",
      "This entry is already reversed. Refresh the list."
    );
  let effectiveAt = original.effectiveAt,
    nextPurpose = original.transactionPurpose,
    reversalAmountIlsMinor = 0,
    replacementAmountIlsMinor: number | null = null;
  const reason = request.reason.trim();
  if (
    reason.length < (request.action === "reclassify" ? 5 : 3) ||
    reason.length > 1000
  )
    throw new FinancialCorrectionReviewError(
      "BAD_REQUEST",
      "A documented correction reason is required."
    );
  if (request.action === "reverse") {
    try {
      effectiveAt = normalizeFinancialPostingDate(request.effectiveDate);
    } catch (error) {
      throw new FinancialCorrectionReviewError(
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Invalid correction date."
      );
    }
    reversalAmountIlsMinor = -original.baseAmountIlsMinor;
    if (request.replacementAmountIlsMinor != null) {
      try {
        validateAdjustmentAmount(request.replacementAmountIlsMinor);
      } catch (error) {
        throw new FinancialCorrectionReviewError(
          "BAD_REQUEST",
          error instanceof Error ? error.message : "Invalid replacement amount."
        );
      }
      if (
        !request.replacementDescription?.trim() ||
        request.replacementDescription.length > 1000
      )
        throw new FinancialCorrectionReviewError(
          "BAD_REQUEST",
          "A replacement description is required."
        );
      replacementAmountIlsMinor = request.replacementAmountIlsMinor;
    }
  } else {
    if (
      original.entryType !== "payment" ||
      !FINANCIAL_PAYMENT_PURPOSES.includes(
        original.transactionPurpose as any
      ) ||
      !FINANCIAL_PAYMENT_PURPOSES.includes(request.nextPurpose)
    )
      throw new FinancialCorrectionReviewError(
        "BAD_REQUEST",
        "Only a classified payment can be reclassified."
      );
    if (request.nextPurpose === original.transactionPurpose)
      throw new FinancialCorrectionReviewError(
        "BAD_REQUEST",
        "Choose a different payment category."
      );
    const prefix = `ledger:${original.id}:reclass:`;
    const prior = await client
      .prepare(
        "SELECT id FROM financial_ledger_entries WHERE source_type='financial_reclassification' AND source_reference>=? AND source_reference<? LIMIT 1"
      )
      .bind(prefix, prefix + "\uffff")
      .first();
    if (prior)
      throw new FinancialCorrectionReviewError(
        "CONFLICT",
        "This payment already has a reclassification. Review its existing correction first."
      );
    nextPurpose = request.nextPurpose;
  }
  const reportingMonth = effectiveAt.slice(0, 7),
    lock = await client
      .prepare("SELECT month FROM financial_period_locks WHERE month=?")
      .bind(reportingMonth)
      .first();
  const { status, ...projected } = original;
  return {
    original: projected,
    request: { ...request, reason },
    effectiveAt,
    reportingMonth,
    periodLocked: !!lock,
    reversalAmountIlsMinor,
    replacementAmountIlsMinor,
    ledgerDeltaIlsMinor:
      reversalAmountIlsMinor + (replacementAmountIlsMinor ?? 0),
    previousPurpose: original.transactionPurpose,
    nextPurpose,
    generatedAt: new Date().toISOString(),
  };
}
