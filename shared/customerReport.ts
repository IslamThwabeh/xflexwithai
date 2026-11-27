import type { ClientPaymentSummary } from "./clientPaymentSummary";
export const CUSTOMER_REPORT_SORTS = [
  "registered",
  "name",
  "email",
  "city",
  "country",
  "keys",
  "renewals",
  "paid",
] as const;
export type CustomerReportSort = (typeof CUSTOMER_REPORT_SORTS)[number];
export type CustomerReportFilter = {
  search: string;
  country: string;
  sort: CustomerReportSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: 10 | 20 | 50;
};
export type CustomerServiceStatus =
  | "active"
  | "expiring"
  | "expired"
  | "pending"
  | "paused"
  | "inactive"
  | "unknown";
export type CustomerService = {
  kind: "package" | "lexai" | "recommendations" | "copier";
  nameEn: string;
  nameAr: string;
  status: CustomerServiceStatus;
  endDate: string | null;
};
export type CustomerReportRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  createdAt: string | null;
  loginRestricted: boolean;
  totalKeys: number;
  renewalCount: number;
  services: CustomerService[];
  paymentSummary?: ClientPaymentSummary;
};
export type CustomerReportPage = {
  items: CustomerReportRow[];
  total: number;
  accountCount: number;
  filteredPaymentTotalMinor?: number | null;
  page: number;
  pageSize: number;
  generatedAt: string;
  countries: Array<{
    value: string;
    labelEn: string;
    labelAr: string;
    needsReview: boolean;
  }>;
  canViewClientPayments: boolean;
  paymentsIncluded: boolean;
  viewerId: number;
  accessVersion: string;
};
export const CUSTOMER_REPORT_COLUMNS = [
  { key: "name", en: "Name", ar: "الاسم" },
  { key: "email", en: "Email", ar: "البريد الإلكتروني" },
  { key: "phone", en: "Phone", ar: "الهاتف" },
  { key: "city", en: "City", ar: "المدينة" },
  { key: "country", en: "Country", ar: "البلد" },
  { key: "registered", en: "Registered", ar: "تاريخ التسجيل" },
  {
    key: "keys",
    en: "Activated package keys (history)",
    ar: "مفاتيح باقات مفعّلة (سجل سابق)",
  },
  {
    key: "paid",
    en: "Lifetime recorded payments (ILS)",
    ar: "المدفوعات الموثقة طوال الحساب (شيكل)",
  },
  { key: "services", en: "Service status", ar: "حالة الخدمات" },
  {
    key: "renewals",
    en: "Activated renewal keys (history)",
    ar: "مفاتيح تجديد مفعّلة (سجل سابق)",
  },
] as const;
export type CustomerReportColumn =
  (typeof CUSTOMER_REPORT_COLUMNS)[number]["key"];
export function customerServiceStatusLabel(
  status: CustomerServiceStatus,
  language: string
) {
  const labels: Record<CustomerServiceStatus, [string, string]> = {
    active: ["Active", "نشطة"],
    expiring: ["Expiring soon", "تنتهي قريباً"],
    expired: ["Expired", "منتهية"],
    pending: ["Pending activation / setup", "بانتظار التفعيل / الإعداد"],
    paused: ["Paused", "مجمّدة"],
    inactive: ["Inactive", "غير نشطة"],
    unknown: ["Needs review", "تحتاج مراجعة"],
  };
  return labels[status][language === "ar" ? 1 : 0];
}
/** Stored unzoned SQL timestamps are UTC, never the viewer's machine time. */
export function customerReportDate(
  value: string | null | undefined
): Date | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(
    value
  )
    ? value.replace(" ", "T") + "Z"
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function customerServiceState(
  row: {
    isActive?: number | boolean;
    isPaused?: number | boolean;
    pausedRemainingDays?: number | null;
    isPendingActivation?: number | boolean;
    startDate?: string | null;
    endDate?: string | null;
    kind?: string;
    status?: string;
  },
  now: number
): CustomerServiceStatus {
  if (row.kind === "copier") {
    if (row.status === "cancelled" || row.status === "expired")
      return row.status === "expired" ? "expired" : "inactive";
    if (row.status === "suspended") return "paused";
    if (
      ["pending_payment", "awaiting_external_link"].includes(row.status ?? "")
    )
      return "pending";
    if (row.status !== "active") return "unknown";
  } else if (!row.isActive) return "inactive";
  if (row.isPaused && (row.pausedRemainingDays ?? 0) > 0) return "paused";
  if (row.isPendingActivation) return "pending";
  const end = customerReportDate(row.endDate);
  if (row.endDate && !end) return "unknown";
  if (end && end.getTime() <= now) return "expired";
  if (row.isPaused) return "paused";
  const start = customerReportDate(row.startDate);
  if (row.startDate && !start) return "unknown";
  if (start && start.getTime() > now) return "pending";
  // Undated package entitlements can be ongoing. Timed services require expiry.
  if (!end && row.kind !== "package") return "unknown";
  return end && end.getTime() - now <= 7 * 86400000 ? "expiring" : "active";
}
