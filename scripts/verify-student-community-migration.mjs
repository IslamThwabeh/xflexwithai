import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settingKey TEXT NOT NULL UNIQUE,
    settingValue TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/067_student_community_foundation.sql", import.meta.url),
  "utf8",
);

sqlite.exec(migrationSql);
sqlite.exec(migrationSql);

const flag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("student_community_enabled");
if (flag?.settingValue !== "false") {
  throw new Error("student_community_enabled must default to false");
}

sqlite.prepare(`
  INSERT INTO student_community_posts
    (user_id, title, body)
  VALUES (?, ?, ?)
`).run(1, "Risk question", "How should I practice risk management?");

sqlite.prepare(`
  INSERT INTO student_community_comments
    (post_id, user_id, body)
  VALUES (?, ?, ?)
`).run(1, 2, "Start with position sizing.");

let invalidPostStatusRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_community_posts
      (user_id, title, body, status)
    VALUES (?, ?, ?, ?)
  `).run(1, "Invalid", "Invalid", "invalid");
} catch (error) {
  invalidPostStatusRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidPostStatusRejected) {
  throw new Error("Post status constraint was not enforced");
}

sqlite.prepare(`
  INSERT INTO student_community_reports
    (target_type, target_id, reporter_user_id, reason)
  VALUES (?, ?, ?, ?)
`).run("post", 1, 3, "spam");

let duplicateReportRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_community_reports
      (target_type, target_id, reporter_user_id, reason)
    VALUES (?, ?, ?, ?)
  `).run("post", 1, 3, "spam again");
} catch (error) {
  duplicateReportRejected = /UNIQUE constraint failed/i.test(String(error));
}
if (!duplicateReportRejected) {
  throw new Error("Duplicate report constraint was not enforced");
}

let invalidReportTargetRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO student_community_reports
      (target_type, target_id, reporter_user_id, reason)
    VALUES (?, ?, ?, ?)
  `).run("invalid", 1, 4, "bad");
} catch (error) {
  invalidReportTargetRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidReportTargetRejected) {
  throw new Error("Report target_type constraint was not enforced");
}

sqlite.close();
console.log("Student community migration verification passed.");
