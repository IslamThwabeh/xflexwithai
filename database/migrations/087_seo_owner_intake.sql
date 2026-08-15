-- Secure full-admin workspace for the organic-search business-owner intake.
-- Answers are stored one question per row so autosave never rewrites unrelated
-- fields, and submitting remains an explicit separate action.
CREATE TABLE IF NOT EXISTS seo_owner_intake (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seo_owner_intake_answers (
  question_id TEXT PRIMARY KEY,
  answer_text TEXT NOT NULL DEFAULT '' CHECK (length(answer_text) <= 5000),
  updated_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO seo_owner_intake (id, status, created_at, updated_at)
VALUES (1, 'draft', datetime('now'), datetime('now'))
ON CONFLICT(id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_seo_owner_intake_answers_updated
  ON seo_owner_intake_answers(updated_at DESC);
