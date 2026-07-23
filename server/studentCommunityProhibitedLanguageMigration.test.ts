import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL(
    "../database/migrations/076_student_community_prohibited_language.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("student community prohibited-language migration", () => {
  it("adds a separate prohibited-language category and reason", () => {
    expect(migrationSql).toContain(
      "category IN ('competitor', 'prohibited_language')",
    );
    expect(migrationSql).toContain("'prohibited_language'");
    expect(migrationSql).toContain("UNIQUE (category, normalized_term)");
  });

  it("preserves existing terms and decisions without enabling the community", () => {
    expect(migrationSql).toContain(
      "FROM student_community_policy_terms_075",
    );
    expect(migrationSql).toContain(
      "FROM student_community_moderation_decisions_075",
    );
    expect(migrationSql).not.toContain("student_community_enabled");
  });
});
