import { readFileSync } from "node:fs";
import { createLocalD1Database } from "../../backend/_core/localD1";
export const checkoutMigration = readFileSync(
  new URL(
    "../../database/migrations/140_checkout_intents_and_pricing.sql",
    import.meta.url
  ),
  "utf8"
);
export async function checkoutIntentDatabase() {
  const database = await createLocalD1Database(":memory:");
  await database.exec(`
  CREATE TABLE schema_migrations(migration_name TEXT PRIMARY KEY,source TEXT,notes TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,userId INTEGER NOT NULL,status TEXT NOT NULL,subtotal INTEGER,discountAmount INTEGER,vatRate INTEGER,vatAmount INTEGER,totalAmount INTEGER,currency TEXT,paymentMethod TEXT,paymentReference TEXT,paymentProofUrl TEXT,isGift INTEGER,giftEmail TEXT,giftMessage TEXT,notes TEXT,isUpgrade INTEGER,upgradeFromPackageId INTEGER,transactionPurpose TEXT,termsAcceptedAt TEXT,termsAcceptedVersion TEXT,termsAcceptedIpAddress TEXT,termsAcceptedUserAgent TEXT,createdAt TEXT,updatedAt TEXT,completedAt TEXT);
  CREATE UNIQUE INDEX uq_orders_open_renewal_per_user ON orders(userId,transactionPurpose) WHERE transactionPurpose='renewal' AND status IN('pending','awaiting_confirmation','paid');
  CREATE TABLE orderItems(id INTEGER PRIMARY KEY,orderId INTEGER NOT NULL,itemType TEXT,packageId INTEGER,courseId INTEGER,priceAtPurchase INTEGER,currency TEXT,transactionPurpose TEXT);
  CREATE TABLE order_renewal_details(order_id INTEGER PRIMARY KEY,user_id INTEGER,package_id INTEGER,entitlement_days INTEGER,amount_ils_minor INTEGER,recommendations_current_end_at TEXT,lexai_current_end_at TEXT,recommendations_projected_end_at TEXT,lexai_projected_end_at TEXT,created_at TEXT);
  CREATE TABLE trade_copier_subscriptions(id INTEGER PRIMARY KEY,user_id INTEGER,order_id INTEGER UNIQUE,status TEXT,service_key TEXT,amount_ils_minor INTEGER,access_days INTEGER,created_by_type TEXT,created_by_id INTEGER,created_at TEXT,updated_at TEXT);
  CREATE TABLE coupons(id INTEGER PRIMARY KEY,code TEXT,discount_type TEXT,discount_value INTEGER,max_uses INTEGER,used_count INTEGER,min_order_amount INTEGER,valid_from TEXT,valid_until TEXT,is_active INTEGER,package_id INTEGER,created_at TEXT,updated_at TEXT);
  INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,used_count,min_order_amount,valid_from,valid_until,is_active,package_id) VALUES(1,'SAVE10','percentage',10,10,0,NULL,NULL,NULL,1,NULL);
  CREATE TABLE order_payment_confirmations(id INTEGER PRIMARY KEY,order_id INTEGER);
  CREATE TABLE financial_ledger_entries(id INTEGER PRIMARY KEY,base_amount_ils_minor INTEGER);
  CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,keyCode TEXT);
  CREATE TABLE live_package_entitlements(id INTEGER PRIMARY KEY,userId INTEGER);
  CREATE TABLE order_retirements(order_id INTEGER PRIMARY KEY,replacement_order_id INTEGER);
 `);
  await database.exec(checkoutMigration);
  return database;
}
