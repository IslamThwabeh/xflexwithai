-- Durable, admin-authenticated business-owner decisions for the Live Package.
CREATE TABLE IF NOT EXISTS live_package_owner_review (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_package_owner_answers (
  question_id TEXT PRIMARY KEY,
  answer_text TEXT NOT NULL DEFAULT '' CHECK (length(answer_text) <= 5000),
  updated_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every saved revision is retained. Application code only inserts into this table.
CREATE TABLE IF NOT EXISTS live_package_owner_answer_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  answer_text TEXT NOT NULL CHECK (length(answer_text) <= 5000),
  -- Kept as historical attribution rather than an FK: deleting an admin must
  -- never rewrite an append-only decision record.
  updated_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_package_owner_answer_history_question
  ON live_package_owner_answer_history(question_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS prevent_live_package_owner_history_update
BEFORE UPDATE ON live_package_owner_answer_history
BEGIN SELECT RAISE(ABORT, 'Live Package owner answer history is append-only'); END;

CREATE TRIGGER IF NOT EXISTS prevent_live_package_owner_history_delete
BEFORE DELETE ON live_package_owner_answer_history
BEGIN SELECT RAISE(ABORT, 'Live Package owner answer history is append-only'); END;

INSERT INTO live_package_owner_review (id, status) VALUES (1, 'draft')
ON CONFLICT(id) DO NOTHING;
