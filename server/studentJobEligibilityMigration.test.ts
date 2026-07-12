import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/068_student_job_eligibility_foundation.sql", import.meta.url),
);

describe("student job eligibility migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("is additive and seeds the feature flag as disabled", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(migrationSql).toContain(
      "VALUES ('student_job_eligibility_enabled', 'false', datetime('now'))",
    );
  });

  it("creates profile, rule, review, and audit tables with review constraints", () => {
    for (const table of [
      "student_job_profiles",
      "student_job_eligibility_rules",
      "student_job_eligibility_reviews",
      "student_job_eligibility_audit_logs",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migrationSql).toContain("UNIQUE(user_id, job_id)");
    expect(migrationSql).toContain("CHECK (status IN ('submitted', 'returned', 'eligible', 'ineligible'))");
    expect(migrationSql).toContain("ON CONFLICT(settingKey) DO NOTHING");
  });
});
