-- Financial ledger source events must be idempotent. In particular, a retry of
-- an existing refund request must never create a second negative cash entry.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_source_event
  ON financial_ledger_entries(source_type, source_reference)
  WHERE source_reference IS NOT NULL;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '108_financial_ledger_source_idempotency.sql',
  'codex_wrangler',
  'Financial ledger source-event idempotency for refunds, expenses, and future corrections.'
);
