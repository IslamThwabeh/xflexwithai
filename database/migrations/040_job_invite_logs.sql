CREATE TABLE IF NOT EXISTS job_invite_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  application_id INTEGER,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  send_type TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  template_key TEXT NOT NULL DEFAULT 'jobs_interview_invite_v1',
  sent_by_admin_id INTEGER,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_invite_logs_sent_at ON job_invite_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_invite_logs_job_id ON job_invite_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_invite_logs_application_id ON job_invite_logs (application_id);
CREATE INDEX IF NOT EXISTS idx_job_invite_logs_recipient_email ON job_invite_logs (recipient_email);
