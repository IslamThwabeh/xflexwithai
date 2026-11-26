export const ORDER_KEY_ISSUANCE_PENDING_MESSAGE =
  'Payment is confirmed, but key issuance needs a safe retry. Do not record payment again. Refresh the order and retry key issuance. If it fails again, contact support.';

/** Also hides details from an older API while client/server rollouts overlap. */
export function formatOrderApprovalError(message: string, language: string): string {
  if (message.startsWith('Payment is confirmed, but key issuance needs a safe retry')) {
    return language === 'ar'
      ? 'تم تأكيد الدفع، لكن إصدار المفتاح لم يكتمل. لا تسجّل الدفع مرة أخرى. حدّث الطلب ثم استخدم «إعادة محاولة إصدار المفتاح». إذا تكرر الخطأ، تواصل مع الدعم.'
      : ORDER_KEY_ISSUANCE_PENDING_MESSAGE;
  }
  return message;
}
