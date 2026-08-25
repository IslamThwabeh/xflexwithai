import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSeoLanguageAlternates } from "../shared/seo";

describe("client SEO language alternates", () => {
  it("keeps the exact article slug in bilingual alternates", () => {
    expect(getSeoLanguageAlternates("/ar/articles/risk-basics", ["ar", "en"])).toEqual([
      { hreflang: "ar", href: "https://xflexacademy.com/ar/articles/risk-basics" },
      { hreflang: "en", href: "https://xflexacademy.com/en/articles/risk-basics" },
      { hreflang: "x-default", href: "https://xflexacademy.com/ar/articles/risk-basics" },
    ]);
  });

  it("does not advertise a missing translation and selects a valid default", () => {
    expect(getSeoLanguageAlternates("/en/articles/english-only", ["en"])).toEqual([
      { hreflang: "en", href: "https://xflexacademy.com/en/articles/english-only" },
      { hreflang: "x-default", href: "https://xflexacademy.com/en/articles/english-only" },
    ]);
  });

  it("removes stale hydrated alternates and supplies article availability to the hook", () => {
    const seoSource = readFileSync("frontend/src/lib/seo.ts", "utf8");
    const articleSource = readFileSync("frontend/src/pages/ArticleDetail.tsx", "utf8");

    expect(seoSource).toContain("querySelectorAll('link[rel=\"alternate\"][hreflang]')");
    expect(articleSource).toContain("availableLanguages: article ? getArticleAvailableLanguages(article) : undefined");
  });
});
