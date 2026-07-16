import { normalizeEmailAddress } from '../../shared/emailValidation';

export type PackageKeyAssignmentFailure =
  | 'assignment_required'
  | 'email_mismatch';

export function getPackageKeyAssignmentFailure(input: {
  assignedEmail?: string | null;
  issuanceType?: string | null;
  redeemerEmail: string;
}): PackageKeyAssignmentFailure | null {
  if (!input.assignedEmail?.trim() || input.issuanceType === 'bulk_inventory') {
    return 'assignment_required';
  }
  if (normalizeEmailAddress(input.assignedEmail) !== normalizeEmailAddress(input.redeemerEmail)) {
    return 'email_mismatch';
  }
  return null;
}

export function isBlockedActivationAlertFresh(input: {
  lastNotifiedAt?: string | null;
  now: Date;
  dedupeMs: number;
}) {
  if (!input.lastNotifiedAt) return false;
  const last = new Date(input.lastNotifiedAt).getTime();
  if (!Number.isFinite(last)) return false;
  return input.now.getTime() - last < input.dedupeMs;
}
