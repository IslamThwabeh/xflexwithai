import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/064_student_surveys_foundation.sql", import.meta.url),
);
const blockingFlagMigrationPath = fileURLToPath(
  new URL("../database/migrations/065_student_survey_blocking_flag.sql", import.meta.url),
);

describe("student surveys migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");
  const blockingFlagMigrationSql = readFileSync(blockingFlagMigrationPath, "utf8");

  it("is additive and seeds the feature flag as disabled", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(migrationSql).toContain(
      "VALUES ('student_surveys_enabled', 'false', datetime('now'))",
    );
  });

  it("creates every Phase 2A table and key uniqueness constraints", () => {
    for (const table of [
      "student_surveys",
      "student_survey_questions",
      "student_survey_assignments",
      "student_survey_answers",
      "student_survey_audit_logs",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migrationSql).toContain("code TEXT NOT NULL UNIQUE");
    expect(migrationSql).toContain("UNIQUE (survey_id, user_id)");
    expect(migrationSql).toContain("UNIQUE (assignment_id, question_id)");
    expect(migrationSql).toContain(
      "CHECK (status IN ('pending', 'postponed', 'submitted', 'blocked'))",
    );
  });

  it("adds a separate disabled route-blocking enforcement flag", () => {
    const statementsOnly = blockingFlagMigrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(blockingFlagMigrationSql).toContain(
      "VALUES ('student_surveys_blocking_enabled', 'false', datetime('now'))",
    );
  });
});
