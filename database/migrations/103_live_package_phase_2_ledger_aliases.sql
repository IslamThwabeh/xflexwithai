-- Live Package Phase 2 migration-ledger reconciliation.
-- Production received the schema effects under earlier file numbers during launch hardening:
--   097_live_package_phase_2.sql
--   098_live_package_multipart_upload_tracking.sql
-- This migration adds the repository-visible aliases only. It does not change business data.

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '099_live_package_phase_2.sql',
  'codex_reconciliation',
  'Equivalent schema already applied as 097_live_package_phase_2.sql; verified before aliasing.'
);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '100_live_package_multipart_upload_tracking.sql',
  'codex_reconciliation',
  'Equivalent schema already applied as 098_live_package_multipart_upload_tracking.sql; verified before aliasing.'
);
