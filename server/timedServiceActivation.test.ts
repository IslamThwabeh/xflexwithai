import { describe, expect, it } from 'vitest';
import {
  getPendingServiceWindow,
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
    expect(window.placeholderEndDate.toISOString()).toBe('2026-04-25T10:50:37.857Z');
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
    expect(window.placeholderEndDate.toISOString()).toBe('2026-05-26T00:00:00.000Z');
  });

  it('auto-activates when broker completion is already cleared', () => {
    expect(shouldAutoActivateTimedServices({
      now: new Date('2026-04-12T00:00:00.000Z'),
      brokerComplete: true,
      lexaiMaxActivationDate: null,
      recommendationMaxActivationDate: null,
    })).toBe(true);
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
});