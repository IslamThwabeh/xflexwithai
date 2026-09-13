import type { FinanceActor } from './financial-expense.service';
import { normalizeFinancialPostingDate, validateAdjustmentAmount } from './financial-control.service';

export const FINANCIAL_RECONCILIATION_STATUSES = [
  'unresolved',
  'approved_opening_balance',
  'approved_adjustment',
  'excluded',
] as const;

export const FINANCIAL_RECONCILIATION_TREATMENTS = [
  'genuine_current_new_sale',
  'genuine_current_renewal',
  'genuine_upgrade',
  'legacy_migration_no_financial_impact',
  'historical_payment_known_date',
  'historical_payment_unknown',
  'requires_owner_review',
  'possible_duplicate',
  'excluded_nonfinancial',
] as const;
export type FinancialReconciliationTreatment = typeof FINANCIAL_RECONCILIATION_TREATMENTS[number];

export type FinancialReconciliationStatus = typeof FINANCIAL_RECONCILIATION_STATUSES[number];

export function assertFinanceOwner(actor: FinanceActor) {
  if (actor.access !== 'owner' || actor.actorType !== 'admin') {
    throw new Error('Only the finance owner can change historical reconciliation records.');
  }
}

export function assertReconciliationDraftAccess(actor: FinanceActor) {
  if (actor.access !== 'owner' && actor.access !== 'manager') {
    throw new Error('Finance owner or manager reconciliation access is required.');
  }
}

export function normalizeReconciliationReason(value: string) {
  const reason = value.trim();
  if (reason.length < 5) throw new Error('A reconciliation reason of at least 5 characters is required.');
  return reason.slice(0, 1000);
}

export function normalizeOpeningBalanceInput(input: {
  effectiveDate?: string | null;
  amountIlsMinor?: number | null;
}) {
  if (!input.effectiveDate) throw new Error('An opening-balance date is required.');
  if (input.amountIlsMinor == null) throw new Error('An opening-balance ILS amount is required.');
  validateAdjustmentAmount(input.amountIlsMinor);
  const effectiveAt = normalizeFinancialPostingDate(input.effectiveDate);
  return {
    effectiveAt,
    reportingMonth: effectiveAt.slice(0, 7),
    amountIlsMinor: input.amountIlsMinor,
  };
}
