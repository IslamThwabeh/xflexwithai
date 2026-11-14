-- Positive account IDs identify users/staff; negative IDs identify admins,
-- following the existing authenticated request-context namespace.
-- Rows are written only when that account dismisses or defers the announcement.
CREATE TABLE IF NOT EXISTS interface_announcement_states (
  announcement_id TEXT NOT NULL,
  account_id INTEGER NOT NULL CHECK (account_id <> 0),
  dismissed_at TEXT,
  deferred_login TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (announcement_id, account_id)
) WITHOUT ROWID;
