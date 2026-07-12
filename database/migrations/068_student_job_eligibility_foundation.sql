-- Phase 5: Student eligibility for job opportunities
-- Additive-only migration. No existing jobs/applications data is modified.

CREATE TABLE IF NOT EXISTS student_job_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  headline TEXT,
  skills TEXT,
  experience_summary TEXT,
  portfolio_url TEXT,
  cv_url TEXT,
  preferred_role TEXT,
  availability TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_job_eligibility_rules (
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
  created_by_user_id INTEGER REFERENCES users(id),
  updated_by_user_id INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_job_eligibility_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'submitted',
  system_eligible INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  student_note TEXT,
  admin_note TEXT,
  reviewed_by_user_id INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id),
  CHECK (status IN ('submitted', 'returned', 'eligible', 'ineligible'))
);

CREATE TABLE IF NOT EXISTS student_job_eligibility_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_job_profiles_user
  ON student_job_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_student_job_rules_job
  ON student_job_eligibility_rules(job_id);

CREATE INDEX IF NOT EXISTS idx_student_job_reviews_user
  ON student_job_eligibility_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_student_job_reviews_job_status
  ON student_job_eligibility_reviews(job_id, status);

CREATE INDEX IF NOT EXISTS idx_student_job_audit_user_job
  ON student_job_eligibility_audit_logs(user_id, job_id, created_at);

INSERT INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('student_job_eligibility_enabled', 'false', datetime('now'))
ON CONFLICT(settingKey) DO NOTHING;
