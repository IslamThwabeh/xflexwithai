// drizzle/schema-updates.ts
// Add these to your existing schema.ts file

import { pgTable, serial, integer, varchar, text, timestamp, boolean, bigint, jsonb } from 'drizzle-orm/pg-core';

// Update your existing users table to include these fields
// If you already have a users table, add these columns:
export const usersUpdates = {
  telegram_user_id: bigint('telegram_user_id', { mode: 'bigint' }).unique(),
  user_type: varchar('user_type', { length: 20 }).default('web'),
};

// FlexAI Subscriptions table
export const flexaiSubscriptions = pgTable('flexai_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  registrationKeyId: integer('registration_key_id').references(() => registrationKeys.id),
  status: varchar('status', { length: 20 }).default('active'),
  activatedAt: timestamp('activated_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// FlexAI Messages table
export const flexaiMessages = pgTable('flexai_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => flexaiSubscriptions.id, { onDelete: 'set null' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  analysisResult: jsonb('analysis_result'),
  analysisType: varchar('analysis_type', { length: 50 }),
  timeframe: varchar('timeframe', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow()
});

// Note: Import 'users' and 'registrationKeys' from your existing schema
// This file shows what to add, not a complete schema replacement
