-- Lightweight deployment visibility for production schema changes.
-- This table is intentionally independent from Wrangler internals so manual
-- D1 fixes can be recorded with a name, source, and notes.
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations(applied_at DESC);
