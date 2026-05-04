-- Add interview invite tracking to job_applications
ALTER TABLE job_applications ADD COLUMN interview_invite_sent_at TEXT;
