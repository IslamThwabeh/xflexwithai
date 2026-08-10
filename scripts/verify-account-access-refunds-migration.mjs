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
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    userId INTEGER NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE registrationKeys (
    id INTEGER PRIMARY KEY,
    email TEXT,
    orderId INTEGER,
    activatedAt TEXT,
    packageId INTEGER,
    price INTEGER NOT NULL DEFAULT 0
  );
`);

const migrationSql = readFileSync(
  new URL("../database/migrations/082_account_access_and_ils_refunds.sql", import.meta.url),
  "utf8",
);
sqlite.exec(migrationSql);

sqlite.exec(`
  INSERT INTO users (id, email, isStaff) VALUES
    (1, 'client@example.com', 0),
    (2, 'other@example.com', 0);
  INSERT INTO orders (id, userId, status) VALUES (10, 1, 'completed');
  INSERT INTO registrationKeys (id, email, orderId, activatedAt, packageId, price)
  VALUES (20, 'client@example.com', 10, '2026-08-01T00:00:00.000Z', 1, 200);
  INSERT INTO account_refunds (
    request_id, user_id, order_id, registration_key_id,
    amount_ils_agorot, gross_amount_ils_agorot, reason,
    refund_method, refunded_at, recorded_by_type, recorded_by_id
  ) VALUES (
    'first', 1, 10, 20, 35000, 70000, 'First partial refund',
    'bank_transfer', '2026-08-10T00:00:00.000Z', 'admin', 1
  );
  INSERT INTO account_refunds (
    request_id, user_id, order_id, registration_key_id,
    amount_ils_agorot, gross_amount_ils_agorot, reason,
    refund_method, refunded_at, recorded_by_type, recorded_by_id
  ) VALUES (
    'second', 1, 10, 20, 35000, 70000, 'Second partial refund',
    'cash', '2026-08-10T00:05:00.000Z', 'support', 9
  );
`);

const total = sqlite.prepare(`
  SELECT SUM(amount_ils_agorot) AS amount
  FROM account_refunds
  WHERE registration_key_id = 20
`).get();
if (total.amount !== 70000) {
  throw new Error(`Expected a fully refunded ₪700 sale, got ${JSON.stringify(total)}`);
}

for (const invalid of [
  {
    label: "over-refund",
    sql: `INSERT INTO account_refunds
      (request_id, user_id, order_id, registration_key_id, amount_ils_agorot,
       gross_amount_ils_agorot, reason, refund_method, refunded_at,
       recorded_by_type, recorded_by_id)
      VALUES ('third', 1, 10, 20, 1, 70000, 'Exceeds sale value', 'other',
       '2026-08-10T00:06:00.000Z', 'admin', 1)`,
    pattern: /ACCOUNT_REFUND_EXCEEDS_ILS_SALE/,
  },
  {
    label: "wrong-client",
    sql: `INSERT INTO account_refunds
      (request_id, user_id, order_id, registration_key_id, amount_ils_agorot,
       gross_amount_ils_agorot, reason, refund_method, refunded_at,
       recorded_by_type, recorded_by_id)
      VALUES ('wrong-client', 2, 10, 20, 1, 70000, 'Wrong client sale', 'other',
       '2026-08-10T00:06:00.000Z', 'admin', 1)`,
    pattern: /ACCOUNT_REFUND_SALE_MISMATCH/,
  },
]) {
  let rejected = false;
  try {
    sqlite.exec(invalid.sql);
  } catch (error) {
    rejected = invalid.pattern.test(String(error));
  }
  if (!rejected) throw new Error(`Migration did not reject ${invalid.label}`);
}

sqlite.exec(`
  UPDATE users
  SET login_blocked_at = '2026-08-10T01:00:00.000Z',
      login_blocked_reason = 'Support investigation',
      login_blocked_by_type = 'support',
      login_blocked_by_id = 9
  WHERE id = 1;
  INSERT INTO account_access_audit_logs
    (user_id, action, reason, actor_type, actor_id, services_deactivated)
  VALUES (1, 'blocked', 'Support investigation', 'support', 9, 1);
`);

const blocked = sqlite.prepare(`
  SELECT login_blocked_reason AS reason, login_blocked_by_type AS actor_type
  FROM users WHERE id = 1
`).get();
if (blocked.reason !== "Support investigation" || blocked.actor_type !== "support") {
  throw new Error(`Unexpected access state: ${JSON.stringify(blocked)}`);
}

console.log("Account access and ILS refunds migration verification passed.");
