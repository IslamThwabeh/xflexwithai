export function formatPaymentMethodLabel(paymentMethod: string | null | undefined, language: string) {
  if (paymentMethod === 'bank_transfer') {
    return language === 'ar' ? 'حوالة بنكية' : 'Bank Transfer';
  }

  return '—';
}