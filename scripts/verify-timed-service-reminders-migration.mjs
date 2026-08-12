import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  CREATE TABLE user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title_en TEXT NOT NULL
  );
  CREATE TABLE staff_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    titleEn TEXT NOT NULL
  );
  INSERT INTO user_notifications (user_id, title_en) VALUES (7, 'Existing');
  INSERT INTO staff_notifications (userId, titleEn) VALUES (-1, 'Existing');
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/085_timed_service_activation_reminders.sql", import.meta.url),
  "utf8",
);
if (/\b(?:DROP|DELETE|UPDATE)\b/i.test(migrationSql)) {
  throw new Error("Timed-service reminder migration must remain additive");
}
sqlite.exec(migrationSql);

sqlite.exec(`
  INSERT INTO user_notifications (user_id, title_en, dedupe_key)
    VALUES (7, 'Reminder', 'timed:7:three_days');
  INSERT INTO staff_notifications (userId, titleEn, dedupe_key)
    VALUES (-1, 'Legacy review', 'legacy:7:deadline');
`);

for (const duplicateSql of [
  `INSERT INTO user_notifications (user_id, title_en, dedupe_key)
    VALUES (7, 'Duplicate', 'timed:7:three_days')`,
  `INSERT INTO staff_notifications (userId, titleEn, dedupe_key)
    VALUES (-1, 'Duplicate', 'legacy:7:deadline')`,
]) {
  let rejected = false;
  try {
    sqlite.exec(duplicateSql);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`Migration accepted duplicate notification: ${duplicateSql}`);
}

sqlite.exec(`
  INSERT INTO user_notifications (user_id, title_en) VALUES (7, 'Another legacy row');
  INSERT INTO staff_notifications (userId, titleEn) VALUES (-1, 'Another legacy row');
  INSERT INTO staff_notifications (userId, titleEn, dedupe_key)
    VALUES (-2, 'Same event for another admin', 'legacy:7:deadline');
`);

console.log("Timed-service reminder migration verification passed.");
