-- Link only content-bearing recipient rows to their shared payload. Historical
-- recipients that intentionally have no stored content keep payloadId NULL.

ALTER TABLE recommendation_deliveries ADD COLUMN payloadId INTEGER;

UPDATE recommendation_deliveries
SET payloadId = (
  SELECT payload.id
  FROM recommendation_delivery_payloads payload
  WHERE payload.eventKey = recommendation_deliveries.eventKey
    AND payload.language = recommendation_deliveries.language
)
WHERE subject IS NOT NULL
   OR bodyText IS NOT NULL
   OR bodyHtml IS NOT NULL
   OR metadataJson IS NOT NULL;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '126_recommendation_delivery_payload_links.sql',
  'codex_local_release',
  'Links content-bearing recipient audit rows to shared payloads while preserving intentional null-payload rows.'
);
