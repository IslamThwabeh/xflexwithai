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
  new URL("../database/migrations/066_loyalty_rewards_foundation.sql", import.meta.url),
  "utf8",
);

sqlite.exec(migrationSql);
sqlite.exec(migrationSql);

const flag = sqlite.prepare(
  "SELECT settingValue FROM admin_settings WHERE settingKey = ?",
).get("loyalty_rewards_enabled");
if (flag?.settingValue !== "false") {
  throw new Error("loyalty_rewards_enabled must default to false");
}

sqlite.prepare(`
  INSERT INTO loyalty_reward_items
    (title_en, title_ar, points_cost, stock_quantity, is_active, created_by_user_id)
  VALUES (?, ?, ?, ?, ?, ?)
`).run("Coaching call", "جلسة تدريب", 500, 2, 1, 1);

let invalidCostRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO loyalty_reward_items
      (title_en, title_ar, points_cost, created_by_user_id)
    VALUES (?, ?, ?, ?)
  `).run("Invalid", "غير صالح", 0, 1);
} catch (error) {
  invalidCostRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidCostRejected) {
  throw new Error("Reward item points_cost constraint was not enforced");
}

sqlite.prepare(`
  INSERT INTO loyalty_reward_redemptions
    (reward_item_id, user_id, status, points_cost)
  VALUES (?, ?, ?, ?)
`).run(1, 10, "pending", 500);

let invalidStatusRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO loyalty_reward_redemptions
      (reward_item_id, user_id, status, points_cost)
    VALUES (?, ?, ?, ?)
  `).run(1, 10, "invalid", 500);
} catch (error) {
  invalidStatusRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidStatusRejected) {
  throw new Error("Reward redemption status constraint was not enforced");
}

let invalidAuditEntityRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO loyalty_reward_audit_logs
      (entity_type, entity_id, action)
    VALUES (?, ?, ?)
  `).run("invalid", 1, "created");
} catch (error) {
  invalidAuditEntityRejected = /CHECK constraint failed/i.test(String(error));
}
if (!invalidAuditEntityRejected) {
  throw new Error("Reward audit entity constraint was not enforced");
}

sqlite.close();
console.log("Loyalty rewards migration verification passed.");
