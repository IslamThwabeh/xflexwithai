-- Permanent email suppression for provider-confirmed hard bounces.
-- This is separate from category-specific unsubscribe preferences because
-- a non-existent mailbox must be excluded from transactional and staff mail.
CREATE TABLE IF NOT EXISTS email_suppressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  provider TEXT,
  metadata TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  suppressed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_active_email
  ON email_suppressions (is_active, email);

-- Verified in the user-provided ZeptoMail detail on 2026-07-28:
-- 5.1.1 User does not exist / bad-mailbox.
INSERT INTO email_suppressions (
  email,
  reason,
  source,
  provider,
  metadata
)
VALUES (
  'admin@xflexacademy.com',
  'hard_bounce_5_1_1_user_not_found',
  'zeptomail_manual_2026_07_28',
  'zeptomail',
  '{"eventType":"new_support_message","evidence":"provider_bounce_detail"}'
)
ON CONFLICT(email) DO UPDATE SET
  reason = excluded.reason,
  source = excluded.source,
  provider = excluded.provider,
  metadata = excluded.metadata,
  is_active = 1,
  suppressed_at = datetime('now'),
  updated_at = datetime('now');
