import { describe, expect, it } from 'vitest';
import {
  getPendingServiceWindow,
  getTimedServiceReminderStage,
  getTimedServiceActivationWindow,
  shouldNotifyLegacyTimedServiceAutoActivation,
  shouldAutoActivateTimedServices,
} from '../backend/services/timed-service-activation.service';

describe('timed service activation helpers', () => {
  it('anchors the pending window to the original key activation when available', () => {
    const fallbackDate = new Date('2026-03-26T20:39:49.974Z');
    const window = getPendingServiceWindow({
      fallbackDate,
      registrationKeyActivatedAt: '2026-03-12T10:50:37.857Z',
      studyPeriodDays: 14,
      entitlementDays: 30,
    });

    expect(window.activationAnchor.toISOString()).toBe('2026-03-12T10:50:37.857Z');
    expect(window.maxActivationDate.toISOString()).toBe('2026-03-26T10:50:37.857Z');
    expect(window.placeholderEndDate.toISOString()).toBe('2026-04-11T10:50:37.857Z');
  });

  it('falls back to the current fulfillment time when there is no key activation timestamp', () => {
    const fallbackDate = new Date('2026-04-12T00:00:00.000Z');
    const window = getPendingServiceWindow({
      fallbackDate,
      registrationKeyActivatedAt: null,
      studyPeriodDays: 14,
      entitlementDays: 30,
    });

    expect(window.activationAnchor.toISOString()).toBe('2026-04-12T00:00:00.000Z');
    expect(window.maxActivationDate.toISOString()).toBe('2026-04-26T00:00:00.000Z');
    expect(window.placeholderEndDate.toISOString()).toBe('2026-05-12T00:00:00.000Z');
  });

  it('auto-activates when broker completion is already cleared', () => {
    expect(shouldAutoActivateTimedServices({
      now: new Date('2026-04-12T00:00:00.000Z'),
      brokerComplete: true,
      lexaiMaxActivationDate: null,
      recommendationMaxActivationDate: null,
    })).toBe(true);
  });

  it('keeps services pending when broker is complete but course is not ready', () => {
    expect(shouldAutoActivateTimedServices({
      now: new Date('2026-04-12T00:00:00.000Z'),
      brokerComplete: true,
      courseReady: false,
      lexaiMaxActivationDate: null,
      recommendationMaxActivationDate: null,
    })).toBe(false);
  });

  it('auto-activates when a pending service is past its deadline even if broker is incomplete', () => {
    expect(shouldAutoActivateTimedServices({
      now: new Date('2026-04-12T12:00:00.000Z'),
      brokerComplete: false,
      lexaiMaxActivationDate: null,
      recommendationMaxActivationDate: '2026-04-05T22:34:33.934Z',
    })).toBe(true);
  });

  it('keeps services pending when broker is incomplete and the deadline has not passed', () => {
    expect(shouldAutoActivateTimedServices({
      now: new Date('2026-04-12T12:00:00.000Z'),
      brokerComplete: false,
      lexaiMaxActivationDate: null,
      recommendationMaxActivationDate: '2026-04-16T20:39:49.494Z',
    })).toBe(false);
  });

  it('anchors policy activation to the exact protection deadline when processing runs late', () => {
    const window = getTimedServiceActivationWindow({
      processedAt: new Date('2026-06-24T02:00:00.000Z'),
      maxActivationDate: '2026-06-23T06:23:45.502Z',
      entitlementDays: 30,
      reason: 'protection_expired',
    });

    expect(window.effectiveStart.toISOString()).toBe('2026-06-23T06:23:45.502Z');
    expect(window.endDate.toISOString()).toBe('2026-07-23T06:23:45.502Z');
  });

  it('starts early completion at the actual processing time', () => {
    const window = getTimedServiceActivationWindow({
      processedAt: new Date('2026-06-18T10:00:00.000Z'),
      maxActivationDate: '2026-06-23T06:23:45.502Z',
      entitlementDays: 31,
      reason: 'requirements_completed',
    });

    expect(window.effectiveStart.toISOString()).toBe('2026-06-18T10:00:00.000Z');
    expect(window.endDate.toISOString()).toBe('2026-07-19T10:00:00.000Z');
  });

  it('does not backdate manual activation merely because a deadline exists', () => {
    const window = getTimedServiceActivationWindow({
      processedAt: new Date('2026-06-24T02:00:00.000Z'),
      maxActivationDate: '2026-06-23T06:23:45.502Z',
      entitlementDays: 30,
      reason: 'manual',
    });

    expect(window.effectiveStart.toISOString()).toBe('2026-06-24T02:00:00.000Z');
    expect(window.endDate.toISOString()).toBe('2026-07-24T02:00:00.000Z');
  });

  it('selects only the currently actionable pre-activation reminder', () => {
    const deadline = '2026-08-15T12:00:00.000Z';
    expect(getTimedServiceReminderStage({
      now: new Date('2026-08-12T12:00:00.000Z'),
      maxActivationDate: deadline,
    })).toBe('three_days');
    expect(getTimedServiceReminderStage({
      now: new Date('2026-08-14T12:00:00.000Z'),
      maxActivationDate: deadline,
    })).toBe('one_day');
  });

  it('does not emit stale reminders after the deadline or outside the reminder window', () => {
    const deadline = '2026-08-15T12:00:00.000Z';
    expect(getTimedServiceReminderStage({
      now: new Date('2026-08-11T11:59:59.000Z'),
      maxActivationDate: deadline,
    })).toBeNull();
    expect(getTimedServiceReminderStage({
      now: new Date('2026-08-15T12:00:00.000Z'),
      maxActivationDate: deadline,
    })).toBeNull();
    expect(getTimedServiceReminderStage({
      now: new Date('2026-08-14T12:00:00.000Z'),
      maxActivationDate: 'not-a-date',
    })).toBeNull();
  });

  it('alerts staff only for protection-expiry activation of legacy services without an activated key', () => {
    expect(shouldNotifyLegacyTimedServiceAutoActivation({
      activationReason: 'protection_expired',
      hasPendingTimedService: true,
      hasActivatedPackageKey: false,
    })).toBe(true);
    expect(shouldNotifyLegacyTimedServiceAutoActivation({
      activationReason: 'requirements_completed',
      hasPendingTimedService: true,
      hasActivatedPackageKey: false,
    })).toBe(false);
    expect(shouldNotifyLegacyTimedServiceAutoActivation({
      activationReason: 'protection_expired',
      hasPendingTimedService: true,
      hasActivatedPackageKey: true,
    })).toBe(false);
    expect(shouldNotifyLegacyTimedServiceAutoActivation({
      activationReason: 'protection_expired',
      hasPendingTimedService: false,
      hasActivatedPackageKey: false,
    })).toBe(false);
  });
});
