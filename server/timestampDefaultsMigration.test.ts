import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { packageSubscriptions } from "../database/schema-sqlite";

const schemaPath = fileURLToPath(new URL("../database/schema-sqlite.ts", import.meta.url));
const migrationPath = fileURLToPath(
  new URL("../database/migrations/089_repair_literal_current_timestamps.sql", import.meta.url),
);

describe("timestamp defaults and production repair migration", () => {
  it("does not declare CURRENT_TIMESTAMP as a quoted text default", () => {
    const schemaSource = readFileSync(schemaPath, "utf8");
    expect(schemaSource).not.toContain('.default("CURRENT_TIMESTAMP")');
    expect(schemaSource).toContain(".default(sql`(datetime('now'))`)");
  });

  it("lets SQLite evaluate timestamp defaults for new Drizzle inserts", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");

    try {
      database.exec(`
        CREATE TABLE packageSubscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          packageId INTEGER NOT NULL,
          orderId INTEGER,
          isActive INTEGER NOT NULL DEFAULT 1,
          startDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          endDate TEXT,
          renewalDueDate TEXT,
          autoRenew INTEGER NOT NULL DEFAULT 0,
          upgradedFromPackageId INTEGER,
          upgradedAt TEXT,
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const db = drizzle(database);
      await db.insert(packageSubscriptions).values({ userId: 1, packageId: 2 });
      const row = database.prepare(
        "SELECT startDate, createdAt, updatedAt FROM packageSubscriptions WHERE id = 1",
      ).get();

      expect(row.startDate).not.toBe("CURRENT_TIMESTAMP");
      expect(row.createdAt).not.toBe("CURRENT_TIMESTAMP");
      expect(row.updatedAt).not.toBe("CURRENT_TIMESTAMP");
      expect(Date.parse(row.createdAt)).not.toBeNaN();
    } finally {
      database.close();
    }
  });

  it("repairs representative rows idempotently from related timestamps", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    const migrationSql = readFileSync(migrationPath, "utf8");

    try {
      database.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, createdAt TEXT, updatedAt TEXT, lastSignedIn TEXT, lastActiveAt TEXT, lastInteractiveAt TEXT);
        CREATE TABLE courses (id INTEGER PRIMARY KEY, createdAt TEXT, updatedAt TEXT);
        CREATE TABLE episodes (id INTEGER PRIMARY KEY, courseId INTEGER, createdAt TEXT, updatedAt TEXT);
        CREATE TABLE enrollments (id INTEGER PRIMARY KEY, enrolledAt TEXT, lastAccessed TEXT);
        CREATE TABLE packageSubscriptions (id INTEGER PRIMARY KEY, startDate TEXT, createdAt TEXT, updatedAt TEXT, upgradedAt TEXT);
        CREATE TABLE lexaiSubscriptions (id INTEGER PRIMARY KEY, startDate TEXT, createdAt TEXT, updatedAt TEXT, activationProcessedAt TEXT, studentActivatedAt TEXT, pausedAt TEXT);
        CREATE TABLE recommendationSubscriptions (id INTEGER PRIMARY KEY, startDate TEXT, createdAt TEXT, updatedAt TEXT, activationProcessedAt TEXT, studentActivatedAt TEXT, pausedAt TEXT);
        CREATE TABLE quizzes (id INTEGER PRIMARY KEY, created_at TEXT, updated_at TEXT);
        CREATE TABLE quiz_questions (id INTEGER PRIMARY KEY, quiz_id INTEGER, created_at TEXT, updated_at TEXT);
        CREATE TABLE quiz_options (id INTEGER PRIMARY KEY, question_id INTEGER, created_at TEXT);
        CREATE TABLE quiz_attempts (id INTEGER PRIMARY KEY, user_id INTEGER, quiz_id INTEGER, started_at TEXT, completed_at TEXT, time_taken_seconds INTEGER);
        CREATE TABLE quiz_answers (id INTEGER PRIMARY KEY, attempt_id INTEGER, created_at TEXT);
        CREATE TABLE user_quiz_progress (id INTEGER PRIMARY KEY, user_id INTEGER, quiz_id INTEGER, created_at TEXT, last_attempt_at TEXT);
        CREATE TABLE job_applications (id INTEGER PRIMARY KEY, submitted_at TEXT, updated_at TEXT, interview_invite_sent_at TEXT);
        CREATE TABLE job_invite_logs (id INTEGER PRIMARY KEY, application_id INTEGER, sent_at TEXT);

        INSERT INTO users VALUES (1, '2026-01-01T00:00:00.000Z', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP', '2026-02-01T00:00:00.000Z', NULL);
        INSERT INTO courses VALUES (1, 'CURRENT_TIMESTAMP', '2026-01-02T00:00:00.000Z');
        INSERT INTO episodes VALUES (1, 1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP');
        INSERT INTO enrollments VALUES (1, '2026-03-01T00:00:00.000Z', 'CURRENT_TIMESTAMP');
        INSERT INTO packageSubscriptions VALUES (1, '2026-03-02T00:00:00.000Z', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP', NULL);
        INSERT INTO lexaiSubscriptions VALUES (1, '2026-03-03T00:00:00.000Z', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP', NULL, NULL, NULL);
        INSERT INTO recommendationSubscriptions VALUES (1, '2026-03-04T00:00:00.000Z', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP', NULL, NULL, NULL);
        INSERT INTO quizzes VALUES (1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP');
        INSERT INTO quiz_questions VALUES (1, 1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP');
        INSERT INTO quiz_options VALUES (1, 1, 'CURRENT_TIMESTAMP');
        INSERT INTO quiz_attempts VALUES (1, 1, 1, 'CURRENT_TIMESTAMP', '2026-04-01T00:02:00.000Z', 120);
        INSERT INTO quiz_answers VALUES (1, 1, 'CURRENT_TIMESTAMP');
        INSERT INTO user_quiz_progress VALUES (1, 1, 1, 'CURRENT_TIMESTAMP', '2026-04-01T00:02:00.000Z');
        INSERT INTO job_applications VALUES (1, 'CURRENT_TIMESTAMP', '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z');
        INSERT INTO job_invite_logs VALUES (1, 1, 'CURRENT_TIMESTAMP');

        ${migrationSql}
        ${migrationSql}
      `);

      const remaining = database.prepare(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE updatedAt = 'CURRENT_TIMESTAMP' OR lastSignedIn = 'CURRENT_TIMESTAMP') +
          (SELECT COUNT(*) FROM episodes WHERE createdAt = 'CURRENT_TIMESTAMP' OR updatedAt = 'CURRENT_TIMESTAMP') +
          (SELECT COUNT(*) FROM packageSubscriptions WHERE createdAt = 'CURRENT_TIMESTAMP' OR updatedAt = 'CURRENT_TIMESTAMP') +
          (SELECT COUNT(*) FROM quiz_attempts WHERE started_at = 'CURRENT_TIMESTAMP') +
          (SELECT COUNT(*) FROM quiz_answers WHERE created_at = 'CURRENT_TIMESTAMP') +
          (SELECT COUNT(*) FROM job_invite_logs WHERE sent_at = 'CURRENT_TIMESTAMP') AS count
      `).get().count;

      expect(remaining).toBe(0);
      expect(database.prepare("SELECT lastSignedIn FROM users WHERE id = 1").get().lastSignedIn)
        .toBe("2026-02-01T00:00:00.000Z");
      expect(database.prepare("SELECT started_at FROM quiz_attempts WHERE id = 1").get().started_at)
        .toBe("2026-04-01T00:00:00.000Z");
      expect(database.prepare("SELECT sent_at FROM job_invite_logs WHERE id = 1").get().sent_at)
        .toBe("2026-05-02T00:00:00.000Z");
    } finally {
      database.close();
    }
  });
});
