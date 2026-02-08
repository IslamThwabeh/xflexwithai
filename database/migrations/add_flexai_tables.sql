-- Add Telegram support to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'web';

-- Create FlexAI Subscriptions table
CREATE TABLE IF NOT EXISTS "flexaiSubscriptions" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "registrationKeyId" INTEGER REFERENCES "registrationKeys"(id) ON DELETE SET NULL,
  "status" VARCHAR(20) DEFAULT 'active',
  "activatedAt" TIMESTAMP DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create FlexAI Messages table
CREATE TABLE IF NOT EXISTS "flexaiMessages" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "subscriptionId" INTEGER REFERENCES "flexaiSubscriptions"(id) ON DELETE SET NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "imageUrl" TEXT,
  "analysisResult" JSONB,
  "analysisType" VARCHAR(50),
  "timeframe" VARCHAR(10),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_flexai_subscriptions_user_id ON "flexaiSubscriptions"("userId");
CREATE INDEX IF NOT EXISTS idx_flexai_subscriptions_status ON "flexaiSubscriptions"("status");
CREATE INDEX IF NOT EXISTS idx_flexai_messages_user_id ON "flexaiMessages"("userId");
CREATE INDEX IF NOT EXISTS idx_flexai_messages_subscription_id ON "flexaiMessages"("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_flexai_messages_created_at ON "flexaiMessages"("createdAt");

-- Add comments for documentation
COMMENT ON TABLE "flexaiSubscriptions" IS 'Tracks 30-day FlexAI subscriptions for chart analysis (web + Telegram)';
COMMENT ON TABLE "flexaiMessages" IS 'Stores FlexAI chat conversation history and analysis results';
COMMENT ON COLUMN users.telegram_user_id IS 'Telegram user ID for unified bot support';
COMMENT ON COLUMN users.user_type IS 'User platform type: web or telegram';
