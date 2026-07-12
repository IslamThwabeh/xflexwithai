import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    points_balance INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settingKey TEXT NOT NULL UNIQUE,
    settingValue TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/068_student_job_eligibility_foundation.sql", import.meta.url),
  "utf8",
);

sqlite.exec(migrationSql);
sqlite.exec(migrationSql);

const flag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("student_job_eligibility_enabled");
if (flag?.settingValue !== "false") {
  throw new Error("student_job_eligibility_enabled must default to false");
}

sqlite.prepare("INSERT INTO users (email, points_balance) VALUES (?, ?)").run("student@example.com", 120);
sqlite.prepare("INSERT INTO users (email, points_balance) VALUES (?, ?)").run("admin@example.com", 0);
sqlite.prepare(`
  INSERT INTO jobs (title_ar, title_en, description_ar)
  VALUES (?, ?, ?)
`).run("محلل مبتدئ", "Junior Analyst", "فرصة تدريبية");

sqlite.prepare(`
  INSERT INTO student_job_profiles
    (user_id, headline, skills, experience_summary)
  VALUES (?, ?, ?, ?)
`).run(1, "Junior trader", "Risk management", "Finished practice plans");

sqlite.prepare(`
  INSERT INTO student_job_eligibility_rules
    (job_id, min_completed_episodes, min_passed_quizzes, min_points_balance, created_by_user_id)
  VALUES (?, ?, ?, ?, ?)
`).run(1, 10, 2, 100, 2);

let duplicateRuleRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_job_eligibility_rules
      (job_id, created_by_user_id)
    VALUES (?, ?)
  `).run(1, 2);
} catch (error) {
  duplicateRuleRejected = /UNIQUE constraint failed/i.test(String(error));
}
if (!duplicateRuleRejected) {
  throw new Error("Duplicate rule per job was not rejected");
}

sqlite.prepare(`
  INSERT INTO student_job_eligibility_reviews
    (user_id, job_id, status, system_eligible, score, snapshot_json)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(1, 1, "submitted", 1, 100, "{}");

let invalidStatusRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_job_eligibility_reviews
      (user_id, job_id, status, snapshot_json)
    VALUES (?, ?, ?, ?)
  `).run(2, 1, "invalid", "{}");
} catch (error) {
  invalidStatusRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidStatusRejected) {
  throw new Error("Invalid review status was not rejected");
}

sqlite.prepare(`
  INSERT INTO student_job_eligibility_audit_logs
    (user_id, job_id, actor_user_id, action, to_status)
  VALUES (?, ?, ?, ?, ?)
`).run(1, 1, 2, "review_decision", "eligible");

sqlite.close();
console.log("Student job eligibility migration verification passed.");
