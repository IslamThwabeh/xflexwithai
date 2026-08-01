-- Migration 078: preserve signed request-context actor ids for admin feature writes.
--
-- Users/staff have positive context ids and full admins have negative context ids
-- (admin id 1 is actor id -1). Subject/owner columns still reference users(id),
-- while creator/reviewer/audit actor columns deliberately do not.
--
-- D1 keeps foreign-key enforcement enabled for migrations. Rebuilding the full
-- dependent graph avoids ALTER TABLE RENAME rewriting child references and
-- avoids ON DELETE actions changing retained rows. D1 runs this file in an
-- implicit transaction; defer checks only while canonical table names move.

PRAGMA defer_foreign_keys = ON;

-- Rebuilding AUTOINCREMENT tables must not lower their historical high-water
-- marks, otherwise a deleted entity id could later be reused and collide with
-- retained audit history.
CREATE TABLE admin_feature_actor_sequences_078 (
  table_name TEXT PRIMARY KEY,
  sequence_value INTEGER NOT NULL
);

INSERT INTO admin_feature_actor_sequences_078 (table_name, sequence_value)
SELECT name, seq
FROM sqlite_sequence
WHERE name IN (
  'staff_performance_monthly_plans',
  'staff_performance_goals',
  'staff_performance_daily_tasks',
  'staff_performance_audit_logs',
  'student_surveys',
  'student_survey_questions',
  'student_survey_assignments',
  'student_survey_answers',
  'student_survey_audit_logs',
  'student_job_eligibility_rules',
  'student_job_eligibility_reviews',
  'student_job_eligibility_audit_logs'
);

-- ---------------------------------------------------------------------------
-- Staff performance: plans and goals contain actors; daily tasks are rebuilt
-- with them solely to retain their monthly_goal_id foreign-key relationships.
-- ---------------------------------------------------------------------------

CREATE TABLE staff_performance_monthly_plans_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_user_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  expected_outcomes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'locked')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL,
  submitted_at TEXT,
  reviewed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  UNIQUE (staff_user_id, month),
  CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
);

CREATE TABLE staff_performance_goals_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  expected_result TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES staff_performance_monthly_plans_078(id) ON DELETE CASCADE
);

CREATE TABLE staff_performance_daily_tasks_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL,
  monthly_goal_id INTEGER,
  title TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  actual_output TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (daily_log_id) REFERENCES staff_performance_daily_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (monthly_goal_id) REFERENCES staff_performance_goals_078(id) ON DELETE SET NULL
);

CREATE TABLE staff_performance_audit_logs_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('monthly_plan', 'goal', 'daily_log', 'daily_task', 'weekly_report')),
  entity_id INTEGER NOT NULL,
  staff_user_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id)
);

INSERT INTO staff_performance_monthly_plans_078 (
  id, staff_user_id, month, title, summary, expected_outcomes, status, version,
  created_by_user_id, submitted_at, reviewed_at, locked_at, created_at, updated_at
)
SELECT
  id, staff_user_id, month, title, summary, expected_outcomes, status, version,
  created_by_user_id, submitted_at, reviewed_at, locked_at, created_at, updated_at
FROM staff_performance_monthly_plans;

INSERT INTO staff_performance_goals_078 (
  id, plan_id, title, description, expected_result, weight, sort_order,
  created_by_user_id, created_at, updated_at
)
SELECT
  id, plan_id, title, description, expected_result, weight, sort_order,
  created_by_user_id, created_at, updated_at
FROM staff_performance_goals;

INSERT INTO staff_performance_daily_tasks_078 (
  id, daily_log_id, monthly_goal_id, title, expected_output, actual_output,
  completed, notes, sort_order, created_at, updated_at
)
SELECT
  id, daily_log_id, monthly_goal_id, title, expected_output, actual_output,
  completed, notes, sort_order, created_at, updated_at
FROM staff_performance_daily_tasks;

INSERT INTO staff_performance_audit_logs_078 (
  id, entity_type, entity_id, staff_user_id, actor_user_id, action,
  from_status, to_status, details, created_at
)
SELECT
  id, entity_type, entity_id, staff_user_id, actor_user_id, action,
  from_status, to_status, details, created_at
FROM staff_performance_audit_logs;

DROP TABLE staff_performance_daily_tasks;
DROP TABLE staff_performance_goals;
DROP TABLE staff_performance_monthly_plans;
DROP TABLE staff_performance_audit_logs;

