import { describe, expect, it } from 'vitest';

import {
  getPackageKeyIssuancePolicy,
  getPackageKeyAssignmentFailure,
  hasValidPackageKeyAdminAuthorization,
  isBlockedActivationAlertFresh,
  packageKeyPolicyRequiresAdminAuthorization,
  packageKeyPolicyRequiresOrder,
} from '../backend/services/package-key-access.service';
import { getOrderDisplayTotalIls } from '../shared/orderPricing';

describe('order-linked package activation policy', () => {
  it('uses the exact Basic and Comprehensive commercial ILS prices', () => {
    expect(getOrderDisplayTotalIls({ totalAmount: 20_000, currency: 'USD', packageSlug: 'basic' })).toBe(700);
    expect(getOrderDisplayTotalIls({ totalAmount: 50_000, currency: 'USD', packageSlug: 'comprehensive' })).toBe(1700);
  });

  it('preserves fixed-price ratios for discounts and upgrades', () => {
    expect(getOrderDisplayTotalIls({ totalAmount: 18_000, currency: 'USD', packageSlug: 'basic' })).toBe(630);
    expect(getOrderDisplayTotalIls({ totalAmount: 45_000, currency: 'USD', packageSlug: 'comprehensive' })).toBe(1530);
    expect(getOrderDisplayTotalIls({ totalAmount: 30_000, currency: 'USD', packageSlug: 'comprehensive', isUpgrade: true })).toBe(1000);
  });

  it('blocks unassigned inventory and keys assigned to another email', () => {
    expect(getPackageKeyAssignmentFailure({
      assignedEmail: null,
      issuanceType: 'manual',
      redeemerEmail: 'student@example.com',
    })).toBe('assignment_required');
    expect(getPackageKeyAssignmentFailure({
      assignedEmail: 'student@example.com',
      issuanceType: 'bulk_inventory',
      redeemerEmail: 'student@example.com',
    })).toBe('assignment_required');
    expect(getPackageKeyAssignmentFailure({
      assignedEmail: 'other@example.com',
      issuanceType: 'manual',
      redeemerEmail: 'student@example.com',
    })).toBe('email_mismatch');
  });

  it('allows only the normalized assigned email', () => {
    expect(getPackageKeyAssignmentFailure({
      assignedEmail: ' Student@Example.com ',
      issuanceType: 'order',
      redeemerEmail: 'student@example.com',
    })).toBeNull();
  });

  it('deduplicates a repeated blocked alert inside the configured window', () => {
    const now = new Date('2026-07-16T12:00:00.000Z');
    expect(isBlockedActivationAlertFresh({
      lastNotifiedAt: '2026-07-16T11:50:01.000Z',
      now,
      dedupeMs: 15 * 60 * 1000,
    })).toBe(true);
    expect(isBlockedActivationAlertFresh({
      lastNotifiedAt: '2026-07-16T11:40:00.000Z',
      now,
      dedupeMs: 15 * 60 * 1000,
    })).toBe(false);
  });

  it('separates commercial order eligibility from internal admin authorization', () => {
    expect(getPackageKeyIssuancePolicy({ keyKind: 'fresh', purpose: 'commercial' })).toMatchObject({
      activationPolicy: 'order_required',
      isRenewal: false,
      isUpgrade: false,
    });
    expect(getPackageKeyIssuancePolicy({ keyKind: 'upgrade', purpose: 'commercial' })).toMatchObject({
      activationPolicy: 'order_required',
      isUpgrade: true,
    });
    expect(getPackageKeyIssuancePolicy({ keyKind: 'renewal', purpose: 'internal' })).toMatchObject({
      activationPolicy: 'internal_authorized',
      isRenewal: true,
    });
    expect(packageKeyPolicyRequiresOrder('order_required')).toBe(true);
    expect(packageKeyPolicyRequiresOrder('internal_authorized')).toBe(false);
    expect(packageKeyPolicyRequiresAdminAuthorization('internal_authorized')).toBe(true);
    expect(packageKeyPolicyRequiresAdminAuthorization('admin_exception')).toBe(true);
    expect(packageKeyPolicyRequiresAdminAuthorization('legacy')).toBe(false);
  });

  it('preserves the established manual commercial renewal policy during the transition', () => {
    expect(getPackageKeyIssuancePolicy({ keyKind: 'renewal', purpose: 'commercial' })).toMatchObject({
      activationPolicy: 'legacy',
      isRenewal: true,
      isUpgrade: false,
    });
  });

  it('accepts only a complete immutable full-admin authorization', () => {
    expect(hasValidPackageKeyAdminAuthorization({
      authorizedByType: 'admin',
      authorizedById: 7,
      authorizedAt: '2026-07-20T10:00:00.000Z',
      authorizationReason: 'Employee renewal for Batool',
    })).toBe(true);
    expect(hasValidPackageKeyAdminAuthorization({
      authorizedByType: 'staff',
      authorizedById: 7,
      authorizedAt: '2026-07-20T10:00:00.000Z',
      authorizationReason: 'Employee renewal for Batool',
    })).toBe(false);
    expect(hasValidPackageKeyAdminAuthorization({
      authorizedByType: 'admin',
      authorizedById: 7,
      authorizedAt: '2026-07-20T10:00:00.000Z',
      authorizationReason: 'No',
    })).toBe(false);
  });
});
