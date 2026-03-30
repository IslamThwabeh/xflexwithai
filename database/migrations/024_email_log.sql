-- Email Log table for tracking automated emails (prevents duplicate sends)
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  emailType TEXT NOT NULL,
  metadata TEXT,
  sentAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unique index to prevent sending the same email type to the same user twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_user_type ON email_log(userId, emailType);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sentAt);
