import {
  CUSTOMER_REPORT_COLUMNS,
  customerReportDate,
  customerServiceStatusLabel,
  type CustomerReportColumn,
  type CustomerReportRow,
} from "./customerReport";
import { customerCountryDisplay } from "./customerLocation";
import { formatAcademyDateTime } from "./academyLocale";
import {
  clientPaymentCoverageLabel,
  isAvailableClientPaymentSummary,
} from "./clientPaymentSummary";

type Cell = string | number | { text: string };
export function customerCsvCell(value: Cell) {
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  const phone = typeof value !== "string";
  const raw = phone ? value.text : value;
  const safe =
    (phone && raw) || /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function customerExportTable(
  rows: CustomerReportRow[],
  columns: CustomerReportColumn[],
  language: "ar" | "en",
  paymentsAllowed: boolean
) {
  const selected = CUSTOMER_REPORT_COLUMNS.filter(
    column =>
      columns.includes(column.key) && (column.key !== "paid" || paymentsAllowed)
  );
  const ar = language === "ar";
  const headers: string[] = selected.flatMap(column =>
    column.key === "paid"
      ? ar
        ? [
            "مقبوضات موثقة طوال الحساب (شيكل)",
            "استردادات موثقة طوال الحساب (شيكل)",
            "صافي موثق طوال الحساب (شيكل)",
            "تغطية أدلة الدفع",
            "آخر قراءة لأدلة الدفع (UTC)",
          ]
        : [
            "Lifetime recorded receipts (ILS)",
            "Lifetime recorded refunds (ILS)",
            "Lifetime recorded net paid (ILS)",
            "Payment evidence coverage",
            "Payment evidence read (UTC)",
          ]
      : [ar ? column.ar : column.en]
  );
  const body: Cell[][] = rows.map(row =>
    selected.flatMap((column): Cell[] => {
      switch (column.key) {
        case "name":
          return [row.name ?? ""];
        case "email":
          return [row.email];
        case "phone":
          return [{ text: row.phone ?? "" }];
        case "city":
          return [row.city ?? ""];
        case "country": {
          const value = customerCountryDisplay(row.country, language);
          return [
            value.label +
              (value.needsReview
                ? ar
                  ? " (قيمة سابقة تحتاج مراجعة)"
                  : " (historical value to review)"
                : ""),
          ];
        }
        case "registered": {
          const date = customerReportDate(row.createdAt);
          return [date ? formatAcademyDateTime(date, language) : ""];
        }
        case "keys":
          return [row.totalKeys];
        case "renewals":
          return [row.renewalCount];
        case "services":
          return [
            (row.loginRestricted
              ? [
                  ar
                    ? "تسجيل الدخول مقيّد؛ حالات الخدمات المسجّلة أدناه"
                    : "Login restricted; recorded service states follow",
                ]
              : []
            )
              .concat(
                row.services.map(service => {
                  const date = customerReportDate(service.endDate);
                  const end = date
                    ? formatAcademyDateTime(date, language)
                    : ar
                      ? "تاريخ سابق غير صالح"
                      : "Invalid historical date";
                  return `${ar ? service.nameAr : service.nameEn}: ${customerServiceStatusLabel(service.status, language)}${service.endDate ? ` (${end})` : ""}`;
                })
              )
              .join("; "),
          ];
        case "paid": {
          const summary = row.paymentSummary,
            valid = isAvailableClientPaymentSummary(summary);
          return [
            valid ? summary.receiptsMinor / 100 : "",
            valid ? summary.refundsMinor / 100 : "",
            valid ? summary.netPaidMinor / 100 : "",
            clientPaymentCoverageLabel(summary, language),
            summary?.generatedAt ?? "",
          ];
        }
      }
    })
  );
  return { headers, body };
}
export function buildCustomerReportCsv(
  table: ReturnType<typeof customerExportTable>,
  metadata: Array<[string, string | number]>
) {
  return [...metadata, [], table.headers, ...table.body]
    .map(row => row.map(customerCsvCell).join(","))
    .join("\r\n");
}
const html = (value: Cell) =>
  String(typeof value === "object" ? value.text : value).replace(
    /[&<>"']/g,
    character =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!
  );
export function buildCustomerReportPrint(
  table: ReturnType<typeof customerExportTable>,
  metadata: Array<[string, string | number]>,
  language: "ar" | "en"
) {
  const title =
    language === "ar" ? "تقرير حسابات العملاء" : "Customer accounts report";
  return `<!doctype html><html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}h1{font-size:20px}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:auto}th,td{border:1px solid #ccc;padding:6px;text-align:start;overflow-wrap:anywhere;white-space:pre-wrap}thead{display:table-header-group}@page{size:landscape;margin:12mm}@media print{button{display:none}}button{padding:10px;margin-bottom:12px}</style></head><body><button type="button" onclick="window.print()">${language === "ar" ? "طباعة / حفظ PDF" : "Print / Save PDF"}</button><h1>${title}</h1><dl>${metadata.map(([key, value]) => `<dt>${html(key)}</dt><dd>${html(value)}</dd>`).join("")}</dl><table><thead><tr>${table.headers.map(value => `<th>${html(value)}</th>`).join("")}</tr></thead><tbody>${table.body.map(row => `<tr>${row.map(value => `<td>${html(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}
