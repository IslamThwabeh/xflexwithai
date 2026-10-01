-- Add durable daily rollups for old raw-data retention cleanup.
--
-- These tables preserve aggregate history before future raw-row deletion.
-- The migration is additive and does not mutate existing source rows.

CREATE TABLE IF NOT EXISTS raw_retention_engagement_daily_rollups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 0,
  unique_user_count INTEGER NOT NULL DEFAULT 0,
  first_event_at TEXT,
  last_event_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_raw_retention_engagement_daily_bucket
    UNIQUE (local_date, event_type, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_raw_retention_engagement_daily_date
  ON raw_retention_engagement_daily_rollups(local_date, event_type);

CREATE TABLE IF NOT EXISTS raw_retention_email_daily_rollups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  email_count INTEGER NOT NULL DEFAULT 0,
  first_created_at TEXT,
  last_created_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_raw_retention_email_daily_bucket
    UNIQUE (local_date, event_type, status, provider)
);

CREATE INDEX IF NOT EXISTS idx_raw_retention_email_daily_date
  ON raw_retention_email_daily_rollups(local_date, event_type, status);

CREATE TABLE IF NOT EXISTS raw_retention_notification_daily_rollups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  email_sent INTEGER NOT NULL DEFAULT 0,
  notification_count INTEGER NOT NULL DEFAULT 0,
  first_created_at TEXT,
  last_created_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT uq_raw_retention_notification_daily_bucket
    UNIQUE (local_date, type, is_read, email_sent)
);

CREATE INDEX IF NOT EXISTS idx_raw_retention_notification_daily_date
  ON raw_retention_notification_daily_rollups(local_date, type, is_read);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '127_raw_data_retention_rollups.sql',
  'codex_local_release',
  'Adds daily aggregate rollup tables for raw engagement, email, and notification retention cleanup.'
);
