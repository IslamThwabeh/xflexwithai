-- Live Package Phase 2: session management, notification scheduling, and resumable recording uploads.
-- Additive only; no existing Live orders, entitlements, sessions, recordings, or settings are modified.

ALTER TABLE live_package_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'educational';
ALTER TABLE live_package_sessions ADD COLUMN recurrence_key TEXT;
ALTER TABLE live_package_sessions ADD COLUMN cancelled_at TEXT;

ALTER TABLE live_package_recordings ADD COLUMN upload_status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE live_package_recordings ADD COLUMN replaced_by_recording_id INTEGER;

CREATE TABLE IF NOT EXISTS live_package_session_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  cohort_key TEXT NOT NULL,
  actor_admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_package_notification_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  cohort_key TEXT NOT NULL,
  batch_id TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  materialized_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by_admin_id INTEGER NOT NULL,
  cancelled_by_admin_id INTEGER,
  cancelled_at TEXT,
  dispatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_package_recording_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_token TEXT NOT NULL UNIQUE,
  package_id INTEGER NOT NULL,
  cohort_key TEXT NOT NULL,
  session_id INTEGER,
  recording_id INTEGER,
  object_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  expected_size_bytes INTEGER NOT NULL,
  uploaded_size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated',
  expires_at TEXT NOT NULL,
  created_by_admin_id INTEGER NOT NULL,
  completed_at TEXT,
  aborted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_package_cohort_starts
  ON live_package_sessions(packageId, cohortKey, startsAt);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status_starts
  ON live_package_sessions(status, startsAt);
CREATE INDEX IF NOT EXISTS idx_live_recordings_package_cohort_publish
  ON live_package_recordings(packageId, cohortKey, isPublished, sortOrder);
CREATE INDEX IF NOT EXISTS idx_live_recordings_session
  ON live_package_recordings(sessionId);
CREATE INDEX IF NOT EXISTS idx_live_session_audit_session_created
  ON live_package_session_audit(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_notification_jobs_status_scheduled
  ON live_package_notification_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_live_notification_jobs_session
  ON live_package_notification_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_live_recording_uploads_status_expires
  ON live_package_recording_uploads(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_live_recording_uploads_token
  ON live_package_recording_uploads(upload_token);
