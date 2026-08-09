import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/068_student_job_eligibility_foundation.sql", import.meta.url),
);
const resubmissionMigrationPath = fileURLToPath(
  new URL("../database/migrations/080_student_job_review_resubmission.sql", import.meta.url),
);

describe("student job eligibility migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");
  const resubmissionMigrationSql = readFileSync(resubmissionMigrationPath, "utf8");

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

  it("adds resubmitted status without losing existing review data", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE jobs (id INTEGER PRIMARY KEY);
        CREATE TABLE student_job_eligibility_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          job_id INTEGER NOT NULL REFERENCES jobs(id),
          status TEXT NOT NULL DEFAULT 'submitted',
          system_eligible INTEGER NOT NULL DEFAULT 0,
          score INTEGER NOT NULL DEFAULT 0,
          snapshot_json TEXT NOT NULL DEFAULT '{}',
          student_note TEXT,
          admin_note TEXT,
          reviewed_by_user_id INTEGER,
          reviewed_at TEXT,
          submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, job_id),
          CHECK (status IN ('submitted', 'returned', 'eligible', 'ineligible'))
        );
        CREATE INDEX idx_student_job_reviews_user ON student_job_eligibility_reviews(user_id);
        CREATE INDEX idx_student_job_reviews_job_status ON student_job_eligibility_reviews(job_id, status);
        INSERT INTO users (id) VALUES (1);
        INSERT INTO jobs (id) VALUES (2);
        INSERT INTO student_job_eligibility_reviews (id, user_id, job_id, status, admin_note)
        VALUES (7, 1, 2, 'returned', 'Please update the evidence');
        ${resubmissionMigrationSql}
      `);

      database.prepare("UPDATE student_job_eligibility_reviews SET status = 'resubmitted' WHERE id = 7").run();
      expect(database.prepare("SELECT status, admin_note AS adminNote FROM student_job_eligibility_reviews WHERE id = 7").get())
        .toEqual({ status: "resubmitted", adminNote: "Please update the evidence" });
      expect(() => database.prepare("UPDATE student_job_eligibility_reviews SET status = 'invalid' WHERE id = 7").run())
        .toThrow(/CHECK constraint failed/i);
    } finally {
      database.close();
    }
  });
});
