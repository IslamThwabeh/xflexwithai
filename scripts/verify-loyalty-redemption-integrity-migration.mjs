import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    points_balance INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE loyalty_reward_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_en TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    points_cost INTEGER NOT NULL,
    stock_quantity INTEGER,
    is_active INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE loyalty_reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    points_cost INTEGER NOT NULL,
    points_transaction_id INTEGER,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE points_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    reason_en TEXT,
    reason_ar TEXT,
    reference_id INTEGER,
    reference_type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/069_loyalty_redemption_integrity.sql", import.meta.url),
  "utf8",
);
sqlite.exec(migrationSql);
sqlite.exec(migrationSql);

sqlite.exec(`
  INSERT INTO users (id, points_balance) VALUES (1, 1000), (2, 1000), (3, 100);
  INSERT INTO loyalty_reward_items
    (id, title_en, title_ar, points_cost, stock_quantity, is_active)
  VALUES (10, 'Call', 'مكالمة', 500, 1, 1);
  INSERT INTO loyalty_reward_redemptions (reward_item_id, user_id, points_cost)
  VALUES (10, 1, 500);
`);

const assertRow = (query, expected) => {
  const actual = sqlite.prepare(query).get();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected row for ${query}: ${JSON.stringify(actual)}`);
  }
};

assertRow("SELECT points_balance FROM users WHERE id = 1", { points_balance: 500 });
assertRow("SELECT stock_quantity FROM loyalty_reward_items WHERE id = 10", { stock_quantity: 0 });
assertRow("SELECT amount, reference_type FROM points_transactions WHERE id = 1", {
  amount: -500,
  reference_type: "loyalty_reward",
});

let outOfStockRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO loyalty_reward_redemptions (reward_item_id, user_id, points_cost)
    VALUES (10, 2, 500)
  `).run();
} catch (error) {
  outOfStockRejected = /loyalty_reward_out_of_stock/.test(String(error));
}
if (!outOfStockRejected) throw new Error("Out-of-stock request was not rejected");
assertRow("SELECT points_balance FROM users WHERE id = 2", { points_balance: 1000 });

sqlite.exec(`
  UPDATE loyalty_reward_redemptions
  SET status = 'rejected', updated_at = '2026-07-13T00:00:00.000Z'
  WHERE id = 1 AND status = 'pending';
`);
assertRow("SELECT points_balance FROM users WHERE id = 1", { points_balance: 1000 });
assertRow("SELECT stock_quantity FROM loyalty_reward_items WHERE id = 10", { stock_quantity: 1 });
assertRow("SELECT amount, reference_type FROM points_transactions WHERE id = 2", {
  amount: 500,
  reference_type: "loyalty_reward_refund",
});

let insufficientPointsRejected = false;
try {
  sqlite.prepare(`
    INSERT INTO loyalty_reward_redemptions (reward_item_id, user_id, points_cost)
    VALUES (10, 3, 500)
  `).run();
} catch (error) {
  insufficientPointsRejected = /loyalty_reward_insufficient_points/.test(String(error));
}
if (!insufficientPointsRejected) throw new Error("Insufficient-points request was not rejected");

sqlite.close();
console.log("Loyalty redemption integrity migration verification passed.");
