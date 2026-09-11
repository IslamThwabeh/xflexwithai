import { detectPaymentProofFileType } from './payment-proof-upload.service';

export const FINANCIAL_EXPENSE_CATEGORIES = [
  'payroll',
  'advertising',
  'software_and_subscriptions',
  'professional_services',
  'payment_and_bank_fees',
  'rent_and_office',
  'taxes_and_government_fees',
  'training_and_content',
  'other',
] as const;

export const FINANCIAL_EXPENSE_PAYMENT_METHODS = [
  'bank_transfer',
  'cash',
  'card',
  'other',
] as const;

export const FINANCIAL_EXPENSE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'reversed',
] as const;

export const FINANCIAL_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export type FinanceActor = {
  actorType: 'admin' | 'staff';
  actorId: number;
  access: 'owner' | 'manager' | 'clerk' | 'viewer';
};

export type FinancialReceiptMetadata = {
  version: 1;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByType: 'admin' | 'staff';
  uploadedById: number;
};

const RECEIPT_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);

export function normalizeExpensePaidDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Expense date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error('Expense date is invalid.');
  }
  if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new Error('Expense date cannot be in the future.');
  }
  return trimmed;
}

export function validateExpenseAmounts(input: {
  amountMinor: number;
  vatRateBps?: number | null;
  vatAmountMinor?: number | null;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Expense amount must be a positive ILS amount.');
  }
  if (input.amountMinor > 100_000_000_00) {
    throw new Error('Expense amount exceeds the supported limit.');
  }
  if (input.vatRateBps != null && (!Number.isInteger(input.vatRateBps) || input.vatRateBps < 0 || input.vatRateBps > 10_000)) {
    throw new Error('VAT rate must be between 0% and 100%.');
  }
  if (input.vatAmountMinor != null && (!Number.isSafeInteger(input.vatAmountMinor) || input.vatAmountMinor < 0 || input.vatAmountMinor > input.amountMinor)) {
    throw new Error('VAT amount must be between zero and the expense total.');
  }
}

export function canAccessExpense(actor: FinanceActor, expense: { createdByType: string; createdById: number }) {
  if (actor.access === 'owner' || actor.access === 'manager') return true;
  return actor.access === 'clerk'
    && expense.createdByType === actor.actorType
    && expense.createdById === actor.actorId;
}

export function canEditExpense(actor: FinanceActor, expense: { status: string; createdByType: string; createdById: number }) {
  if (expense.status !== 'draft') return false;
  return expense.createdByType === actor.actorType && expense.createdById === actor.actorId;
}

export function assertIndependentReviewer(actor: FinanceActor, expense: {
  createdByType: string;
  createdById: number;
  submittedByType?: string | null;
  submittedById?: number | null;
}) {
  if (actor.access !== 'owner' && actor.access !== 'manager') {
    throw new Error('Finance owner or manager review access is required.');
  }
  const actorCreated = expense.createdByType === actor.actorType && expense.createdById === actor.actorId;
  const actorSubmitted = expense.submittedByType === actor.actorType && expense.submittedById === actor.actorId;
  if (actorCreated || actorSubmitted) {
    throw new Error('You cannot approve or reject your own expense submission.');
  }
}

export function validateFinancialReceipt(input: {
  bytes: Uint8Array;
  declaredContentType?: string | null;
  originalName?: string | null;
}) {
  if (!input.bytes.byteLength) throw new Error('Choose a receipt file.');
  if (input.bytes.byteLength > FINANCIAL_RECEIPT_MAX_BYTES) {
    throw new Error('Receipt must be 10 MB or smaller.');
  }
  const detected = detectPaymentProofFileType(input.bytes);
  const contentType = detected?.contentType ?? '';
  const extension = RECEIPT_TYPES.get(contentType);
  if (!extension) throw new Error('Use a JPEG, PNG, WebP, or PDF receipt.');
  let decodedOriginalName = input.originalName?.trim() || `receipt.${extension}`;
  try { decodedOriginalName = decodeURIComponent(decodedOriginalName); } catch { /* keep the safe raw value */ }
  const safeOriginalName = decodedOriginalName
    .replace(/[\\/\r\n]/g, '_')
    .slice(0, 180);
  return { contentType, extension, originalName: safeOriginalName };
}

export function buildFinancialReceiptMetadata(input: {
  expenseId: number;
  bytes: Uint8Array;
  declaredContentType?: string | null;
  originalName?: string | null;
  actor: FinanceActor;
  now?: Date;
  randomId?: string;
}): FinancialReceiptMetadata {
  const file = validateFinancialReceipt(input);
  const now = input.now ?? new Date();
  const randomId = input.randomId ?? crypto.randomUUID();
  return {
    version: 1,
    objectKey: `finance-receipts/${input.expenseId}/${now.getTime()}-${randomId}.${file.extension}`,
    originalName: file.originalName,
    contentType: file.contentType,
    sizeBytes: input.bytes.byteLength,
    uploadedAt: now.toISOString(),
    uploadedByType: input.actor.actorType,
    uploadedById: input.actor.actorId,
  };
}

export function parseFinancialReceiptMetadata(value?: string | null): FinancialReceiptMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<FinancialReceiptMetadata>;
    if (
      parsed.version !== 1
      || typeof parsed.objectKey !== 'string'
      || !parsed.objectKey.startsWith('finance-receipts/')
      || typeof parsed.originalName !== 'string'
      || typeof parsed.contentType !== 'string'
      || typeof parsed.sizeBytes !== 'number'
      || typeof parsed.uploadedAt !== 'string'
      || (parsed.uploadedByType !== 'admin' && parsed.uploadedByType !== 'staff')
      || !Number.isInteger(parsed.uploadedById)
    ) return null;
    return parsed as FinancialReceiptMetadata;
  } catch {
    return null;
  }
}
