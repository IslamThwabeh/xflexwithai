import { currentFinancialMonth, type ReceiptScope } from "./financialReport";

export type FinancialFilters = {
  from: string;
  to: string;
  grouping: "month" | "year";
};
export type FinancialReportLocation = FinancialFilters & {
  scope: ReceiptScope;
};
export function isFinancialDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function readFinancialReportLocation(
  search: string,
  defaults: FinancialFilters = currentFinancialMonth()
): FinancialReportLocation {
  const params = new URLSearchParams(search);
  const from = params.get("from"),
    to = params.get("to");
  const range = {
    from: isFinancialDate(from) ? from : defaults.from,
    to: isFinancialDate(to) ? to : defaults.to,
  };
  const scope = params.get("scope");
  return {
    ...(range.from <= range.to
      ? range
      : { from: defaults.from, to: defaults.to }),
    grouping: params.get("grouping") === "year" ? "year" : "month",
    scope: scope === "academy" || scope === "copier" ? scope : "all",
  };
}
export function financialReportPath(location: FinancialReportLocation) {
  return `/admin/finance?${new URLSearchParams({ from: location.from, to: location.to, grouping: location.grouping, scope: location.scope })}`;
}
