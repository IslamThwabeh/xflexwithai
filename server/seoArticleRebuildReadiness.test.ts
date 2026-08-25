import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync("backend/routers.ts", "utf8");
const adminPageSource = readFileSync("frontend/src/pages/AdminArticles.tsx", "utf8");

describe("SEO article rebuild readiness", () => {
  it("exposes only boolean rebuild configuration through an admin procedure", () => {
    const route = routerSource.match(
      /rebuildStatus:\s*adminProcedure\.query\(\(\) => \(\{([\s\S]*?)\}\)\),/,
    )?.[1];

    expect(route).toBeTruthy();
    expect(route).toContain("configured: Boolean(process.env.SEO_REBUILD_WEBHOOK_URL?.trim())");
    expect(route).toContain("authenticationConfigured: Boolean(process.env.SEO_REBUILD_WEBHOOK_SECRET?.trim())");
    expect(route).not.toContain("webhookUrl:");
    expect(route).not.toContain("secret:");
  });

  it("warns article administrators when crawler output will not rebuild automatically", () => {
    expect(adminPageSource).toContain("trpc.articles.rebuildStatus.useQuery()");
    expect(adminPageSource).toContain("rebuildStatus && !rebuildStatus.configured");
    expect(adminPageSource).toContain("Automatic SEO rebuild is not configured");
    expect(adminPageSource).toContain("تحديث SEO التلقائي غير مُعدّ");
    expect(adminPageSource).toContain("prerendered HTML or the sitemap");
  });
});
