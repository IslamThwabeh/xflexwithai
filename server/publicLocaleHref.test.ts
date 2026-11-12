import { describe, expect, it } from 'vitest';
import { localizePublicHref } from '../frontend/src/lib/publicLocaleHref';

describe('homepage public destinations preserve the selected language', () => {
  for (const language of ['ar', 'en'] as const) {
    it(`localizes all audited footer and article destinations in ${language}`, () => {
      const paths = ['/', '/packages/basic', '/packages/comprehensive', '/free-content', '/articles', '/events', '/contact', '/faq', '/login', '/articles/trading-mafia-palestine-arab-world'];
      expect(paths.map(path => localizePublicHref(path, language))).toEqual([
        `/${language}`, `/${language}/packages/basic`, `/${language}/packages/comprehensive`,
        `/${language}/free-content`, `/${language}/articles`, `/${language}/events`,
        `/${language}/contact`, `/${language}/faq`, `/${language}/login`,
        `/${language}/articles/trading-mafia-palestine-arab-world`,
      ]);
    });
  }

  it('preserves query strings, fragments and already localized destinations', () => {
    expect(localizePublicHref('/contact?topic=package#message', 'en')).toBe('/en/contact?topic=package#message');
    expect(localizePublicHref('/#packages', 'ar')).toBe('/ar#packages');
    expect(localizePublicHref('/?campaign=home#faq', 'en')).toBe('/en?campaign=home#faq');
    expect(localizePublicHref('/en/contact?x=1#form', 'en')).toBe('/en/contact?x=1#form');
    expect(localizePublicHref('/ar#faq', 'ar')).toBe('/ar#faq');
  });

  it('leaves external and document-local links intact', () => {
    for (const href of ['https://wa.me/972597596030', '//example.com', 'mailto:info@example.com', '#faq']) {
      expect(localizePublicHref(href, 'en')).toBe(href);
    }
  });
});
