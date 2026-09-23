UPDATE email_outbox
SET subject = (SELECT subject FROM email_outbox_payloads WHERE id = email_outbox.payloadId),
    bodyText = (SELECT bodyText FROM email_outbox_payloads WHERE id = email_outbox.payloadId),
    bodyHtml = (SELECT bodyHtml FROM email_outbox_payloads WHERE id = email_outbox.payloadId),
    metadataJson = (SELECT metadataJson FROM email_outbox_payloads WHERE id = email_outbox.payloadId),
    updatedAt = updatedAt
WHERE id IN (
  SELECT outbox.id
  FROM email_outbox outbox
  INNER JOIN email_outbox_payloads payload ON payload.id = outbox.payloadId
  WHERE outbox.subject = '' AND outbox.bodyText = ''
    AND outbox.bodyHtml IS NULL AND outbox.metadataJson IS NULL
  ORDER BY outbox.id
  LIMIT 500
);
