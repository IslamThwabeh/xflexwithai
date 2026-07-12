import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE
  );
  CREATE TABLE admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settingKey TEXT NOT NULL UNIQUE,
    settingValue TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/064_student_surveys_foundation.sql", import.meta.url),
  "utf8",
);
const blockingFlagMigrationSql = readFileSync(
  new URL("../database/migrations/065_student_survey_blocking_flag.sql", import.meta.url),
  "utf8",
);
sqlite.exec(migrationSql);
sqlite.exec(blockingFlagMigrationSql);
sqlite.exec(migrationSql);
sqlite.exec(blockingFlagMigrationSql);

const flag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("student_surveys_enabled");
if (flag?.settingValue !== "false") {
  throw new Error("student_surveys_enabled must default to false");
}

const blockingFlag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("student_surveys_blocking_enabled");
if (blockingFlag?.settingValue !== "false") {
  throw new Error("student_surveys_blocking_enabled must default to false");
}

sqlite.prepare("INSERT INTO users (email) VALUES (?)").run("admin@example.com");
sqlite.prepare("INSERT INTO users (email) VALUES (?)").run("student@example.com");

const insertSurvey = sqlite.prepare(`
  INSERT INTO student_surveys
    (code, title, created_by_user_id)
  VALUES (?, ?, ?)
`);
insertSurvey.run("pilot-checkin", "Pilot check-in", 1);

let duplicateSurveyRejected = false;
try {
  insertSurvey.run("pilot-checkin", "Duplicate", 1);
} catch (error) {
  duplicateSurveyRejected = /UNIQUE constraint failed/i.test(String(error));
}
if (!duplicateSurveyRejected) {
  throw new Error("Survey code uniqueness constraint was not enforced");
}

sqlite.prepare(`
  INSERT INTO student_survey_questions
    (survey_id, question_text, question_type)
  VALUES (?, ?, ?)
`).run(1, "How is the program going?", "short_text");

const insertAssignment = sqlite.prepare(`
  INSERT INTO student_survey_assignments
    (survey_id, user_id, due_at, block_at, created_by_user_id)
  VALUES (?, ?, ?, ?, ?)
`);
insertAssignment.run(1, 2, "2026-07-10T12:00:00.000Z", "2026-07-12T12:00:00.000Z", 1);

let duplicateAssignmentRejected = false;
try {
  insertAssignment.run(1, 2, "2026-07-10T12:00:00.000Z", "2026-07-12T12:00:00.000Z", 1);
} catch (error) {
  duplicateAssignmentRejected = /UNIQUE constraint failed/i.test(String(error));
}
if (!duplicateAssignmentRejected) {
  throw new Error("Survey assignment uniqueness constraint was not enforced");
}

let invalidStatusRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_survey_assignments
      (survey_id, user_id, status, due_at, block_at, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(1, 2, "invalid", "2026-07-10T12:00:00.000Z", "2026-07-12T12:00:00.000Z", 1);
} catch (error) {
  invalidStatusRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidStatusRejected) {
  throw new Error("Survey assignment status constraint was not enforced");
}

sqlite.close();
console.log("Student surveys migration verification passed.");
