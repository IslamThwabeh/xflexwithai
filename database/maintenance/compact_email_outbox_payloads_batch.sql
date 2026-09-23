-- Clear at most 500 linked terminal copies. Required text columns use empty
-- strings; the full exact content remains in email_outbox_payloads.
UPDATE email_outbox
SET subject = '',
    bodyText = '',
    bodyHtml = NULL,
    metadataJson = NULL,
    updatedAt = updatedAt
WHERE id IN (
  SELECT outbox.id
  FROM email_outbox outbox
  INNER JOIN email_outbox_payloads payload ON payload.id = outbox.payloadId
  WHERE outbox.status IN (
    'sent', 'dead_letter', 'skipped', 'skipped_suppressed',
    'skipped_unsubscribed', 'cancelled'
  )
  AND (
    outbox.subject <> '' OR outbox.bodyText <> ''
    OR outbox.bodyHtml IS NOT NULL OR outbox.metadataJson IS NOT NULL
  )
  ORDER BY outbox.id
  LIMIT 500
);