ALTER TABLE staff_performance_monthly_plans_078 RENAME TO staff_performance_monthly_plans;
ALTER TABLE staff_performance_goals_078 RENAME TO staff_performance_goals;
ALTER TABLE staff_performance_daily_tasks_078 RENAME TO staff_performance_daily_tasks;
ALTER TABLE staff_performance_audit_logs_078 RENAME TO staff_performance_audit_logs;

CREATE INDEX idx_staff_performance_monthly_plans_staff_month
  ON staff_performance_monthly_plans(staff_user_id, month DESC);
CREATE INDEX idx_staff_performance_monthly_plans_status
  ON staff_performance_monthly_plans(status, month DESC);
CREATE INDEX idx_staff_performance_goals_plan
  ON staff_performance_goals(plan_id, sort_order, id);
CREATE INDEX idx_staff_performance_daily_tasks_log
  ON staff_performance_daily_tasks(daily_log_id, sort_order, id);
CREATE INDEX idx_staff_performance_daily_tasks_goal
  ON staff_performance_daily_tasks(monthly_goal_id);
CREATE INDEX idx_staff_performance_audit_entity
  ON staff_performance_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_staff_performance_audit_staff
  ON staff_performance_audit_logs(staff_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Student surveys: rebuild the complete survey dependency graph so questions,
-- assignments, answers, and audit history retain their exact relationships.
-- ---------------------------------------------------------------------------

CREATE TABLE student_surveys_078 (
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE student_survey_questions_078 (
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
  FOREIGN KEY (survey_id) REFERENCES student_surveys_078(id) ON DELETE CASCADE
);

CREATE TABLE student_survey_assignments_078 (
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
  FOREIGN KEY (survey_id) REFERENCES student_surveys_078(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (survey_id, user_id),
  CHECK (due_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T*'),
  CHECK (block_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T*')
);

CREATE TABLE student_survey_answers_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  answer_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assignment_id) REFERENCES student_survey_assignments_078(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES student_survey_questions_078(id) ON DELETE CASCADE,
  UNIQUE (assignment_id, question_id)
);

CREATE TABLE student_survey_audit_logs_078 (
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
  FOREIGN KEY (survey_id) REFERENCES student_surveys_078(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO student_surveys_078 (
  id, code, title, description, is_active, is_required, max_postponements,
  postpone_hours, block_after_hours, created_by_user_id, created_at, updated_at
)
SELECT
  id, code, title, description, is_active, is_required, max_postponements,
  postpone_hours, block_after_hours, created_by_user_id, created_at, updated_at
FROM student_surveys;

INSERT INTO student_survey_questions_078 (
  id, survey_id, question_text, question_type, is_required, options_json,
  sort_order, created_at, updated_at
)
SELECT
  id, survey_id, question_text, question_type, is_required, options_json,
  sort_order, created_at, updated_at
FROM student_survey_questions;

INSERT INTO student_survey_assignments_078 (
  id, survey_id, user_id, status, due_at, block_at, postponements_used,
  last_postponed_at, submitted_at, created_by_user_id, created_at, updated_at
)
SELECT
  id, survey_id, user_id, status, due_at, block_at, postponements_used,
  last_postponed_at, submitted_at, created_by_user_id, created_at, updated_at
FROM student_survey_assignments;

INSERT INTO student_survey_answers_078 (
  id, assignment_id, question_id, answer_text, answer_json, created_at, updated_at
)
SELECT
  id, assignment_id, question_id, answer_text, answer_json, created_at, updated_at
FROM student_survey_answers;

INSERT INTO student_survey_audit_logs_078 (
  id, entity_type, entity_id, survey_id, user_id, actor_user_id, action,
  from_status, to_status, details, created_at
)
SELECT
  id, entity_type, entity_id, survey_id, user_id, actor_user_id, action,
  from_status, to_status, details, created_at
FROM student_survey_audit_logs;

DROP TABLE student_survey_answers;
DROP TABLE student_survey_audit_logs;
DROP TABLE student_survey_assignments;
DROP TABLE student_survey_questions;
DROP TABLE student_surveys;

ALTER TABLE student_surveys_078 RENAME TO student_surveys;
ALTER TABLE student_survey_questions_078 RENAME TO student_survey_questions;
ALTER TABLE student_survey_assignments_078 RENAME TO student_survey_assignments;
ALTER TABLE student_survey_answers_078 RENAME TO student_survey_answers;
ALTER TABLE student_survey_audit_logs_078 RENAME TO student_survey_audit_logs;

CREATE INDEX idx_student_surveys_active
  ON student_surveys(is_active, id DESC);
CREATE INDEX idx_student_survey_questions_survey
  ON student_survey_questions(survey_id, sort_order, id);
CREATE INDEX idx_student_survey_assignments_user_status
  ON student_survey_assignments(user_id, status, due_at);
CREATE INDEX idx_student_survey_assignments_blocking
  ON student_survey_assignments(status, block_at);
CREATE INDEX idx_student_survey_answers_assignment
  ON student_survey_answers(assignment_id, question_id);
CREATE INDEX idx_student_survey_audit_entity
  ON student_survey_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_student_survey_audit_user
  ON student_survey_audit_logs(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Job eligibility: subject user/job relationships remain strict; only the
-- signed creator/reviewer/audit actor relationships become polymorphic.
-- ---------------------------------------------------------------------------

CREATE TABLE student_job_eligibility_rules_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
  min_completed_episodes INTEGER NOT NULL DEFAULT 0,
  min_passed_quizzes INTEGER NOT NULL DEFAULT 0,
  min_points_balance INTEGER NOT NULL DEFAULT 0,
  require_active_subscription INTEGER NOT NULL DEFAULT 1,
  require_profile INTEGER NOT NULL DEFAULT 1,
  require_admin_review INTEGER NOT NULL DEFAULT 1,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  instructions TEXT,
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_job_eligibility_reviews_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'submitted',
  system_eligible INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  student_note TEXT,
  admin_note TEXT,
  reviewed_by_user_id INTEGER,
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id),
  CHECK (status IN ('submitted', 'returned', 'eligible', 'ineligible'))
);

CREATE TABLE student_job_eligibility_audit_logs_078 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO student_job_eligibility_rules_078 (
  id, job_id, min_completed_episodes, min_passed_quizzes, min_points_balance,
  require_active_subscription, require_profile, require_admin_review, is_enabled,
  instructions, created_by_user_id, updated_by_user_id, updated_at, created_at
)
SELECT
  id, job_id, min_completed_episodes, min_passed_quizzes, min_points_balance,
  require_active_subscription, require_profile, require_admin_review, is_enabled,
  instructions, created_by_user_id, updated_by_user_id, updated_at, created_at
FROM student_job_eligibility_rules;

INSERT INTO student_job_eligibility_reviews_078 (
  id, user_id, job_id, status, system_eligible, score, snapshot_json,
  student_note, admin_note, reviewed_by_user_id, reviewed_at, submitted_at,
  updated_at, created_at
)
SELECT
  id, user_id, job_id, status, system_eligible, score, snapshot_json,
  student_note, admin_note, reviewed_by_user_id, reviewed_at, submitted_at,
  updated_at, created_at
FROM student_job_eligibility_reviews;

INSERT INTO student_job_eligibility_audit_logs_078 (
  id, user_id, job_id, actor_user_id, action, from_status, to_status, details, created_at
)
SELECT
  id, user_id, job_id, actor_user_id, action, from_status, to_status, details, created_at
FROM student_job_eligibility_audit_logs;

DROP TABLE student_job_eligibility_rules;
DROP TABLE student_job_eligibility_reviews;
DROP TABLE student_job_eligibility_audit_logs;

ALTER TABLE student_job_eligibility_rules_078 RENAME TO student_job_eligibility_rules;
ALTER TABLE student_job_eligibility_reviews_078 RENAME TO student_job_eligibility_reviews;
ALTER TABLE student_job_eligibility_audit_logs_078 RENAME TO student_job_eligibility_audit_logs;

CREATE INDEX idx_student_job_rules_job
  ON student_job_eligibility_rules(job_id);
CREATE INDEX idx_student_job_reviews_user
  ON student_job_eligibility_reviews(user_id);
CREATE INDEX idx_student_job_reviews_job_status
  ON student_job_eligibility_reviews(job_id, status);
CREATE INDEX idx_student_job_audit_user_job
  ON student_job_eligibility_audit_logs(user_id, job_id, created_at);

UPDATE sqlite_sequence
SET seq = MAX(
  seq,
  COALESCE((
    SELECT saved.sequence_value
    FROM admin_feature_actor_sequences_078 AS saved
    WHERE saved.table_name = sqlite_sequence.name
  ), seq)
)
WHERE name IN (SELECT table_name FROM admin_feature_actor_sequences_078);

INSERT INTO sqlite_sequence (name, seq)
SELECT saved.table_name, saved.sequence_value
FROM admin_feature_actor_sequences_078 AS saved
WHERE NOT EXISTS (
  SELECT 1
  FROM sqlite_sequence AS current
  WHERE current.name = saved.table_name
);

DROP TABLE admin_feature_actor_sequences_078;

PRAGMA defer_foreign_keys = OFF;
