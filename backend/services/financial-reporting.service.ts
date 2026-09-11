export type FinancialReportGrouping = 'month' | 'year';

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label} is invalid.`);
  }
  return date;
}

export function normalizeFinancialReportRange(from: string, to: string): FinancialReportRange {
  const fromDate = parseCalendarDate(from, 'Start date');
  const toDate = parseCalendarDate(to, 'End date');
  if (fromDate.getTime() > toDate.getTime()) throw new Error('Start date must be on or before end date.');
  const maximumDays = 366 * 10;
  if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > maximumDays) {
    throw new Error('Financial report range cannot exceed ten years.');
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

export type FinancialPeriodRow = {
  period: string;
  confirmedIncomeMinor: number;
  refundsMinor: number;
  netRevenueMinor: number;
  expensesMinor: number;
  netAdjustmentsMinor: number;
  operatingProfitLossMinor: number;
};

export function normalizeFinancialPeriodRows(rows: Array<Record<string, unknown>>): FinancialPeriodRow[] {
  return rows.map((row) => {
    const confirmedIncomeMinor = Number(row.confirmedIncomeMinor ?? 0);
    const refundsSignedMinor = Number(row.refundsSignedMinor ?? 0);
    const expensesSignedMinor = Number(row.expensesSignedMinor ?? 0);
    const netAdjustmentsMinor = Number(row.adjustmentsSignedMinor ?? 0);
    const refundsMinor = Math.abs(refundsSignedMinor);
    const expensesMinor = Math.abs(expensesSignedMinor);
    const netRevenueMinor = confirmedIncomeMinor + refundsSignedMinor;
    return {
      period: String(row.period),
      confirmedIncomeMinor,
      refundsMinor,
      netRevenueMinor,
      expensesMinor,
      netAdjustmentsMinor,
      operatingProfitLossMinor: netRevenueMinor + expensesSignedMinor + netAdjustmentsMinor,
    };
  });
}

export function totalFinancialPeriods(rows: FinancialPeriodRow[]) {
  return rows.reduce((total, row) => ({
    confirmedIncomeMinor: total.confirmedIncomeMinor + row.confirmedIncomeMinor,
    refundsMinor: total.refundsMinor + row.refundsMinor,
    netRevenueMinor: total.netRevenueMinor + row.netRevenueMinor,
    expensesMinor: total.expensesMinor + row.expensesMinor,
    netAdjustmentsMinor: total.netAdjustmentsMinor + row.netAdjustmentsMinor,
    operatingProfitLossMinor: total.operatingProfitLossMinor + row.operatingProfitLossMinor,
  }), {
    confirmedIncomeMinor: 0,
    refundsMinor: 0,
    netRevenueMinor: 0,
    expensesMinor: 0,
    netAdjustmentsMinor: 0,
    operatingProfitLossMinor: 0,
  });
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildFinancialManagementCsv(input: {
  from: string;
  to: string;
  grouping: FinancialReportGrouping;
  periods: FinancialPeriodRow[];
  totals: ReturnType<typeof totalFinancialPeriods>;
  categories: Array<{ category: string; amountMinor: number }>;
}) {
  const rows: unknown[][] = [
    ['Report', 'Management P&L'],
    ['Accounting basis', 'Cash basis: confirmed-payment date; refunds by refund date'],
    ['Currency', 'ILS'],
    ['From', input.from],
    ['To', input.to],
    [],
    ['Period', 'Confirmed income (ILS)', 'Refunds (ILS)', 'Net revenue (ILS)', 'Expenses (ILS)', 'Net adjustments/reversals (ILS)', 'Operating profit/loss (ILS)'],
    ...input.periods.map((row) => [
      row.period,
      (row.confirmedIncomeMinor / 100).toFixed(2),
      (row.refundsMinor / 100).toFixed(2),
      (row.netRevenueMinor / 100).toFixed(2),
      (row.expensesMinor / 100).toFixed(2),
      (row.netAdjustmentsMinor / 100).toFixed(2),
      (row.operatingProfitLossMinor / 100).toFixed(2),
    ]),
    [
      'TOTAL',
      (input.totals.confirmedIncomeMinor / 100).toFixed(2),
      (input.totals.refundsMinor / 100).toFixed(2),
      (input.totals.netRevenueMinor / 100).toFixed(2),
      (input.totals.expensesMinor / 100).toFixed(2),
      (input.totals.netAdjustmentsMinor / 100).toFixed(2),
      (input.totals.operatingProfitLossMinor / 100).toFixed(2),
    ],
    [],
    ['Expense category', 'Approved expenses (ILS)'],
    ...input.categories.map((row) => [row.category, (row.amountMinor / 100).toFixed(2)]),
    ['TOTAL EXPENSES', (input.totals.expensesMinor / 100).toFixed(2)],
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
