import type { FinanceActor } from './financial-expense.service';

export const FINANCIAL_ADJUSTMENT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
] as const;

export function normalizeFinancialPostingDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Financial date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error('Financial date is invalid.');
  }
  if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new Error('Financial date cannot be in the future.');
  }
  return `${trimmed}T00:00:00.000Z`;
}

export function normalizeFinancialMonth(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    throw new Error('Financial month must use YYYY-MM.');
  }
  return trimmed;
}

export function validateAdjustmentAmount(amountIlsMinor: number) {
  if (!Number.isSafeInteger(amountIlsMinor) || amountIlsMinor === 0) {
    throw new Error('Adjustment amount must be a non-zero ILS amount.');
  }
  if (Math.abs(amountIlsMinor) > 100_000_000_00) {
    throw new Error('Adjustment amount exceeds the supported limit.');
  }
}

export function canPrepareFinancialControls(actor: FinanceActor) {
  return actor.access === 'owner' || actor.access === 'manager';
}

export function canEditAdjustment(actor: FinanceActor, adjustment: {
  status: string;
  createdByType: string;
  createdById: number;
}) {
  return adjustment.status === 'draft'
    && adjustment.createdByType === actor.actorType
    && adjustment.createdById === actor.actorId;
}

export function assertIndependentAdjustmentReviewer(actor: FinanceActor, adjustment: {
  createdByType: string;
  createdById: number;
  submittedByType?: string | null;
  submittedById?: number | null;
}) {
  if (!canPrepareFinancialControls(actor)) {
    throw new Error('Finance owner or manager review access is required.');
  }
  const createdOwn = adjustment.createdByType === actor.actorType && adjustment.createdById === actor.actorId;
  const submittedOwn = adjustment.submittedByType === actor.actorType && adjustment.submittedById === actor.actorId;
  if (createdOwn || submittedOwn) {
    throw new Error('You cannot approve or reject your own adjustment submission.');
  }
}
