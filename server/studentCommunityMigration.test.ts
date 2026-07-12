import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/067_student_community_foundation.sql", import.meta.url),
);

describe("student community migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("is additive and seeds the feature flag as disabled", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(migrationSql).toContain(
      "VALUES ('student_community_enabled', 'false', datetime('now'))",
    );
  });

  it("creates post, comment, report, and audit tables with moderation constraints", () => {
    for (const table of [
      "student_community_posts",
      "student_community_comments",
      "student_community_reports",
      "student_community_audit_logs",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migrationSql).toContain("CHECK (status IN ('visible', 'hidden', 'deleted'))");
    expect(migrationSql).toContain("CHECK (target_type IN ('post', 'comment'))");
    expect(migrationSql).toContain("CHECK (status IN ('open', 'reviewed', 'dismissed'))");
    expect(migrationSql).toContain("UNIQUE (target_type, target_id, reporter_user_id)");
    expect(migrationSql).toContain("CHECK (entity_type IN ('post', 'comment', 'report'))");
  });
});
