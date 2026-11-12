/** Localize public links at their origin, preserving their query and anchor. */
export function localizePublicHref(href: string, language: 'ar' | 'en'): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  if (/^\/(ar|en)(?=\/|$|[?#])/.test(href)) return href;
  return `/${language}${href === '/' ? '' : href.startsWith('/#') || href.startsWith('/?') ? href.slice(1) : href}`;
}
