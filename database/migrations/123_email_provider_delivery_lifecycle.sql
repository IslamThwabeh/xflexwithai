ALTER TABLE email_delivery_logs ADD COLUMN provider_client_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_provider_client_reference
  ON email_delivery_logs(provider, provider_client_reference)
  WHERE provider_client_reference IS NOT NULL;

ALTER TABLE email_provider_webhook_events ADD COLUMN provider_client_reference TEXT;
ALTER TABLE email_provider_webhook_events ADD COLUMN delivery_status TEXT;
ALTER TABLE email_provider_webhook_events ADD COLUMN projected_log_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_email_provider_webhook_client_reference
  ON email_provider_webhook_events(provider, provider_client_reference)
  WHERE provider_client_reference IS NOT NULL;

-- The initial audit rollout inserted the SQL token as literal text. Exact
-- per-message times do not exist, so anchor those rows to the rollout ledger.
UPDATE email_delivery_logs
SET created_at = COALESCE(
  (SELECT applied_at FROM schema_migrations
   WHERE migration_name = '088_email_delivery_and_support_assignment.sql'
   LIMIT 1),
  '2026-08-18 08:53:09'
)
WHERE created_at = 'CURRENT_TIMESTAMP';

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '123_email_provider_delivery_lifecycle.sql',
  'codex_local_release',
  'Adds provider client-reference correlation, ordered lifecycle projection, and repairs literal legacy email timestamps.'
);
