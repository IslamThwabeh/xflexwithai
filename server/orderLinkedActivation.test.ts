import { describe, expect, it } from 'vitest';

import {
  getPackageKeyAssignmentFailure,
  isBlockedActivationAlertFresh,
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
});
