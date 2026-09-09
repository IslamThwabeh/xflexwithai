import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("frontend/src/pages/CourseWatch.tsx", "utf8");

describe("course metadata D1 caching", () => {
  it("caches only stable course and episode definitions", () => {
    expect(source).toContain("const COURSE_METADATA_STALE_MS = 10 * 60_000");
    expect(source).toMatch(
      /courses\.getById\.useQuery\([\s\S]*?staleTime:\s*COURSE_METADATA_STALE_MS/,
    );
    expect(source).toMatch(
      /episodes\.listByCourse\.useQuery\([\s\S]*?staleTime:\s*COURSE_METADATA_STALE_MS/,
    );
  });

  it("does not apply the metadata cache to student truth", () => {
    const enrollmentQuery = source.match(
      /enrollments\.getEnrollment\.useQuery\([\s\S]*?\n\s*\);/,
    )?.[0];
    const progressQuery = source.match(
      /episodeProgress\.getCourse\.useQuery\([\s\S]*?\n\s*\);/,
    )?.[0];

    expect(enrollmentQuery).toBeTruthy();
    expect(progressQuery).toBeTruthy();
    expect(enrollmentQuery).not.toContain("staleTime");
    expect(progressQuery).not.toContain("staleTime");
  });
});
