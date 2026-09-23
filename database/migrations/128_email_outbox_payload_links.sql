ALTER TABLE email_outbox ADD COLUMN payloadId INTEGER;

UPDATE email_outbox
SET payloadId = (
  SELECT payload.id
  FROM email_outbox_payloads payload
  WHERE payload.eventType = email_outbox.eventType
    AND payload.templateId IS email_outbox.templateId
    AND payload.emailCategory IS email_outbox.emailCategory
    AND payload.subject = email_outbox.subject
    AND payload.bodyText = email_outbox.bodyText
    AND payload.bodyHtml IS email_outbox.bodyHtml
    AND payload.metadataJson IS email_outbox.metadataJson
  LIMIT 1
)
WHERE status IN (
  'sent', 'dead_letter', 'skipped', 'skipped_suppressed',
  'skipped_unsubscribed', 'cancelled'
)
AND EXISTS (
  SELECT 1
  FROM email_outbox_payloads payload
  WHERE payload.eventType = email_outbox.eventType
    AND payload.templateId IS email_outbox.templateId
    AND payload.emailCategory IS email_outbox.emailCategory
    AND payload.subject = email_outbox.subject
    AND payload.bodyText = email_outbox.bodyText
    AND payload.bodyHtml IS email_outbox.bodyHtml
    AND payload.metadataJson IS email_outbox.metadataJson
);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '128_email_outbox_payload_links.sql',
  'codex_local_release',
  'Links only exact duplicate terminal outbox rows to shared payloads.'
);
