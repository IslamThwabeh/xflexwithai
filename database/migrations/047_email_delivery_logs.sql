CREATE TABLE IF NOT EXISTS email_delivery_logs (
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON email_delivery_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient_email ON email_delivery_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs (status);