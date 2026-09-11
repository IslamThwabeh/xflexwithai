-- Phase 3: selective date-range access for approved management reporting.
-- The partial index excludes drafts and pending entries from report reads.

CREATE INDEX IF NOT EXISTS idx_financial_ledger_approved_effective_type
  ON financial_ledger_entries(effective_at, entry_type, id)
  WHERE status = 'approved';

-- The legacy activation screen is now operational-only and bounded. This
-- partial index prevents opening it from scanning every historical key.
CREATE INDEX IF NOT EXISTS idx_registration_keys_recent_activation
  ON registrationKeys(activatedAt DESC, id DESC)
  WHERE activatedAt IS NOT NULL AND packageId IS NOT NULL;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '111_financial_reporting_indexes.sql',
  'codex_local_release',
  'Partial indexes for bounded approved-ledger reporting and recent operational activation activity.'
);
