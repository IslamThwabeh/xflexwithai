# Live Package Phase 2 D1 reconciliation

Production received the Live Package Phase 2 schema changes under earlier launch-hardening filenames:

- `097_live_package_phase_2.sql`
- `098_live_package_multipart_upload_tracking.sql`

The repository release filenames are:

- `099_live_package_phase_2.sql`
- `100_live_package_multipart_upload_tracking.sql`

Before deployment reconciliation, verify production schema effects with read-only `PRAGMA table_info` / `PRAGMA index_list` checks and capture a fresh D1 Time Travel bookmark. If the earlier schema effects are present, apply `103_live_package_phase_2_ledger_aliases.sql` only. That migration inserts `099` and `100` rows into `schema_migrations` with `source='codex_reconciliation'` and does not update orders, order items, keys, entitlements, sessions, recordings, uploads, users, or admin settings.

Do not rerun `099` or `100` directly against production when their equivalent earlier migrations are already present.
