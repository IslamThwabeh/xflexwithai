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
  new URL("../database/migrations/063_staff_performance_foundation.sql", import.meta.url),
  "utf8",
);
sqlite.exec(migrationSql);
sqlite.exec(migrationSql);

const flag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("staff_performance_enabled");
if (flag?.settingValue !== "false") {
  throw new Error("staff_performance_enabled must default to false");
}

sqlite.prepare("INSERT INTO users (email) VALUES (?)").run("manager@example.com");
sqlite.prepare("INSERT INTO users (email) VALUES (?)").run("employee@example.com");
const insertPlan = sqlite.prepare(`
  INSERT INTO staff_performance_monthly_plans
    (staff_user_id, month, title, created_by_user_id)
  VALUES (?, ?, ?, ?)
`);
insertPlan.run(2, "2026-07", "July", 1);

let duplicateRejected = false;
try {
  insertPlan.run(2, "2026-07", "Duplicate", 1);
} catch (error) {
  duplicateRejected = /UNIQUE constraint failed/i.test(String(error));
}
if (!duplicateRejected) {
  throw new Error("Monthly plan uniqueness constraint was not enforced");
}

let invalidStatusRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO staff_performance_daily_logs
      (staff_user_id, local_date, timezone, status)
    VALUES (?, ?, ?, ?)
  `).run(2, "2026-07-09", "Asia/Amman", "invalid");
} catch (error) {
  invalidStatusRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidStatusRejected) {
  throw new Error("Performance status constraint was not enforced");
}

sqlite.close();
console.log("Staff performance migration verification passed.");
