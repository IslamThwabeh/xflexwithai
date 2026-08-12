import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    isStaff INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO users (id, email, isStaff) VALUES
    (1, 'client@example.com', 0),
    (2, 'other@example.com', 0);
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/084_client_notification_controls.sql", import.meta.url),
  "utf8",
);
if (/\b(?:DROP|DELETE|UPDATE|ALTER)\b/i.test(migrationSql)) {
  throw new Error("Notification control migration must remain additive");
}
sqlite.exec(migrationSql);

sqlite.exec(`
  INSERT INTO client_notification_controls
    (user_id, category, is_disabled, reason, updated_by_type, updated_by_id, disabled_at)
  VALUES
    (1, 'recommendations', 1, 'Client requested recommendation alerts disabled', 'support', 9, datetime('now'));
  INSERT INTO client_notification_control_audit
    (user_id, category, action, reason, actor_type, actor_id)
  VALUES
    (1, 'recommendations', 'disabled', 'Client requested recommendation alerts disabled', 'support', 9);
`);

const control = sqlite.prepare(`
  SELECT is_disabled, updated_by_type
  FROM client_notification_controls
  WHERE user_id = 1 AND category = 'recommendations'
`).get();
if (control.is_disabled !== 1 || control.updated_by_type !== "support") {
  throw new Error(`Unexpected notification control: ${JSON.stringify(control)}`);
}

for (const invalid of [
  `INSERT INTO client_notification_controls
    (user_id, category, is_disabled, reason, updated_by_type, updated_by_id, disabled_at)
    VALUES (2, 'billing', 1, 'Must not suppress transactional messages', 'admin', 1, datetime('now'))`,
  `INSERT INTO client_notification_controls
    (user_id, category, is_disabled, reason, updated_by_type, updated_by_id, disabled_at)
    VALUES (2, 'recommendations', 1, 'bad', 'admin', 1, datetime('now'))`,
  `INSERT INTO client_notification_controls
    (user_id, category, is_disabled, reason, updated_by_type, updated_by_id, disabled_at)
    VALUES (2, 'recommendations', 0, 'Notifications restored by administrator', 'admin', 1, datetime('now'))`,
]) {
  let rejected = false;
  try {
    sqlite.exec(invalid);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`Migration accepted an invalid notification control: ${invalid}`);
}

console.log("Client notification controls migration verification passed.");
