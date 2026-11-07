import { describe, expect, it } from 'vitest';
import {
  EASY_LIFE_ANNOUNCEMENT_DURATION_MS,
  getEasyLifeAnnouncementWindow,
  isEasyLifeAnnouncementActive,
} from '../shared/easyLifeAnnouncement';
import { COMPANY_PUBLIC_INFO, getEasyLifeInquiryHref } from '../shared/companyPublicInfo';

describe('Easy Life public launch window', () => {
  const launchAt = '2026-11-07T20:10:28+03:00';
  const start = Date.parse(launchAt);
  const end = start + EASY_LIFE_ANNOUNCEMENT_DURATION_MS;

  it('shows the announcement from publication until exactly seven days later', () => {
    expect(isEasyLifeAnnouncementActive(launchAt, start - 1)).toBe(false);
    expect(isEasyLifeAnnouncementActive(launchAt, start)).toBe(true);
    expect(isEasyLifeAnnouncementActive(launchAt, end - 1)).toBe(true);
    expect(isEasyLifeAnnouncementActive(launchAt, end)).toBe(false);
    expect(isEasyLifeAnnouncementActive(launchAt, end + 1)).toBe(false);
  });

  it('uses the same campaign window across timezones', () => {
    expect(getEasyLifeAnnouncementWindow(launchAt)).toEqual(
      getEasyLifeAnnouncementWindow('2026-11-07T17:10:28Z'),
    );
  });

  it.each(['', 'not-a-date', '2026-11-07T20:10:28'])('hides the campaign for an invalid or ambiguous start: %s', (value) => {
    expect(isEasyLifeAnnouncementActive(value, start)).toBe(false);
  });
});

describe('Easy Life WhatsApp inquiries', () => {
  it.each(['ar', 'en'] as const)('opens the business number with the %s inquiry intact', (language) => {
    const href = new URL(getEasyLifeInquiryHref(language));
    expect(href.origin).toBe('https://wa.me');
    expect(href.pathname).toBe('/972597596030');
    expect(href.searchParams.get('text')).toBe(COMPANY_PUBLIC_INFO[language].installmentMessage);
  });
});
