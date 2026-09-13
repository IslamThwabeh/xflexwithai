export const FINANCIAL_TRANSACTION_PURPOSES = [
  'new_sale',
  'renewal',
  'upgrade',
  'legacy_migration',
] as const;

export type FinancialTransactionPurpose = typeof FINANCIAL_TRANSACTION_PURPOSES[number];

export const FINANCIAL_TRANSACTION_PURPOSE_LABELS: Record<FinancialTransactionPurpose, { en: string; ar: string }> = {
  new_sale: { en: 'New Sale', ar: 'شراء جديد' },
  renewal: { en: 'Paid Renewal', ar: 'تجديد مدفوع' },
  upgrade: { en: 'Upgrade', ar: 'ترقية' },
  legacy_migration: { en: 'Legacy Customer Migration — no revenue impact', ar: 'ترحيل عميل قديم — لا يؤثر على الإيرادات' },
};

export function paymentSourceTypeForPurpose(purpose: Exclude<FinancialTransactionPurpose, 'legacy_migration'>) {
  return `order_payment_${purpose}` as const;
}

export function purposeFromPaymentSourceType(value: unknown): Exclude<FinancialTransactionPurpose, 'legacy_migration'> | null {
  if (value === 'order_payment_new_sale') return 'new_sale';
  if (value === 'order_payment_renewal') return 'renewal';
  if (value === 'order_payment_upgrade') return 'upgrade';
  return null;
}

export function isFinancialTransactionPurpose(value: unknown): value is FinancialTransactionPurpose {
  return typeof value === 'string'
    && (FINANCIAL_TRANSACTION_PURPOSES as readonly string[]).includes(value);
}
