import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/063_staff_performance_foundation.sql", import.meta.url),
);

describe("staff performance migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("is additive and seeds the feature flag as disabled", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(migrationSql).toContain(
      "VALUES ('staff_performance_enabled', 'false', datetime('now'))",
    );
  });

  it("creates every Phase 1A table and period uniqueness constraint", () => {
    for (const table of [
      "staff_performance_monthly_plans",
      "staff_performance_goals",
      "staff_performance_daily_logs",
      "staff_performance_daily_tasks",
      "staff_performance_weekly_reports",
      "staff_performance_audit_logs",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migrationSql).toContain("UNIQUE (staff_user_id, month)");
    expect(migrationSql).toContain("UNIQUE (staff_user_id, local_date)");
    expect(migrationSql).toContain("UNIQUE (staff_user_id, week_start)");
    expect(migrationSql).toContain(
      "CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'locked'))",
    );
  });
});
