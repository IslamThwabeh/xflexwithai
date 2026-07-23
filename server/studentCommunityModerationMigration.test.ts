import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL(
    "../database/migrations/075_student_community_prepublication_moderation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("student community moderation migration", () => {
  it("adds policy and decision tables without enabling the feature", () => {
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS student_community_policy_terms",
    );
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS student_community_moderation_decisions",
    );
    expect(migrationSql).not.toContain("student_community_enabled', 'true");
  });

  it("constrains moderation outcomes and avoids storing raw submitted content", () => {
    expect(migrationSql).toContain(
      "outcome IN ('allowed', 'blocked_policy', 'blocked_openai', 'error')",
    );
    expect(migrationSql).toContain("content_hash TEXT NOT NULL");
    expect(migrationSql).not.toMatch(/\bcontent\s+TEXT/i);
  });
});
