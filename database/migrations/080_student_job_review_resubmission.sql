-- Add a distinct resubmitted state while preserving every existing review.
-- SQLite cannot alter CHECK constraints in place, so rebuild only this child
-- table and recreate its indexes.
CREATE TABLE student_job_eligibility_reviews_080 (
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
  CHECK (status IN ('submitted', 'returned', 'resubmitted', 'eligible', 'ineligible'))
);

INSERT INTO student_job_eligibility_reviews_080 (
  id, user_id, job_id, status, system_eligible, score, snapshot_json,
  student_note, admin_note, reviewed_by_user_id, reviewed_at, submitted_at,
  updated_at, created_at
)
SELECT
  id, user_id, job_id, status, system_eligible, score, snapshot_json,
  student_note, admin_note, reviewed_by_user_id, reviewed_at, submitted_at,
  updated_at, created_at
FROM student_job_eligibility_reviews;

DROP TABLE student_job_eligibility_reviews;
ALTER TABLE student_job_eligibility_reviews_080 RENAME TO student_job_eligibility_reviews;

CREATE INDEX IF NOT EXISTS idx_student_job_reviews_user
  ON student_job_eligibility_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_student_job_reviews_job_status
  ON student_job_eligibility_reviews(job_id, status);
