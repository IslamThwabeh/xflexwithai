import {
  scopedReceiptTotals,
  type ReceiptScope,
  type FinancialPeriod,
  type FinancialTotals,
} from "./financialReport";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildFinancialManagementCsv(input: {
  from: string;
  to: string;
  grouping: "month" | "year";
  periods: FinancialPeriod[];
  totals: FinancialTotals;
  categories: Array<{ category: string; amountMinor: number }>;
  scope?: ReceiptScope;
  generatedAt?: string;
}) {
  const rows: unknown[][] = [
    ["Report", "Management P&L"],
    [
      "Accounting basis",
      "Cash basis: confirmed-payment date; refunds by refund date",
    ],
    ["Currency", "ILS"],
    ["Timezone", "UTC"],
    ["Snapshot (UTC)", input.generatedAt ?? "Not supplied"],
    ["Receipt view", input.scope ?? "all"],
    [
      "Operating result",
      "Net cash revenue less net approved expenses; opening balances and unallocated adjustments excluded",
    ],
    ["From", input.from],
    ["To", input.to],
    [],
    [
      "Period",
      "New sales (ILS)",
      "Paid renewals (ILS)",
      "Upgrades (ILS)",
      "Net confirmed receipts (ILS)",
      "Net refunds (ILS)",
      "Net cash revenue (ILS)",
      "Net expenses (ILS)",
      "Unallocated adjustments (ILS)",
      "Operating cash result (ILS)",
      "Copier receipts (ILS)",
      "Unclassified receipts (ILS)",
      "Recorded receipts (ILS)",
      "Receipt corrections (ILS)",
      "Opening balances (ILS)",
      "Net ledger movement (ILS)",
      "Selected receipts (ILS)",
      "Selected refunds (ILS)",
      "Selected net receipts (ILS)",
    ],
    ...input.periods.map(row => [
      row.period,
      (row.newSalesMinor / 100).toFixed(2),
      (row.renewalsMinor / 100).toFixed(2),
      (row.upgradesMinor / 100).toFixed(2),
      (row.confirmedIncomeMinor / 100).toFixed(2),
      (row.refundsMinor / 100).toFixed(2),
      (row.netRevenueMinor / 100).toFixed(2),
      (row.expensesMinor / 100).toFixed(2),
      (row.netAdjustmentsMinor / 100).toFixed(2),
      (row.operatingProfitLossMinor / 100).toFixed(2),
      ...[
        row.copierMinor,
        row.unclassifiedIncomeMinor,
        row.recordedReceiptsMinor,
        row.receiptCorrectionsMinor,
        row.openingBalancesMinor,
        row.ledgerMovementMinor,
        ...Object.values(scopedReceiptTotals(row, input.scope ?? "all")),
      ].map(value => (value / 100).toFixed(2)),
    ]),
    [
      "TOTAL",
      (input.totals.newSalesMinor / 100).toFixed(2),
      (input.totals.renewalsMinor / 100).toFixed(2),
      (input.totals.upgradesMinor / 100).toFixed(2),
      (input.totals.confirmedIncomeMinor / 100).toFixed(2),
      (input.totals.refundsMinor / 100).toFixed(2),
      (input.totals.netRevenueMinor / 100).toFixed(2),
      (input.totals.expensesMinor / 100).toFixed(2),
      (input.totals.netAdjustmentsMinor / 100).toFixed(2),
      (input.totals.operatingProfitLossMinor / 100).toFixed(2),
      ...[
        input.totals.copierMinor,
        input.totals.unclassifiedIncomeMinor,
        input.totals.recordedReceiptsMinor,
        input.totals.receiptCorrectionsMinor,
        input.totals.openingBalancesMinor,
        input.totals.ledgerMovementMinor,
        ...Object.values(
          scopedReceiptTotals(input.totals, input.scope ?? "all")
        ),
      ].map(value => (value / 100).toFixed(2)),
    ],
    [],
    ["Expense category", "Approved expenses (ILS)"],
    ...input.categories.map(row => [
      row.category,
      (row.amountMinor / 100).toFixed(2),
    ]),
    ["TOTAL EXPENSES", (input.totals.expensesMinor / 100).toFixed(2)],
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
