export type StaffPerformanceCsvValue = string | number | boolean | null | undefined;
export type StaffPerformanceCsvRow = Record<string, StaffPerformanceCsvValue>;

const CSV_FORMULA_PREFIX_RE = /^[=+\-@]/;

export function csvEscapeCell(value: StaffPerformanceCsvValue): string {
  if (value === null || value === undefined) return "";

  const rawValue = String(value);
  const safeValue = CSV_FORMULA_PREFIX_RE.test(rawValue) ? `'${rawValue}` : rawValue;

  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}

export function rowsToCsv(rows: StaffPerformanceCsvRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((row) => headers.map((header) => csvEscapeCell(row[header])).join(",")),
  ];

  return lines.join("\r\n");
}

export function staffPerformanceCsvFilename(scope: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const safeScope = scope.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  return `staff-performance-${safeScope}-${stamp}.csv`;
}
