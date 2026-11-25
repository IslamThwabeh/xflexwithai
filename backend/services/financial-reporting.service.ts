import {
  emptyFinancialTotals,
  FINANCIAL_TOTAL_FIELDS,
  type FinancialPeriod,
} from "../../shared/financialReport";
export type FinancialReportGrouping = "month" | "year";

export type FinancialReportRange = {
  from: string;
  to: string;
  fromTimestamp: string;
  endExclusiveTimestamp: string;
  fromMonth: string;
  toMonth: string;
};

function parseCalendarDate(value: string, label: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized))
    throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return date;
}

export function normalizeFinancialReportRange(
  from: string,
  to: string
): FinancialReportRange {
  const fromDate = parseCalendarDate(from, "Start date");
  const toDate = parseCalendarDate(to, "End date");
  from = fromDate.toISOString().slice(0, 10);
  to = toDate.toISOString().slice(0, 10);
  if (fromDate.getTime() > toDate.getTime())
    throw new Error("Start date must be on or before end date.");
  const maximumDays = 366 * 10;
  if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > maximumDays) {
    throw new Error("Financial report range cannot exceed ten years.");
  }
  const endExclusive = new Date(toDate);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    from,
    to,
    fromTimestamp: `${from}T00:00:00.000Z`,
    endExclusiveTimestamp: endExclusive.toISOString(),
    fromMonth: from.slice(0, 7),
    toMonth: to.slice(0, 7),
  };
}

export type FinancialPeriodRow = FinancialPeriod;

export function normalizeFinancialPeriodRows(
  rows: Array<Record<string, unknown>>
): FinancialPeriodRow[] {
  return rows.map(row => {
    const confirmedIncomeMinor = Number(row.confirmedIncomeMinor ?? 0);
    const newSalesMinor = Number(row.newSalesMinor ?? 0);
    const renewalsMinor = Number(row.renewalsMinor ?? 0);
    const upgradesMinor = Number(row.upgradesMinor ?? 0);
    const refundsSignedMinor = Number(row.refundsSignedMinor ?? 0);
    const expensesSignedMinor = Number(row.expensesSignedMinor ?? 0);
    const netAdjustmentsMinor = Number(row.adjustmentsSignedMinor ?? 0);
    const refundsMinor = -refundsSignedMinor;
    const expensesMinor = -expensesSignedMinor;
    const recognizedIncomeMinor =
      row.recognizedIncomeMinor == null
        ? confirmedIncomeMinor
        : Number(row.recognizedIncomeMinor);
    const netRevenueMinor = recognizedIncomeMinor + refundsSignedMinor;
    return {
      ...emptyFinancialTotals(),
      period: String(row.period),
      confirmedIncomeMinor: recognizedIncomeMinor,
      newSalesMinor,
      renewalsMinor,
      upgradesMinor,
      refundsMinor,
      netRevenueMinor,
      expensesMinor,
      netAdjustmentsMinor,
      recordedReceiptsMinor: Number(
        row.recordedReceiptsMinor ?? confirmedIncomeMinor
      ),
      receiptCorrectionsMinor:
        recognizedIncomeMinor -
        Number(row.recordedReceiptsMinor ?? confirmedIncomeMinor),
      copierMinor: Number(row.copierMinor ?? 0),
      unclassifiedIncomeMinor:
        recognizedIncomeMinor -
        newSalesMinor -
        renewalsMinor -
        upgradesMinor -
        Number(row.copierMinor ?? 0),
      academyReceiptsMinor: newSalesMinor + renewalsMinor + upgradesMinor,
      openingBalancesMinor: Number(row.openingBalancesMinor ?? 0),
      academyRefundsMinor: Number(row.academyRefundsMinor ?? 0),
      copierRefundsMinor: Number(row.copierRefundsMinor ?? 0),
      unclassifiedRefundsMinor:
        refundsMinor -
        Number(row.academyRefundsMinor ?? 0) -
        Number(row.copierRefundsMinor ?? 0),
      operatingProfitLossMinor: netRevenueMinor + expensesSignedMinor,
      ledgerMovementMinor:
        netRevenueMinor +
        expensesSignedMinor +
        netAdjustmentsMinor +
        Number(row.openingBalancesMinor ?? 0),
    };
  });
}

export function totalFinancialPeriods(rows: FinancialPeriodRow[]) {
  const total = emptyFinancialTotals();
  for (const row of rows)
    for (const field of FINANCIAL_TOTAL_FIELDS) {
      total[field] += row[field] ?? 0;
      if (!Number.isSafeInteger(total[field]))
        throw Error("Financial totals exceed safe integer limits.");
    }
  return total;
}

export { buildFinancialManagementCsv } from "../../shared/financialReportCsv";
