-- migrations/001_add_flexai_tables.sql
-- Run this SQL to add FlexAI support to your database

-- Step 1: Add Telegram support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'web';

-- Create index for fast Telegram lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);

-- Step 2: Add key_type to registration_keys if not exists
-- (You may already have this column)
ALTER TABLE registration_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(50);

-- Step 3: Create FlexAI Subscriptions table
CREATE TABLE IF NOT EXISTS flexai_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_key_id INTEGER REFERENCES registration_keys(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 4: Create FlexAI Messages table
CREATE TABLE IF NOT EXISTS flexai_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES flexai_subscriptions(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  image_url TEXT,
  analysis_result JSONB,
  analysis_type VARCHAR(50),
  timeframe VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flexai_subscriptions_user_id ON flexai_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_flexai_subscriptions_status ON flexai_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_flexai_messages_user_id ON flexai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_flexai_messages_created_at ON flexai_messages(created_at DESC);

-- Step 6: Verify tables created
SELECT 
  'users' as table_name, 
  COUNT(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'users'
UNION ALL
SELECT 
  'flexai_subscriptions', 
  COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'flexai_subscriptions'
UNION ALL
SELECT 
  'flexai_messages', 
  COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'flexai_messages';
