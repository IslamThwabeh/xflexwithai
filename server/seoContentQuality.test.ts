import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEO_ROUTES } from "../shared/seo";

const generatorSource = readFileSync("scripts/generate-seo.ts", "utf8");

describe("public SEO content quality", () => {
  it("keeps localized descriptions long enough to explain each public route", () => {
    for (const route of SEO_ROUTES) {
      expect(route.ar.description.length, `${route.key} Arabic`).toBeGreaterThanOrEqual(100);
      expect(route.en.description.length, `${route.key} English`).toBeGreaterThanOrEqual(100);
    }
  });

  it("adds crawlable, route-specific context to thin static pages", () => {
    expect(generatorSource).toContain("function staticRoutePrerenderBody");
    for (const routeKey of [
      "about",
      "gifts",
      "faq",
      "terms",
      "privacy",
      "refund-policy",
      "editorial-policy",
      "risk-disclosure",
      "author-editorial-team",
    ]) {
      expect(generatorSource).toContain(`case "${routeKey}"`);
    }
    expect(generatorSource).toContain("How XFlex approaches trading education");
  });
});
