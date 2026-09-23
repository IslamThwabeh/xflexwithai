-- Preserve one content copy only for exact duplicate terminal outbox groups.
-- Unique support replies and all active/retryable rows remain inline.

CREATE TABLE IF NOT EXISTS email_outbox_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceOutboxId INTEGER NOT NULL UNIQUE,
  eventType TEXT NOT NULL,
  templateId TEXT,
  emailCategory TEXT,
  subject TEXT NOT NULL,
  bodyText TEXT NOT NULL,
  bodyHtml TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO email_outbox_payloads (
  sourceOutboxId,
  eventType,
  templateId,
  emailCategory,
  subject,
  bodyText,
  bodyHtml,
  metadataJson,
  createdAt
)
SELECT
  MIN(id),
  eventType,
  templateId,
  emailCategory,
  subject,
  bodyText,
  bodyHtml,
  metadataJson,
  MIN(createdAt)
FROM email_outbox
WHERE status IN (
  'sent', 'dead_letter', 'skipped', 'skipped_suppressed',
  'skipped_unsubscribed', 'cancelled'
)
GROUP BY eventType, templateId, emailCategory, subject, bodyText, bodyHtml, metadataJson
HAVING COUNT(*) > 1;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '127_email_outbox_duplicate_payloads.sql',
  'codex_local_release',
  'Stores one content copy for exact duplicate terminal email-outbox groups; unique and retryable rows stay inline.'
);
