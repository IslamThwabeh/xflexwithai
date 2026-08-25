import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  "frontend/src/components/public/CinematicPublicLayout.tsx",
  "utf8",
);

describe("cinematic public navigation markup", () => {
  it("does not nest anchor elements inside Wouter links", () => {
    expect(layoutSource).not.toMatch(/<Link\b[^>]*>\s*<a\b/);
    expect(layoutSource).toContain('<Link href={localePrefix} className="flex shrink-0 items-center gap-2">');
    expect(layoutSource).toContain('href={localizePublicHref(link.href)} className="cin-public-footer-link"');
  });

  it("does not prepend a locale to links that are already localized", () => {
    expect(layoutSource).toContain("if (/^\\/(ar|en)(?:\\/|$)/.test(href)) return href;");
    expect(layoutSource).not.toContain("href.startsWith('/ar/') || href.startsWith('/en/')");
  });
});
