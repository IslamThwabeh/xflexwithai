-- ============================================================================
-- 030: LexAI support cases and internal notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS lexai_support_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assignedToUserId INTEGER,
  assignedByUserId INTEGER,
  lastMessageAt TEXT,
  lastReviewedAt TEXT,
  resolvedAt TEXT,
  resolvedByUserId INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lexai_cases_status ON lexai_support_cases(status);
CREATE INDEX IF NOT EXISTS idx_lexai_cases_assigned_to ON lexai_support_cases(assignedToUserId, status);
CREATE INDEX IF NOT EXISTS idx_lexai_cases_updated_at ON lexai_support_cases(updatedAt);
CREATE INDEX IF NOT EXISTS idx_lexai_cases_last_message ON lexai_support_cases(lastMessageAt);

CREATE TABLE IF NOT EXISTS lexai_support_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caseId INTEGER NOT NULL,
  authorUserId INTEGER NOT NULL,
  noteType TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lexai_notes_case_id ON lexai_support_notes(caseId, createdAt);

INSERT OR IGNORE INTO lexai_support_cases (userId, status, priority, lastMessageAt, createdAt, updatedAt)
SELECT
  lm.userId,
  'open',
  'normal',
  MAX(lm.createdAt),
  MIN(lm.createdAt),
  datetime('now')
FROM lexaiMessages lm
GROUP BY lm.userId;