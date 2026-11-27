import { formatAcademyDateTime } from "./academyLocale";
import { orderReviewDate } from "./orderReview";

export const RECONCILIATION_STATUSES = [
  "unresolved",
  "approved_opening_balance",
  "approved_adjustment",
  "excluded",
] as const;
export const RECONCILIATION_TREATMENTS = [
  "genuine_current_new_sale",
  "genuine_current_renewal",
  "genuine_upgrade",
  "legacy_migration_no_financial_impact",
  "historical_payment_known_date",
  "historical_payment_unknown",
  "requires_owner_review",
  "possible_duplicate",
  "excluded_nonfinancial",
] as const;
export const RECONCILIATION_SOURCES = [
  "order",
  "registration_key",
  "renewal_key",
  "upgrade_key",
] as const;
export const RECONCILIATION_CONFIDENCE = ["high", "medium", "low"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];
export type ReconciliationTreatment =
  (typeof RECONCILIATION_TREATMENTS)[number];
export type ReconciliationItem = {
  id: number;
  sourceType: string;
  sourceReference: string;
  issueType: string;
  confidenceLevel: string;
  status: string;
  proposedTreatment: string;
  proposedAmountIlsMinor: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  draftVersion?: string;
};
export type ReconciliationFilter = {
  status: ReconciliationStatus;
  sourceType?: (typeof RECONCILIATION_SOURCES)[number];
  treatment?: ReconciliationTreatment;
  confidence?: (typeof RECONCILIATION_CONFIDENCE)[number];
  exact?: { type: "item" | "order" | "key"; id: number };
  before?: { updatedAt: string; id: number };
  limit?: number;
};
export type ReconciliationDecision = {
  itemId: number;
  decision: "excluded" | "approved_adjustment";
  reason: string;
  effectiveDate?: string | null;
  amountIlsMinor?: number | null;
};
export type ReconciliationDecisionPreview = {
  itemId: number;
  request: ReconciliationDecision;
  reviewVersion: string;
  effectiveAt: string | null;
  amountIlsMinor: number;
  periodLocked: boolean;
  generatedAt: string;
};

const labels: Record<string, [string, string]> = {
  unresolved: ["Unresolved", "غير محسوم"],
  approved_opening_balance: [
    "Historical opening balance",
    "رصيد افتتاحي تاريخي",
  ],
  approved_adjustment: ["Approved historical adjustment", "تسوية تاريخية معتمدة"],
  excluded: ["Excluded from recognition", "مستبعد من الاحتساب"],
  order: ["Order", "طلب"],
  registration_key: ["Manual key", "مفتاح يدوي"],
  renewal_key: ["Renewal key", "مفتاح تجديد"],
  upgrade_key: ["Upgrade key", "مفتاح ترقية"],
  completed_order_without_cash_confirmation: [
    "Completed order without saved payment confirmation",
    "طلب مكتمل دون تأكيد دفع محفوظ",
  ],
  priced_key_without_order: [
    "Priced manual key without an order",
    "مفتاح يدوي بسعر دون طلب",
  ],
  renewal_key_without_order_payment: [
    "Renewal key without a linked order payment",
    "مفتاح تجديد دون دفع طلب مرتبط",
  ],
  upgrade_key_without_order_payment: [
    "Upgrade key without a linked order payment",
    "مفتاح ترقية دون دفع طلب مرتبط",
  ],
  high: ["High candidate confidence", "ثقة مرتفعة بتصنيف المرشح"],
  medium: ["Medium candidate confidence", "ثقة متوسطة بتصنيف المرشح"],
  low: ["Low candidate confidence", "ثقة منخفضة بتصنيف المرشح"],
  genuine_current_new_sale: [
    "Current new-sale candidate",
    "مرشح لبيع جديد حالي",
  ],
  genuine_current_renewal: ["Current renewal candidate", "مرشح لتجديد حالي"],
  genuine_upgrade: ["Upgrade candidate", "مرشح لترقية"],
  legacy_migration_no_financial_impact: [
    "Legacy migration; no financial impact",
    "ترحيل قديم بلا أثر مالي",
  ],
  historical_payment_known_date: [
    "Historical payment; date marked known",
    "دفعة تاريخية — مصنّفة بتاريخ معروف",
  ],
  historical_payment_unknown: [
    "Historical payment still unverified",
    "دفعة تاريخية لم يتم التحقق منها",
  ],
  requires_owner_review: ["Requires owner review", "يتطلب مراجعة المالك"],
  possible_duplicate: [
    "Possible duplicate; review required",
    "تكرار محتمل يتطلب المراجعة",
  ],
  excluded_nonfinancial: ["Nonfinancial candidate", "مرشح بلا أثر مالي"],
  draft_updated: ["Proposal updated", "تم تحديث الاقتراح"],
  queued: ["Added to review queue", "تمت الإضافة إلى قائمة المراجعة"],
  pending: ["Pending", "قيد الانتظار"],
  awaiting_confirmation: ["Awaiting confirmation", "بانتظار التأكيد"],
  paid: ["Marked paid", "موسوم كمدفوع"],
  completed: ["Completed", "مكتمل"],
  cancelled: ["Cancelled", "ملغى"],
  refunded: ["Refunded", "مسترد"],
};
export function reconciliationLabel(value: string, language: string): string {
  return (
    labels[value]?.[language === "ar" ? 1 : 0] ??
    (language === "ar"
      ? `تصنيف غير معروف (${value})`
      : `Unknown classification (${value})`)
  );
}

export function parseReconciliationIls(
  value: string,
  positiveOnly = false
): number | null {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const minor = Math.round(Number(value) * 100);
  return Number.isSafeInteger(minor) &&
    minor !== 0 &&
    Math.abs(minor) <= 100_000_000_00 &&
    (!positiveOnly || minor > 0)
    ? minor
    : null;
}

export function reconciliationSourcePath(
  sourceType: string,
  sourceReference: string,
  packageId?: number | null
): string | null {
  const id = Number(sourceReference);
  if (!/^\d+$/.test(sourceReference) || !Number.isSafeInteger(id) || id <= 0)
    return null;
  if (sourceType === "order") return `/admin/orders?orderId=${id}`;
  return packageId !== null &&
    RECONCILIATION_SOURCES.includes(sourceType as any)
    ? `/admin/package-keys?keyId=${id}`
    : null;
}

export function focusedPackageKeyId(search: string): number | null {
  const value = new URLSearchParams(search).get("keyId");
  const id = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

export function formatHistoricalReviewDate(
  value: string | null | undefined,
  language: "ar" | "en"
): string {
  const date = orderReviewDate(value);
  return date
    ? formatAcademyDateTime(date, language)
    : language === "ar"
      ? "غير معروف"
      : "Unknown";
}
