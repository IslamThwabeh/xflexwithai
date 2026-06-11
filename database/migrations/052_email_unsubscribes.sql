CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  token_hash TEXT,
  source TEXT,
  unsubscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_unsubscribes_email_category
  ON email_unsubscribes (email, category);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_category
  ON email_unsubscribes (category);
