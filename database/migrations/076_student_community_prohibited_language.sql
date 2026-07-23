-- Migration 076: Add deterministic prohibited-language policy terms.
-- Existing competitor terms and moderation decisions are preserved.
-- The community feature flag is not changed.

BEGIN TRANSACTION;

ALTER TABLE student_community_policy_terms
  RENAME TO student_community_policy_terms_075;

ALTER TABLE student_community_moderation_decisions
  RENAME TO student_community_moderation_decisions_075;

DROP INDEX IF EXISTS idx_student_community_policy_terms_active;
DROP INDEX IF EXISTS idx_student_community_moderation_created;
DROP INDEX IF EXISTS idx_student_community_moderation_user;
DROP INDEX IF EXISTS idx_student_community_moderation_outcome;

CREATE TABLE student_community_policy_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'competitor'
    CHECK (category IN ('competitor', 'prohibited_language')),
  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category, normalized_term)
);

INSERT INTO student_community_policy_terms (
  id,
  term,
  normalized_term,
  category,
  is_active,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  id,
  term,
  normalized_term,
  category,
  is_active,
  created_by_user_id,
  created_at,
  updated_at
FROM student_community_policy_terms_075;

CREATE TABLE student_community_moderation_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('post', 'comment')),
  entity_id INTEGER,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('allowed', 'blocked_policy', 'blocked_openai', 'error')),
  reason_code TEXT NOT NULL
    CHECK (reason_code IN (
      'approved',
      'competitor_reference',
      'prohibited_language',
      'openai_flagged',
      'openai_unavailable'
    )),
  model TEXT,
  request_id TEXT,
  flagged_categories TEXT,
  category_scores TEXT,
  matched_policy_term_id INTEGER,
  content_hash TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO student_community_moderation_decisions (
  id,
  user_id,
  content_type,
  entity_id,
  outcome,
  reason_code,
  model,
  request_id,
  flagged_categories,
  category_scores,
  matched_policy_term_id,
  content_hash,
  duration_ms,
  created_at
)
SELECT
  id,
  user_id,
  content_type,
  entity_id,
  outcome,
  reason_code,
  model,
  request_id,
  flagged_categories,
  category_scores,
  matched_policy_term_id,
  content_hash,
  duration_ms,
  created_at
FROM student_community_moderation_decisions_075;

DROP TABLE student_community_moderation_decisions_075;
DROP TABLE student_community_policy_terms_075;

CREATE INDEX idx_student_community_policy_terms_active
  ON student_community_policy_terms (category, is_active, normalized_term);

CREATE INDEX idx_student_community_moderation_created
  ON student_community_moderation_decisions (created_at DESC, id DESC);

CREATE INDEX idx_student_community_moderation_user
  ON student_community_moderation_decisions (user_id, created_at DESC);

CREATE INDEX idx_student_community_moderation_outcome
  ON student_community_moderation_decisions (outcome, created_at DESC);

COMMIT;
