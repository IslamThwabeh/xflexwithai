CREATE TABLE IF NOT EXISTS email_delivery_daily_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(delivery_date, event_type, status, provider)
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_retention
  ON email_delivery_logs(created_at, id);
CREATE INDEX IF NOT EXISTS idx_email_provider_events_received_retention
  ON email_provider_webhook_events(received_at, id);

INSERT INTO email_delivery_daily_aggregates
  (delivery_date, event_type, status, provider, total, updated_at)
SELECT substr(created_at, 1, 10), event_type, status, COALESCE(provider, 'unknown'),
       COUNT(*), datetime('now')
FROM email_delivery_logs
WHERE created_at LIKE '____-__-__%'
GROUP BY substr(created_at, 1, 10), event_type, status, COALESCE(provider, 'unknown')
ON CONFLICT(delivery_date, event_type, status, provider) DO UPDATE SET
  total=excluded.total, updated_at=excluded.updated_at;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('129_email_delivery_retention.sql','codex_local_release',
  'Adds 7/30/180-day email retention indexes and anonymous daily aggregates.');
