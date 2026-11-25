import type { D1Database } from "@cloudflare/workers-types";
import {
  emptyFinancialTotals,
  FINANCIAL_REPORT_VERSION,
  FINANCIAL_TOTAL_FIELDS,
  type FinancialPeriod,
} from "../../shared/financialReport";
import {
  normalizeFinancialReportRange,
  totalFinancialPeriods,
  type FinancialReportGrouping,
} from "./financial-reporting.service";

export const FINANCIAL_REPORT_SOURCE_LIMIT = 10_000;
const CONTEXT_LIMIT = 20_000;
type LedgerRow = {
  id: number;
  entryType: string;
  status: string;
  effectiveAt: string;
  amountMinor: number;
  sourceType: string;
  sourceReference: string | null;
  transactionPurpose: string | null;
  orderId: number | null;
  refundId: number | null;
  expenseId: number | null;
  reversalOfEntryId: number | null;
  category: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  description: string | null;
};
type Kind = "receipt" | "refund" | "expense" | "opening" | "adjustment";
type Resolved = {
  kind: Kind;
  purpose: string | null;
  root: LedgerRow;
  duplicateHistorical: boolean;
};
const purposes = new Set([
  "new_sale",
  "renewal",
  "upgrade",
  "copier_subscription",
]);
const purpose = (row: LedgerRow) =>
  purposes.has(row.transactionPurpose ?? "")
    ? row.transactionPurpose
    : ((
        {
          order_payment_new_sale: "new_sale",
          order_payment_renewal: "renewal",
          order_payment_upgrade: "upgrade",
          order_payment_copier_subscription: "copier_subscription",
        } as Record<string, string>
      )[row.sourceType] ?? null);
const parentId = (row: LedgerRow) =>
  row.entryType === "reversal"
    ? row.reversalOfEntryId
    : row.entryType === "adjustment" &&
        ["financial_replacement", "financial_reclassification"].includes(
          row.sourceType
        )
      ? Number(/^ledger:(\d+):/.exec(row.sourceReference ?? "")?.[1]) || -1
      : null;
const chunks = <T>(values: T[]) =>
  Array.from({ length: Math.ceil(values.length / 500) }, (_, index) =>
    values.slice(index * 500, index * 500 + 500)
  );
const timestamp = (value: string) =>
  Date.parse(
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value
  );
const columns = `l.id,l.entry_type AS entryType,l.status,l.effective_at AS effectiveAt,
 l.base_amount_ils_minor AS amountMinor,l.source_type AS sourceType,l.source_reference AS sourceReference,
 l.transaction_purpose AS transactionPurpose,l.order_id AS orderId,l.refund_id AS refundId,l.expense_id AS expenseId,
 l.reversal_of_entry_id AS reversalOfEntryId,e.category AS category,l.payment_method AS paymentMethod,
 l.payment_reference AS paymentReference,l.description`;
const from = `FROM financial_ledger_entries l LEFT JOIN financial_expenses e ON e.id=l.expense_id`;

