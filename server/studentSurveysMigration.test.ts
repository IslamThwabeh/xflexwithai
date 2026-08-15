import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/064_student_surveys_foundation.sql", import.meta.url),
);
const blockingFlagMigrationPath = fileURLToPath(
  new URL("../database/migrations/065_student_survey_blocking_flag.sql", import.meta.url),
);
const assignmentCapMigrationPath = fileURLToPath(
  new URL("../database/migrations/079_student_survey_assignment_cap.sql", import.meta.url),
);
const continuousNotificationsMigrationPath = fileURLToPath(
  new URL("../database/migrations/086_student_survey_continuous_notifications.sql", import.meta.url),
);

describe("student surveys migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");
  const blockingFlagMigrationSql = readFileSync(blockingFlagMigrationPath, "utf8");
  const assignmentCapMigrationSql = readFileSync(assignmentCapMigrationPath, "utf8");
  const continuousNotificationsMigrationSql = readFileSync(continuousNotificationsMigrationPath, "utf8");

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

  it("enforces the 500-assignment review ceiling in the database", () => {
    expect(assignmentCapMigrationSql).toContain("BEFORE INSERT ON student_survey_assignments");
    expect(assignmentCapMigrationSql).toContain(">= 500");
    expect(assignmentCapMigrationSql).toContain("STUDENT_SURVEY_ASSIGNMENT_CAP_EXCEEDED");
    expect(assignmentCapMigrationSql).toContain("student_survey_submission_audit_guard");
    expect(assignmentCapMigrationSql).toContain("student_survey_reminder_audit_guard");
    expect(assignmentCapMigrationSql).toContain("student_survey_submitted_answer_delete_guard");
  });

  it("adds reminder scheduling without backfilling existing assignments", () => {
    expect(continuousNotificationsMigrationSql).toContain("notification_schedule_started_at");
    expect(continuousNotificationsMigrationSql).toContain("next_notification_at");
    expect(continuousNotificationsMigrationSql).toContain("notification_count");
    expect(continuousNotificationsMigrationSql).not.toMatch(/\bUPDATE\s+student_survey_assignments\b/i);
    expect(continuousNotificationsMigrationSql).not.toMatch(/\bINSERT\s+INTO\s+(?:email_outbox|user_notifications)\b/i);
  });

  it("leaves an existing outstanding assignment outside the reminder schedule", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE admin_settings (settingKey TEXT PRIMARY KEY, settingValue TEXT, updatedAt TEXT);
        ${migrationSql}
        INSERT INTO users (id) VALUES (1);
        INSERT INTO student_surveys (id, code, title, created_by_user_id)
        VALUES (1, 'legacy', 'Legacy survey', 1);
        INSERT INTO student_survey_assignments (survey_id, user_id, due_at, block_at, created_by_user_id)
        VALUES (1, 1, '2026-08-10T10:00:00.000Z', '2026-08-12T10:00:00.000Z', 1);
        ${continuousNotificationsMigrationSql}
      `);
      const row = database.prepare(`
        SELECT notification_schedule_started_at AS scheduleStartedAt,
               next_notification_at AS nextNotificationAt,
               notification_count AS notificationCount
        FROM student_survey_assignments WHERE id = 1
      `).get();
      expect(row).toEqual({ scheduleStartedAt: null, nextNotificationAt: null, notificationCount: 0 });
    } finally {
      database.close();
    }
  });

  it("rejects assignment 501 without changing the first 500", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE admin_settings (
          settingKey TEXT PRIMARY KEY,
          settingValue TEXT,
          updatedAt TEXT
        );
        ${migrationSql}
        ${assignmentCapMigrationSql}
        WITH RECURSIVE student_ids(id) AS (
          SELECT 1 UNION ALL SELECT id + 1 FROM student_ids WHERE id < 501
        ) INSERT INTO users (id) SELECT id FROM student_ids;
        INSERT INTO student_surveys (id, code, title, created_by_user_id)
        VALUES (1, 'capacity-test', 'Capacity test', 1);
        INSERT INTO student_survey_assignments (
          survey_id, user_id, due_at, block_at, created_by_user_id
        ) SELECT 1, id, '2026-08-10T10:00:00.000Z', '2026-08-12T10:00:00.000Z', 1
          FROM users WHERE id <= 500;
      `);

      expect(() => database.prepare(`
        INSERT INTO student_survey_assignments (
          survey_id, user_id, due_at, block_at, created_by_user_id
        ) VALUES (1, 501, '2026-08-10T10:00:00.000Z', '2026-08-12T10:00:00.000Z', 1)
      `).run()).toThrow(/STUDENT_SURVEY_ASSIGNMENT_CAP_EXCEEDED/);
      expect(database.prepare(
        "SELECT COUNT(*) AS total FROM student_survey_assignments WHERE survey_id = 1",
      ).get().total).toBe(500);

      database.prepare(`
        INSERT INTO student_survey_questions (survey_id, question_text, question_type)
        VALUES (1, 'How was it?', 'short_text')
      `).run();
      const assignmentId = database.prepare(
        "SELECT id FROM student_survey_assignments WHERE survey_id = 1 AND user_id = 1",
      ).get().id;
      database.prepare(`
        INSERT INTO student_survey_answers (assignment_id, question_id, answer_text)
        VALUES (?, 1, 'Original')
      `).run(assignmentId);
      database.prepare(
        "UPDATE student_survey_assignments SET status = 'submitted' WHERE id = ?",
      ).run(assignmentId);

      expect(() => database.prepare(
        "DELETE FROM student_survey_answers WHERE assignment_id = ?",
      ).run(assignmentId)).toThrow(/STUDENT_SURVEY_SUBMITTED_ANSWERS_IMMUTABLE/);
      expect(() => database.prepare(`
        INSERT INTO student_survey_audit_logs (
          entity_type, entity_id, survey_id, user_id, actor_user_id, action
        ) VALUES ('assignment', ?, 1, 1, 1, 'submitted')
      `).run(assignmentId)).toThrow(/STUDENT_SURVEY_SUBMISSION_CONFLICT/);
      expect(() => database.prepare(`
        INSERT INTO student_survey_audit_logs (
          entity_type, entity_id, survey_id, user_id, actor_user_id, action
        ) VALUES ('assignment', ?, 1, 1, 1, 'reminder_sent')
      `).run(assignmentId)).toThrow(/STUDENT_SURVEY_REMINDER_CONFLICT/);
      expect(database.prepare(
        "SELECT answer_text AS answerText FROM student_survey_answers WHERE assignment_id = ?",
      ).get(assignmentId).answerText).toBe("Original");
    } finally {
      database.close();
    }
  });
});
