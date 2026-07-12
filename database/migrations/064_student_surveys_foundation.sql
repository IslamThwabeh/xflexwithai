-- Phase 2A: additive backend foundation for student surveys, postponement, and gradual blocking.
-- This migration does not alter existing learning/access data or enable the feature.

CREATE TABLE IF NOT EXISTS student_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  max_postponements INTEGER NOT NULL DEFAULT 2 CHECK (max_postponements BETWEEN 0 AND 30),
  postpone_hours INTEGER NOT NULL DEFAULT 24 CHECK (postpone_hours BETWEEN 1 AND 720),
  block_after_hours INTEGER NOT NULL DEFAULT 72 CHECK (block_after_hours BETWEEN 1 AND 2160),
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_surveys_active
  ON student_surveys(is_active, id DESC);

CREATE TABLE IF NOT EXISTS student_survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'rating')),
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  options_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES student_surveys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_survey_questions_survey
  ON student_survey_questions(survey_id, sort_order, id);

CREATE TABLE IF NOT EXISTS student_survey_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'postponed', 'submitted', 'blocked')),
  due_at TEXT NOT NULL,
  block_at TEXT NOT NULL,
  postponements_used INTEGER NOT NULL DEFAULT 0 CHECK (postponements_used >= 0),
  last_postponed_at TEXT,
  submitted_at TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES student_surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  UNIQUE (survey_id, user_id),
  CHECK (due_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T*'),
  CHECK (block_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T*')
);

CREATE INDEX IF NOT EXISTS idx_student_survey_assignments_user_status
  ON student_survey_assignments(user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_student_survey_assignments_blocking
  ON student_survey_assignments(status, block_at);

CREATE TABLE IF NOT EXISTS student_survey_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  answer_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assignment_id) REFERENCES student_survey_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES student_survey_questions(id) ON DELETE CASCADE,
  UNIQUE (assignment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_survey_answers_assignment
  ON student_survey_answers(assignment_id, question_id);

CREATE TABLE IF NOT EXISTS student_survey_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('survey', 'question', 'assignment', 'answer')),
  entity_id INTEGER NOT NULL,
  survey_id INTEGER,
  user_id INTEGER,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES student_surveys(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_survey_audit_entity
  ON student_survey_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_survey_audit_user
  ON student_survey_audit_logs(user_id, created_at DESC);

INSERT OR IGNORE INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('student_surveys_enabled', 'false', datetime('now'));
