ALTER TABLE email_delivery_logs ADD COLUMN provider_request_id TEXT;
ALTER TABLE email_delivery_logs ADD COLUMN provider_event_name TEXT;
ALTER TABLE email_delivery_logs ADD COLUMN provider_event_at TEXT;
ALTER TABLE email_delivery_logs ADD COLUMN final_status_at TEXT;

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_provider_request
  ON email_delivery_logs(provider, provider_request_id);

CREATE TABLE IF NOT EXISTS email_provider_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_request_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  recipient_email TEXT,
  diagnostic TEXT,
  event_at TEXT,
  matched_log_count INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_provider_webhook_event
  ON email_provider_webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_email_provider_webhook_request
  ON email_provider_webhook_events(provider, provider_request_id);

CREATE TABLE IF NOT EXISTS support_assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  previous_assigned_to INTEGER,
  new_assigned_to INTEGER,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_assignment_history_conversation_created
  ON support_assignment_history(conversation_id, created_at, id);