/** Range read plus bounded PK ancestry lookups; no whole-history report scan or write. */
export async function loadFinancialReport(
  client: D1Database,
  input: {
    from: string;
    to: string;
    grouping: FinancialReportGrouping;
    includeLedger: boolean;
    ledgerLimit?: number;
  }
) {
  const generatedAt = new Date().toISOString();
  const range = normalizeFinancialReportRange(input.from, input.to);
  const result = await client
    .prepare(
      `SELECT ${columns},(SELECT MAX(id) FROM financial_ledger_entries) AS snapshotMaxId
    FROM financial_ledger_entries l INDEXED BY idx_financial_ledger_approved_effective_type
    LEFT JOIN financial_expenses e ON e.id=l.expense_id
    WHERE l.status='approved' AND l.effective_at>=? AND l.effective_at<?
    ORDER BY l.effective_at,l.id LIMIT ?`
    )
    .bind(
      range.from,
      range.endExclusiveTimestamp.slice(0, 10),
      FINANCIAL_REPORT_SOURCE_LIMIT + 1
    )
    .all<LedgerRow & { snapshotMaxId: number }>();
  const periodRows = result.results ?? [];
  const snapshotMaxId = periodRows[0]?.snapshotMaxId ?? 0;
  if (periodRows.length > FINANCIAL_REPORT_SOURCE_LIMIT)
    throw Error(
      "This range contains more than 10,000 ledger entries. Choose a smaller date range for a complete report."
    );
  const context = new Map<number, LedgerRow>(
    periodRows.map(row => [row.id, row])
  );
  const attempted = new Set<number>();
  for (let depth = 0; depth < 32; depth++) {
    const ids = [
      ...new Set(
        [...context.values()]
          .map(parentId)
          .filter(
            (id): id is number =>
              id !== null && id > 0 && !context.has(id) && !attempted.has(id)
          )
      ),
    ];
    if (!ids.length) break;
    if (context.size + ids.length > CONTEXT_LIMIT)
      throw Error(
        "Correction history exceeds the report safety limit. Choose a smaller date range."
      );
    for (const group of chunks(ids)) {
      group.forEach(id => attempted.add(id));
      const parents = await client
        .prepare(
          `SELECT ${columns} ${from} WHERE l.id IN (SELECT value FROM json_each(?)) AND l.id<=?`
        )
        .bind(JSON.stringify(group), snapshotMaxId)
        .all<LedgerRow>();
      for (const row of parents.results ?? []) context.set(row.id, row);
    }
  }
  // Historical cash is recognized only with the owner's immutable known-date decision.
  const historicalIds = [
    ...new Set(
      [...context.values()]
        .filter(
          row =>
            row.entryType === "adjustment" &&
            row.sourceType === "historical_reconciliation"
        )
        .map(row =>
          Number(/^reconciliation:(\d+)$/.exec(row.sourceReference ?? "")?.[1])
        )
        .filter(Boolean)
    ),
  ];
  const historical = new Map<
    number,
    { orderId: number | null; eligible: boolean }
  >();
  for (const group of chunks(historicalIds)) {
    const items = await client
      .prepare(
        `SELECT id,status,proposed_treatment AS treatment,source_type AS sourceType,source_reference AS sourceReference
      FROM financial_reconciliation_items WHERE id IN (SELECT value FROM json_each(?))`
      )
      .bind(JSON.stringify(group))
      .all<any>();
    for (const item of items.results ?? [])
      historical.set(item.id, {
        orderId:
          item.sourceType === "order" && /^\d+$/.test(item.sourceReference)
            ? Number(item.sourceReference)
            : null,
        eligible:
          item.status === "approved_adjustment" &&
          item.treatment === "historical_payment_known_date",
      });
  }
  const orderIds = [
    ...new Set(
      [...context.values()]
        .filter(row => row.entryType === "refund")
        .map(row => row.orderId)
        .filter((id): id is number => !!id)
        .concat(
          [...historical.values()]
            .map(item => item.orderId)
            .filter((id): id is number => !!id)
        )
    ),
  ];
  const payments = new Map<number, LedgerRow>();
  for (const group of chunks(orderIds)) {
    const found = await client
      .prepare(
        `SELECT ${columns} FROM financial_ledger_entries l INDEXED BY uq_financial_ledger_payment_order
      LEFT JOIN financial_expenses e ON e.id=l.expense_id WHERE l.status='approved' AND l.entry_type='payment' AND l.order_id IS NOT NULL
      AND l.order_id IN (SELECT value FROM json_each(?)) AND l.id<=?`
      )
      .bind(JSON.stringify(group), snapshotMaxId)
      .all<LedgerRow>();
    for (const row of found.results ?? [])
      if (row.orderId) payments.set(row.orderId, row);
  }
  const resolved = new Map<number, Resolved>();
  // Refund scope follows a complete owner reclassification, including when the
  // receipt is outside this range. Ambiguous/reversed classifications stay
  // unclassified instead of being assigned to the wrong business scope.
  const refundPurposes = new Map<number, string | null>();
  const refundOrders = new Set(
    [...context.values()]
      .filter(row => row.entryType === "refund")
      .map(row => row.orderId)
  );
  const refundPayments = [...payments.values()].filter(row =>
    refundOrders.has(row.orderId)
  );
  for (const group of chunks(refundPayments)) {
    const refs = group.flatMap(row =>
      [...purposes].flatMap(value =>
        ["debit", "credit"].map(
          leg => `ledger:${row.id}:reclass:${value}:${leg}`
        )
      )
    );
    const entries = await client
      .prepare(
        `SELECT l.id,l.source_reference AS reference,l.base_amount_ils_minor AS amount,
      l.transaction_purpose AS purpose,EXISTS(SELECT 1 FROM financial_ledger_entries r
        WHERE r.entry_type='reversal' AND r.status='approved' AND r.reversal_of_entry_id=l.id AND r.id<=?) AS reversed
      FROM financial_ledger_entries l WHERE l.source_type='financial_reclassification'
      AND l.source_reference IN (SELECT value FROM json_each(?)) AND l.status='approved' AND l.id<=?`
      )
      .bind(snapshotMaxId, JSON.stringify(refs), snapshotMaxId)
      .all<{
        id: number;
        reference: string;
        amount: number;
        purpose: string;
        reversed: number;
      }>();
    const byPayment = new Map<number, NonNullable<typeof entries.results>>();
    for (const leg of entries.results ?? []) {
      const id = Number(/^ledger:(\d+):/.exec(leg.reference)?.[1]);
      byPayment.set(id, [...(byPayment.get(id) ?? []), leg]);
    }
    for (const payment of group) {
      const legs = byPayment.get(payment.id) ?? [];
      if (!legs.length) continue;
      const credit = legs.find(leg => leg.reference.endsWith(":credit"));
      const debit = legs.find(leg => leg.reference.endsWith(":debit"));
      refundPurposes.set(
        payment.orderId!,
        legs.length === 2 &&
          credit &&
          debit &&
          !legs.some(leg => leg.reversed) &&
          credit.amount === payment.amountMinor &&
          debit.amount === -payment.amountMinor &&
          purposes.has(credit.purpose) &&
          debit.purpose === purpose(payment)
          ? credit.purpose
          : null
      );
    }
  }
  const resolve = (id: number, visiting = new Set<number>()): Resolved => {
    const cached = resolved.get(id);
    if (cached) return cached;
    const row = context.get(id);
    if (
      !row ||
      row.status !== "approved" ||
      visiting.has(id) ||
      visiting.size >= 32
    )
      throw Error(
        "A complete report cannot be calculated because a correction source is missing or cyclic. Review financial controls."
      );
    if (!Number.isSafeInteger(row.amountMinor))
      throw Error(
        "A ledger amount is not a valid integer; a complete report cannot be calculated."
      );
    visiting.add(id);
    const parent = parentId(row);
    let value: Resolved;
    if (parent !== null) {
      if (parent <= 0)
        throw Error(
          "A correction source reference is invalid. Review financial controls."
        );
      const ancestor = resolve(parent, visiting);
      if (
        (row.orderId && row.orderId !== ancestor.root.orderId) ||
        (row.refundId && row.refundId !== ancestor.root.refundId) ||
        (row.expenseId && row.expenseId !== ancestor.root.expenseId)
      )
        throw Error(
          "A correction has conflicting source ownership. Review financial controls."
        );
      if (
        row.entryType === "reversal" &&
        row.amountMinor !== -context.get(parent)!.amountMinor
      )
        throw Error(
          "A reversal amount does not match its source. Review financial controls."
        );
      value = { ...ancestor, purpose: purpose(row) ?? ancestor.purpose };
    } else {
      const item =
        row.sourceType === "historical_reconciliation"
          ? historical.get(
              Number(
                /^reconciliation:(\d+)$/.exec(row.sourceReference ?? "")?.[1]
              )
            )
          : undefined;
      const duplicateHistorical = !!(
        item?.eligible &&
        item.orderId &&
        payments.has(item.orderId)
      );
      const kind: Kind =
        row.entryType === "payment" ||
        (row.entryType === "adjustment" &&
          item?.eligible &&
          !duplicateHistorical)
          ? "receipt"
          : row.entryType === "refund"
            ? "refund"
            : row.entryType === "expense"
              ? "expense"
              : row.entryType === "opening_balance"
                ? "opening"
                : "adjustment";
      if (
        (row.entryType === "payment" && row.amountMinor <= 0) ||
        (["refund", "expense"].includes(row.entryType) && row.amountMinor >= 0)
      )
        throw Error(
          "A source cash amount has an invalid sign. Review financial controls."
        );
      value = {
        kind,
        purpose:
          purpose(row) ??
          (kind === "refund" && row.orderId
            ? refundPurposes.has(row.orderId)
              ? refundPurposes.get(row.orderId)!
              : purpose(payments.get(row.orderId) ?? row)
            : null),
        root: row,
        duplicateHistorical,
      };
    }
    visiting.delete(id);
    resolved.set(id, value);
    return value;
  };
  const periods = new Map<string, FinancialPeriod>();
  const categories = new Map<string, number>();
  const quality = {
    unclassifiedReceiptEntries: 0,
    unclassifiedRefundEntries: 0,
    unallocatedAdjustmentEntries: 0,
    duplicateHistoricalEntries: 0,
    sharedPaymentReferenceGroups: 0,
  };
  const references = new Map<string, Set<number>>();
  let receiptCount = 0,
    correctionCount = 0;
  for (const row of periodRows) {
    const state = resolve(row.id);
    const at = timestamp(row.effectiveAt);
    if (
      !Number.isFinite(at) ||
      at < Date.parse(range.fromTimestamp) ||
      at >= Date.parse(range.endExclusiveTimestamp) ||
      row.effectiveAt.slice(0, 7) !== new Date(at).toISOString().slice(0, 7)
    )
      throw Error(
        "A ledger reporting date needs review before a complete report can be calculated."
      );
    const key = row.effectiveAt.slice(0, input.grouping === "year" ? 4 : 7);
    const period = periods.get(key) ?? {
      period: key,
      ...emptyFinancialTotals(),
    };
    periods.set(key, period);
    const amount = row.amountMinor;
    period.ledgerMovementMinor += amount;
    const correction = parentId(row) !== null;
    if (correction) correctionCount++;
    if (state.duplicateHistorical) quality.duplicateHistoricalEntries++;
    if (state.kind === "receipt") {
      period.confirmedIncomeMinor += amount;
      if (correction) period.receiptCorrectionsMinor += amount;
      else {
        period.recordedReceiptsMinor += amount;
        receiptCount++;
      }
      const field =
        state.purpose === "new_sale"
          ? "newSalesMinor"
          : state.purpose === "renewal"
            ? "renewalsMinor"
            : state.purpose === "upgrade"
              ? "upgradesMinor"
              : state.purpose === "copier_subscription"
                ? "copierMinor"
                : "unclassifiedIncomeMinor";
      period[field] += amount;
      if (!state.purpose) quality.unclassifiedReceiptEntries++;
      if (state.purpose && state.purpose !== "copier_subscription")
        period.academyReceiptsMinor += amount;
    } else if (state.kind === "refund") {
      period.refundsMinor -= amount;
      if (state.purpose === "copier_subscription")
        period.copierRefundsMinor -= amount;
      else if (state.purpose) period.academyRefundsMinor -= amount;
      else {
        period.unclassifiedRefundsMinor -= amount;
        quality.unclassifiedRefundEntries++;
      }
    } else if (state.kind === "expense") {
      period.expensesMinor -= amount;
      const category = state.root.category ?? "uncategorized";
      categories.set(category, (categories.get(category) ?? 0) - amount);
    } else if (state.kind === "opening") period.openingBalancesMinor += amount;
    else {
      period.netAdjustmentsMinor += amount;
      quality.unallocatedAdjustmentEntries++;
    }
    if (
      row.entryType === "payment" &&
      row.paymentReference?.trim() &&
      row.orderId
    ) {
      const ref = JSON.stringify([
        row.paymentMethod ?? "",
        row.paymentReference.trim().toLowerCase(),
      ]);
      const orders = references.get(ref) ?? new Set<number>();
      orders.add(row.orderId);
      references.set(ref, orders);
    }
  }
  quality.sharedPaymentReferenceGroups = [...references.values()].filter(
    orders => orders.size > 1
  ).length;
  const rows = [...periods.values()].sort((a, b) =>
    a.period.localeCompare(b.period)
  );
  for (const row of rows) {
    row.netRevenueMinor = row.confirmedIncomeMinor - row.refundsMinor;
    row.operatingProfitLossMinor = row.netRevenueMinor - row.expensesMinor;
    if (FINANCIAL_TOTAL_FIELDS.some(field => !Number.isSafeInteger(row[field])))
      throw Error(
        "Report amounts exceed safe integer limits. Choose a smaller date range."
      );
  }
  const totals = totalFinancialPeriods(rows);
  const limit = Math.min(Math.max(input.ledgerLimit ?? 100, 1), 100);
  // Explicit response projections preserve viewer redaction and avoid private metadata.
  const ledger = input.includeLedger
    ? [...periodRows]
        .sort(
          (a, b) =>
            timestamp(b.effectiveAt) - timestamp(a.effectiveAt) || b.id - a.id
        )
        .slice(0, limit)
        .map(row => ({
          id: row.id,
          entryType: row.entryType,
          effectiveAt: new Date(timestamp(row.effectiveAt)).toISOString(),
          baseAmountIlsMinor: row.amountMinor,
          sourceType: row.sourceType,
          sourceReference: row.sourceReference,
          orderId: row.orderId,
          refundId: row.refundId,
          expenseId: row.expenseId,
          description: row.description,
          paymentMethod: row.paymentMethod,
          transactionPurpose: resolved.get(row.id)?.purpose ?? null,
        }))
    : [];
  return {
    reportVersion: FINANCIAL_REPORT_VERSION,
    basis: "cash" as const,
    currency: "ILS" as const,
    timezone: "UTC" as const,
    from: range.from,
    to: range.to,
    grouping: input.grouping,
    generatedAt,
    periods: rows,
    totals,
    categories: [...categories]
      .filter(([, amount]) => amount !== 0)
      .map(([category, amountMinor]) => ({ category, amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
    ledger,
    ledgerTruncated: input.includeLedger && periodRows.length > limit,
    quality,
    receiptCount,
    correctionCount,
    sourceEntryCount: periodRows.length,
  };
}
