-- Add cleanup-friendly indexes for raw retention dry-runs and future bounded
-- deletes. These are additive, idempotent, and non-unique.

CREATE INDEX IF NOT EXISTS idx_engagement_events_created_id
  ON engagement_events(created_at, id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_retention_created_id
  ON user_notifications(created_at, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '126_raw_data_retention_indexes.sql',
  'codex_local_release',
  'Adds D1 retention indexes for old engagement events and user notifications.'
);
