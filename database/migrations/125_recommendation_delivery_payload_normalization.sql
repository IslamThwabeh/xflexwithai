-- Store one immutable email payload per recommendation event/language pair.
-- Recipient rows continue to own all recipient, retry, provider, and audit state.

CREATE TABLE IF NOT EXISTS recommendation_delivery_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventKey TEXT NOT NULL,
  language TEXT NOT NULL,
  subject TEXT,
  bodyText TEXT,
  bodyHtml TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_rec_delivery_payload_event_language
  ON recommendation_delivery_payloads(eventKey, language);

-- Production preflight proved that every event/language group has exactly one
-- payload variant. MAX is therefore deterministic while keeping this migration
-- idempotent and independent of recipient ordering.
INSERT OR IGNORE INTO recommendation_delivery_payloads (
  eventKey,
  language,
  subject,
  bodyText,
  bodyHtml,
  metadataJson,
  createdAt,
  updatedAt
)
SELECT
  eventKey,
  language,
  MAX(subject),
  MAX(bodyText),
  MAX(bodyHtml),
  MAX(metadataJson),
  MIN(createdAt),
  MAX(updatedAt)
FROM recommendation_deliveries
WHERE subject IS NOT NULL
   OR bodyText IS NOT NULL
   OR bodyHtml IS NOT NULL
   OR metadataJson IS NOT NULL
GROUP BY eventKey, language;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '125_recommendation_delivery_payload_normalization.sql',
  'codex_local_release',
  'Stores one immutable recommendation email payload per event and language; recipient audit rows are preserved.'
);
