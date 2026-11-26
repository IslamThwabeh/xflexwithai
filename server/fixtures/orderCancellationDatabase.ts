import { readFileSync } from "node:fs";
import { createLocalD1Database } from "../../backend/_core/localD1";
export const originalTime = "2026-11-25T10:00:00.000Z";
export const migration = readFileSync(
  new URL(
    "../../database/migrations/139_order_cancellation_lookups.sql",
    import.meta.url
  ),
  "utf8"
);
export async function orderCancellationDatabase() {
  const database = await createLocalD1Database(":memory:");
  await database.exec(`
   CREATE TABLE schema_migrations(migration_name TEXT PRIMARY KEY,source TEXT,notes TEXT);
   CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT);
   CREATE TABLE admins(id INTEGER PRIMARY KEY,name TEXT);
   INSERT INTO users VALUES(20,'Test reviewer');
   INSERT INTO admins VALUES(1,'Test finance owner');
   CREATE TABLE orders(id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,updatedAt TEXT,paymentProofUrl TEXT,paymentReference TEXT,totalAmount INTEGER,termsAcceptedAt TEXT,giftEmail TEXT);
   CREATE TABLE order_status_history(id INTEGER PRIMARY KEY,order_id INTEGER,user_id INTEGER,previous_status TEXT,new_status TEXT,actor_type TEXT,actor_id INTEGER,reason TEXT,ip_address TEXT,created_at TEXT);
   CREATE TABLE order_payment_confirmations(id INTEGER PRIMARY KEY,order_id INTEGER UNIQUE,paid_at TEXT);
   CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,orderId INTEGER,keyCode TEXT,isActive INTEGER);
   CREATE TABLE financial_ledger_entries(id INTEGER PRIMARY KEY,order_id INTEGER,base_amount_ils_minor INTEGER);
   CREATE TABLE live_package_entitlements(id INTEGER PRIMARY KEY,orderId INTEGER,isActive INTEGER);
   CREATE TABLE packageSubscriptions(id INTEGER PRIMARY KEY,orderId INTEGER,isActive INTEGER);
   CREATE TABLE trade_copier_subscriptions(id INTEGER PRIMARY KEY,order_id INTEGER UNIQUE,status TEXT);
   CREATE TABLE order_retirements(order_id INTEGER PRIMARY KEY,reason TEXT,replacement_order_id INTEGER);
   INSERT INTO orders VALUES(42,7,'pending','${originalTime}',NULL,'bank ref retained',70000,'2026-11-25T09:00:00Z','recipient@example.test');
  `);
  await database.exec(migration);
  return database;
}
