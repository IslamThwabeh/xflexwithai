-- Supports bounded correction-picker ordering without sorting all approved history.
CREATE INDEX IF NOT EXISTS idx_financial_controls_entry_page
ON financial_ledger_entries(effective_at DESC,id DESC)
WHERE status='approved' AND entry_type<>'reversal';
INSERT OR IGNORE INTO schema_migrations(migration_name,source,notes)
VALUES('141_financial_control_entry_pages.sql','codex_local_release','Ordered correction picker; no financial-record changes.');
