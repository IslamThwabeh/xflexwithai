import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../database/migrations/074_student_community_access_controls.sql",
    import.meta.url,
  ),
);

describe("student community access migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("is additive and does not bulk-copy client records", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im,
    );
    expect(migrationSql).not.toContain("INSERT INTO student_community_access_controls");
  });

  it("creates constrained access controls and an audit trail", () => {
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS student_community_access_controls",
    );
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS student_community_access_audit_logs",
    );
    expect(migrationSql).toContain("CHECK (status IN ('allowed', 'banned'))");
    expect(migrationSql).toContain("CHECK (action IN ('ban', 'restore'))");
    expect(migrationSql).toContain("user_id INTEGER PRIMARY KEY");
  });
});
