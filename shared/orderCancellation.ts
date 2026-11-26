export const ORDER_REVIEW_STATUS_LABELS: Record<
  string,
  { en: string; ar: string }
> = {
  pending: { en: "Pending", ar: "معلّق" },
  awaiting_confirmation: { en: "Awaiting confirmation", ar: "بانتظار التأكيد" },
  paid: { en: "Paid", ar: "مدفوع" },
  completed: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  refunded: { en: "Refunded", ar: "مسترد" },
};

export type OrderCancellationFacts = {
  status: string;
  receiptPresent: boolean;
  paymentConfirmed: boolean;
  keysIssued: boolean;
  financialHistory: boolean;
  accessHistory: boolean;
  retired: boolean;
};

export type OrderCancellationAuthority = {
  operational: boolean;
  financeReview: boolean;
};

export const ORDER_CANCELLATION_MESSAGES = {
  closed: {
    en: "Only a pending request can use ordinary cancellation.",
    ar: "الإلغاء العادي متاح فقط لطلب معلّق أو بانتظار التأكيد.",
  },
  retired: {
    en: "This replaced order is preserved under its existing retirement record.",
    ar: "هذا الطلب المستبدل محفوظ ضمن سجل الاستبدال الخاص به.",
  },
  payment: {
    en: "Payment is confirmed. Use the financial correction/refund workflow.",
    ar: "الدفع مؤكد. استخدم مسار التصحيح المالي أو الاسترداد.",
  },
  keys: {
    en: "Keys have been issued. Review delivery and access through their dedicated workflow.",
    ar: "صدرت مفاتيح لهذا الطلب. راجع التسليم والوصول من المسار المخصص.",
  },
  financial_history: {
    en: "Linked financial history requires finance review through its source workflow.",
    ar: "يوجد سجل مالي مرتبط؛ يلزم مراجعته من مساره المالي الأصلي.",
  },
  access_history: {
    en: "Linked service/access history requires its dedicated review workflow.",
    ar: "يوجد سجل خدمة أو وصول مرتبط؛ يلزم استخدام مسار المراجعة المخصص.",
  },
  finance_review: {
    en: "A receipt is attached. Only the finance owner or a finance manager can review and cancel this unpaid request.",
    ar: "يوجد إيصال مرفق. إلغاء هذا الطلب غير المؤكد مالياً يتطلب مراجعة مالك المالية أو مدير المالية.",
  },
  operational_access: {
    en: "Order-management access is required to cancel a request without a receipt.",
    ar: "إلغاء طلب بلا إيصال يتطلب صلاحية إدارة الطلبات.",
  },
} as const;

export type OrderCancellationBlock = keyof typeof ORDER_CANCELLATION_MESSAGES;

/** Shared presentation policy; final eligibility is enforced again inside the write transaction. */
export function getOrderCancellationBlock(
  facts: OrderCancellationFacts,
  authority: OrderCancellationAuthority
): OrderCancellationBlock | null {
  if (facts.retired) return "retired";
  if (facts.paymentConfirmed) return "payment";
  if (facts.keysIssued) return "keys";
  if (facts.financialHistory) return "financial_history";
  if (facts.accessHistory) return "access_history";
  if (!["pending", "awaiting_confirmation"].includes(facts.status))
    return "closed";
  if (facts.receiptPresent && !authority.financeReview) return "finance_review";
  if (!facts.receiptPresent && !authority.operational)
    return "operational_access";
  return null;
}
