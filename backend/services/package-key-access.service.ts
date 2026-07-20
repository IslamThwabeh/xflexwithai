import { normalizeEmailAddress } from '../../shared/emailValidation';

export const PACKAGE_KEY_KINDS = ['fresh', 'upgrade', 'renewal'] as const;
export type PackageKeyKind = typeof PACKAGE_KEY_KINDS[number];

export const PACKAGE_KEY_ISSUANCE_PURPOSES = ['commercial', 'internal', 'compensation'] as const;
export type PackageKeyIssuancePurpose = typeof PACKAGE_KEY_ISSUANCE_PURPOSES[number];

export type PackageKeyActivationPolicy =
  | 'legacy'
  | 'order_required'
  | 'internal_authorized'
  | 'admin_exception';

export function getPackageKeyIssuancePolicy(input: {
  keyKind?: PackageKeyKind;
  purpose?: PackageKeyIssuancePurpose;
  isRenewal?: boolean | null;
  isUpgrade?: boolean | null;
}) {
  const keyKind: PackageKeyKind = input.keyKind
    ?? (input.isRenewal ? 'renewal' : input.isUpgrade ? 'upgrade' : 'fresh');
  const purpose = input.purpose ?? 'commercial';

  const activationPolicy: PackageKeyActivationPolicy = purpose === 'internal'
    ? 'internal_authorized'
    : purpose === 'compensation'
      ? 'admin_exception'
      : keyKind === 'renewal'
        // Preserve the established renewal workflow until renewal orders have
        // their own first-class order type.
        ? 'legacy'
        : 'order_required';

  return {
    keyKind,
    purpose,
    activationPolicy,
    isRenewal: keyKind === 'renewal',
    isUpgrade: keyKind === 'upgrade',
  };
}

export function packageKeyPolicyRequiresOrder(policy?: string | null) {
  return policy === 'order_required';
}

export function packageKeyPolicyRequiresAdminAuthorization(policy?: string | null) {
  return policy === 'internal_authorized' || policy === 'admin_exception';
}

export function hasValidPackageKeyAdminAuthorization(input: {
  authorizedByType?: string | null;
  authorizedById?: number | null;
  authorizedAt?: string | Date | null;
  authorizationReason?: string | null;
}) {
  return input.authorizedByType === 'admin'
    && Number(input.authorizedById) > 0
    && !!input.authorizedAt
    && (input.authorizationReason?.trim().length ?? 0) >= 5;
}

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
