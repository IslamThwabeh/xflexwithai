-- Migration 066: Loyalty rewards catalog and redemption workflow
-- Safe/additive only. The feature flag is disabled by default.

CREATE TABLE IF NOT EXISTS loyalty_reward_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_items_active
  ON loyalty_reward_items (is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS loyalty_reward_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  points_transaction_id INTEGER,
  admin_note TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by_user_id INTEGER,
  fulfilled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_redemptions_user
  ON loyalty_reward_redemptions (user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_redemptions_status
  ON loyalty_reward_redemptions (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS loyalty_reward_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('item', 'redemption')),
  entity_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_audit_entity
  ON loyalty_reward_audit_logs (entity_type, entity_id, created_at DESC);

INSERT INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('loyalty_rewards_enabled', 'false', datetime('now'))
ON CONFLICT(settingKey) DO NOTHING;
