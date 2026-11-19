import { readFileSync } from 'node:fs';
import { createLocalD1Database } from '../../backend/_core/localD1';

export const orderDeliveryMigration = readFileSync(new URL('../../database/migrations/137_order_key_dual_delivery.sql', import.meta.url), 'utf8');

export async function orderDeliveryDatabase() {
  const database = await createLocalD1Database(':memory:');
  await database.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,name TEXT);
    CREATE TABLE orders(id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,isGift INTEGER DEFAULT 0,giftEmail TEXT,transactionPurpose TEXT);
    CREATE TABLE order_payment_confirmations(id INTEGER PRIMARY KEY,order_id INTEGER UNIQUE);
    CREATE TABLE orderItems(id INTEGER PRIMARY KEY,orderId INTEGER,itemType TEXT,packageId INTEGER);
    CREATE TABLE registrationKeys(id INTEGER PRIMARY KEY,orderId INTEGER,packageId INTEGER,email TEXT,keyCode TEXT,
      issuanceType TEXT,transactionPurpose TEXT,isActive INTEGER DEFAULT 1,activatedAt TEXT,expiresAt TEXT);
    CREATE UNIQUE INDEX idx_registration_keys_order_package ON registrationKeys(orderId,packageId) WHERE orderId IS NOT NULL AND packageId IS NOT NULL;
    CREATE TABLE supportConversations(id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,needsHuman INTEGER DEFAULT 0,
      assignedTo INTEGER,createdAt TEXT,updatedAt TEXT,closedAt TEXT);
    CREATE INDEX idx_supportConversations_userId ON supportConversations(userId);
    CREATE TABLE supportMessages(id INTEGER PRIMARY KEY,conversationId INTEGER,senderId INTEGER,senderType TEXT,
      senderDisplayName TEXT,content TEXT,isRead INTEGER,createdAt TEXT,deletedAt TEXT);
    CREATE INDEX idx_support_messages_conversation_created_id ON supportMessages(conversationId,createdAt,id);
    CREATE TABLE user_notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,title_en TEXT,title_ar TEXT,
      content_en TEXT,content_ar TEXT,action_url TEXT,dedupe_key TEXT UNIQUE,created_at TEXT);
    INSERT INTO users VALUES(7,'student@example.com','Student');
    INSERT INTO orders VALUES(42,7,'completed',0,NULL,'new_sale');
    INSERT INTO order_payment_confirmations VALUES(3,42);
    INSERT INTO orderItems VALUES(1,42,'package',1);
  `);
  await database.exec(orderDeliveryMigration);
  await database.exec(`INSERT INTO registrationKeys(id,orderId,packageId,email,keyCode,issuanceType,transactionPurpose)
    VALUES(8,42,1,'student@example.com','XFLEX-AAAAA-BBBBB-CCCCC','order','new_sale')`);
  // A scheduled fixture must actually be due. SQLite's fractional clock may
  // round just ahead of a JavaScript Date captured in the same millisecond.
  await database.exec("UPDATE order_key_delivery_jobs SET next_attempt_at='2026-01-01T00:00:00Z'");
  return database;
}
