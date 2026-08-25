import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getArticleAvailableLanguages,
  isArticleAvailableInLanguage,
} from "../shared/curatedArticles";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getArticleBySlug: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const source = (path: string) => readFileSync(path, "utf8");

function createPublicCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/articles.bySlug" },
    user: null,
    setCookie: () => {},
    clearCookie: () => {},
  } as any).articles;
}

describe("article language availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats legacy articles as bilingual and respects explicit single-language settings", () => {
    expect(getArticleAvailableLanguages({})).toEqual(["ar", "en"]);
    expect(getArticleAvailableLanguages({ languageAvailability: "both" })).toEqual(["ar", "en"]);
    expect(getArticleAvailableLanguages({ languageAvailability: "ar" })).toEqual(["ar"]);
    expect(getArticleAvailableLanguages({ languageAvailability: "en" })).toEqual(["en"]);
    expect(isArticleAvailableInLanguage({ languageAvailability: "ar" }, "en")).toBe(false);
  });

  it("returns not found when a direct public URL requests an unavailable translation", async () => {
    vi.mocked(db.getArticleBySlug).mockResolvedValue({
      id: 991,
      slug: "arabic-only-article",
      titleAr: "مقال عربي",
      titleEn: "Arabic article",
      contentAr: "المحتوى",
      contentEn: "",
      excerptAr: "ملخص",
      excerptEn: "",
      isPublished: true,
      languageAvailability: "ar",
      publishedAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    } as any);

    await expect(createPublicCaller().bySlug({
      slug: "arabic-only-article",
      language: "en",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(createPublicCaller().bySlug({
      slug: "arabic-only-article",
      language: "ar",
    })).resolves.toMatchObject({ slug: "arabic-only-article" });
  });

  it("filters every public article surface using the active language", () => {
    expect(source("frontend/src/pages/ArticleDetail.tsx")).toContain("language: articleLanguage");
    for (const path of [
      "frontend/src/pages/Articles.tsx",
      "frontend/src/pages/FreeContent.tsx",
      "frontend/src/pages/CinematicHomePage.tsx",
      "frontend/src/pages/MyDashboard.tsx",
    ]) {
      expect(source(path)).toContain("isArticleAvailableInLanguage(article,");
    }
  });

  it("limits prerendered pages, sitemap alternates, feeds, and manifest counts", () => {
    const generator = source("scripts/generate-seo.ts");
    expect(generator).toContain("const availableLanguages = getArticleAvailableLanguages(article)");
    expect(generator).toContain("availableLanguages.map((language) =>");
    expect(generator).toContain("isArticleAvailableInLanguage(article, language)");
    expect(generator).toContain("articlePages: articles.reduce");
    expect(generator).toContain("availableLanguages,");
  });
});
