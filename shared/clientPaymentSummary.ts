/** Cash evidence and access credentials have different lifecycles. */
export type ClientPaymentCoverage = 'recorded_evidence_only' | 'needs_reconciliation' | 'no_payment_recorded' | 'unavailable';
export type ClientPaymentSummary = {
  version: 1;
  currency: 'ILS';
  generatedAt: string;
  coverage: ClientPaymentCoverage;
  receiptsMinor: number | null;
  refundsMinor: number | null;
  netPaidMinor: number | null;
  receiptCount: number;
  historicalOrderCount: number;
  historicalKeyCount: number;
  unusedPaidKeyCount: number;
  reasons: string[];
  orderIds: number[];
  keyIds: number[];
  referencesTruncated: boolean;
};

export const CLIENT_PAYMENT_SUMMARY_ROLES = ['support', 'key_manager', 'client_lookup', 'finance_manager', 'finance_viewer'];
export const CLIENT_REPORT_ROLES = [
  ...CLIENT_PAYMENT_SUMMARY_ROLES, 'analyst', 'analyst_duplicate_guard', 'plan_manager',
  'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes',
  'staff_performance_employee', 'staff_performance_manager', 'student_surveys_manager',
  'loyalty_rewards_manager', 'student_community_moderator', 'student_job_eligibility_manager',
];

export function unavailableClientPaymentSummary(generatedAt = new Date().toISOString()): ClientPaymentSummary {
  return {
    version: 1, currency: 'ILS', generatedAt, coverage: 'unavailable',
    receiptsMinor: null, refundsMinor: null, netPaidMinor: null, receiptCount: 0,
    historicalOrderCount: 0, historicalKeyCount: 0, unusedPaidKeyCount: 0,
    reasons: ['source_unavailable'], orderIds: [], keyIds: [], referencesTruncated: false,
  };
}

export function isAvailableClientPaymentSummary(summary?: ClientPaymentSummary | null): summary is ClientPaymentSummary & {
  receiptsMinor: number; refundsMinor: number; netPaidMinor: number;
} {
  return summary?.version === 1 && summary.currency === 'ILS' && summary.coverage !== 'unavailable'
    && Number.isSafeInteger(summary.receiptsMinor) && Number.isSafeInteger(summary.refundsMinor)
    && Number.isSafeInteger(summary.netPaidMinor);
}

export function clientPaymentCoverageLabel(summary: ClientPaymentSummary | null | undefined, language: string) {
  const ar = language === 'ar';
  if (!isAvailableClientPaymentSummary(summary)) return ar ? 'بيانات الدفع غير متاحة' : 'Payment information unavailable';
  if (summary.coverage === 'needs_reconciliation') return ar ? 'مدفوعات تاريخية تحتاج إلى تحقق' : 'Historical payments need verification';
  if (summary.coverage === 'no_payment_recorded') return ar ? 'لا توجد دفعة مسجلة' : 'No payment recorded';
  return ar ? 'حسب المدفوعات الموثقة فقط' : 'Recorded payments only';
}

/** No fallback to the legacy activated-key total, including mixed API versions. */
export function clientPaymentExportFields(summary?: ClientPaymentSummary | null) {
  const available = isAvailableClientPaymentSummary(summary);
  return [
    available ? (summary.receiptsMinor / 100).toFixed(2) : '',
    available ? (summary.refundsMinor / 100).toFixed(2) : '',
    available ? (summary.netPaidMinor / 100).toFixed(2) : '',
    summary?.version === 1 ? summary.coverage : 'unavailable',
    summary?.version === 1 ? summary.historicalOrderCount : '',
    summary?.version === 1 ? summary.historicalKeyCount : '',
    summary?.version === 1 ? summary.unusedPaidKeyCount : '',
    summary?.version === 1 ? summary.generatedAt : '',
  ];
}

export const CLIENT_PAYMENT_EXPORT_HEADERS = [
  'Confirmed receipts (ILS)', 'Confirmed refunds (ILS)', 'Net confirmed paid (ILS)',
  'Payment evidence coverage', 'Historical orders needing review', 'Historical keys needing review',
  'Unused paid keys', 'Payment summary generated at (UTC)',
];
