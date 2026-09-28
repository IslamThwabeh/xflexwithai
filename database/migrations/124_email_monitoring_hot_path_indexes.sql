-- Add covering indexes for measured D1 email-monitoring hot paths.
--
-- These are additive, idempotent, and non-unique. They keep the admin
-- delivery-log list/summary and the scheduled outbox status rollup bounded by
-- the timestamp filters already applied by the application.

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_id
  ON email_delivery_logs(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status_created_id
  ON email_delivery_logs(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_event_created_id
  ON email_delivery_logs(event_type, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_email_outbox_created_status
  ON email_outbox(createdAt, status);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '124_email_monitoring_hot_path_indexes.sql',
  'codex_local_release',
  'Adds D1 hot-path indexes for email delivery log monitoring and rolling email outbox status checks.'
);
