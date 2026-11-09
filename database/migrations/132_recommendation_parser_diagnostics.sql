-- Activate separately at deployment time for <=48 hours.
CREATE TABLE IF NOT EXISTS recommendation_parser_capture (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  CHECK (julianday(ends_at) > julianday(starts_at)),
  CHECK (julianday(ends_at) - julianday(starts_at) <= 2)
);
CREATE TABLE IF NOT EXISTS recommendation_parser_diagnostics (
  id TEXT PRIMARY KEY,
  actor_user_id INTEGER NOT NULL,
  parser_version TEXT NOT NULL,
  draft TEXT NOT NULL CHECK (length(draft) <= 4000),
  rule_fields_json TEXT NOT NULL,
  ai_fields_json TEXT,
  final_fields_json TEXT NOT NULL,
  parser_json TEXT NOT NULL,
  ai_outcome TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  submitted_fields_json TEXT,
  submitted_content TEXT,
  message_id INTEGER,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parser_diagnostics_expiry ON recommendation_parser_diagnostics(expires_at);
CREATE INDEX IF NOT EXISTS idx_parser_diagnostics_created ON recommendation_parser_diagnostics(created_at DESC);
INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('132_recommendation_parser_diagnostics.sql', 'codex_release', 'Restricted, expiring recommendation parser diagnostics.');
