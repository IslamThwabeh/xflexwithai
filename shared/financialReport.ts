export const FINANCIAL_REPORT_VERSION = 2;
export const FINANCIAL_REPORT_FRESH_MS = 5 * 60_000;
export type ReceiptScope = "all" | "academy" | "copier";
export type FinanceReportAccess = "owner" | "manager" | "viewer";
export const FINANCIAL_TOTAL_FIELDS = [
  "confirmedIncomeMinor",
  "newSalesMinor",
  "renewalsMinor",
  "upgradesMinor",
  "copierMinor",
  "unclassifiedIncomeMinor",
  "recordedReceiptsMinor",
  "receiptCorrectionsMinor",
  "refundsMinor",
  "netRevenueMinor",
  "expensesMinor",
  "netAdjustmentsMinor",
  "openingBalancesMinor",
  "operatingProfitLossMinor",
  "ledgerMovementMinor",
  "academyReceiptsMinor",
  "academyRefundsMinor",
  "copierRefundsMinor",
  "unclassifiedRefundsMinor",
] as const;
export type FinancialTotals = Record<
  (typeof FINANCIAL_TOTAL_FIELDS)[number],
  number
>;
export type FinancialPeriod = FinancialTotals & { period: string };
export function emptyFinancialTotals(): FinancialTotals {
  return Object.fromEntries(
    FINANCIAL_TOTAL_FIELDS.map(field => [field, 0])
  ) as FinancialTotals;
}
export function currentFinancialMonth(now = new Date()) {
  const to = now.toISOString().slice(0, 10);
  return { from: `${to.slice(0, 7)}-01`, to, grouping: "month" as const };
}
export function scopedReceiptTotals(
  totals: FinancialTotals,
  scope: ReceiptScope
) {
  const received =
    scope === "academy"
      ? totals.academyReceiptsMinor
      : scope === "copier"
        ? totals.copierMinor
        : totals.confirmedIncomeMinor;
  const refunds =
    scope === "academy"
      ? totals.academyRefundsMinor
      : scope === "copier"
        ? totals.copierRefundsMinor
        : totals.refundsMinor;
  return { received, refunds, net: received - refunds };
}
