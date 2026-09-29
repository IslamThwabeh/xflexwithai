import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("public catalog query caching", () => {
  it("uses shared stale windows for public browsing metadata", () => {
    expect(source("frontend/src/lib/queryCaching.ts")).toContain(
      "export const PUBLIC_CATALOG_STALE_MS = 10 * 60_000",
    );
    expect(source("frontend/src/lib/queryCaching.ts")).toContain(
      "export const PUBLIC_OFFER_STATE_STALE_MS = 2 * 60_000",
    );

    for (const path of [
      "frontend/src/pages/CinematicHomePage.tsx",
      "frontend/src/pages/PackageDetails.tsx",
      "frontend/src/pages/FreeContent.tsx",
      "frontend/src/pages/Events.tsx",
      "frontend/src/pages/Careers.tsx",
      "frontend/src/pages/ArticleDetail.tsx",
    ]) {
      expect(source(path)).toMatch(/staleTime:\s*PUBLIC_(CATALOG|OFFER_STATE)_STALE_MS/);
    }
  });

  it("does not apply public metadata caching to checkout or upgrade decisions", () => {
    expect(source("frontend/src/pages/Checkout.tsx")).not.toContain("PUBLIC_CATALOG_STALE_MS");
    expect(source("frontend/src/pages/Checkout.tsx")).not.toContain("PUBLIC_OFFER_STATE_STALE_MS");
    expect(source("frontend/src/pages/Upgrade.tsx")).not.toContain("PUBLIC_CATALOG_STALE_MS");
    expect(source("frontend/src/pages/Upgrade.tsx")).not.toContain("PUBLIC_OFFER_STATE_STALE_MS");
  });

  it("keeps student course truth uncached on the watch page", () => {
    const courseWatchSource = source("frontend/src/pages/CourseWatch.tsx");
    const enrollmentQuery = courseWatchSource.match(
      /enrollments\.getEnrollment\.useQuery\([\s\S]*?\n\s*\);/,
    )?.[0];
    const progressQuery = courseWatchSource.match(
      /episodeProgress\.getCourse\.useQuery\([\s\S]*?\n\s*\);/,
    )?.[0];

    expect(enrollmentQuery).toBeTruthy();
    expect(progressQuery).toBeTruthy();
    expect(enrollmentQuery).not.toContain("PUBLIC_CATALOG_STALE_MS");
    expect(progressQuery).not.toContain("PUBLIC_CATALOG_STALE_MS");
    expect(enrollmentQuery).not.toContain("COURSE_METADATA_STALE_MS");
    expect(progressQuery).not.toContain("COURSE_METADATA_STALE_MS");
  });
});
