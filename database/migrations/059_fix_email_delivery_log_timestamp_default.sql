-- Rebuild email_delivery_logs so created_at uses SQLite's runtime timestamp
-- expression instead of any legacy literal CURRENT_TIMESTAMP default.
ALTER TABLE email_delivery_logs RENAME TO email_delivery_logs_legacy_059;

CREATE TABLE email_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  recipient_user_id INTEGER,
  event_type TEXT NOT NULL,
  template_id TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  error_message TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO email_delivery_logs (
  id,
  recipient_email,
  recipient_user_id,
  event_type,
  template_id,
  subject,
  status,
  provider,
  error_message,
  metadata,
  created_at
)
SELECT
  id,
  recipient_email,
  recipient_user_id,
  event_type,
  template_id,
  subject,
  status,
  provider,
  error_message,
  metadata,
  created_at
FROM email_delivery_logs_legacy_059;

DROP TABLE email_delivery_logs_legacy_059;

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at
  ON email_delivery_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient_email
  ON email_delivery_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status
  ON email_delivery_logs (status);
