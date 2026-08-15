-- Phase 1: opt-in scheduling metadata for assignment and continuous reminders.
-- Existing assignments deliberately remain NULL and will not receive catch-up
-- messages until a separately reviewed campaign is approved.
ALTER TABLE student_survey_assignments
  ADD COLUMN notification_schedule_started_at TEXT;
ALTER TABLE student_survey_assignments
  ADD COLUMN next_notification_at TEXT;
ALTER TABLE student_survey_assignments
  ADD COLUMN last_notification_at TEXT;
ALTER TABLE student_survey_assignments
  ADD COLUMN last_notification_stage TEXT
    CHECK (last_notification_stage IS NULL OR last_notification_stage IN ('assigned', 'pre_due', 'due', 'overdue', 'manual'));
ALTER TABLE student_survey_assignments
  ADD COLUMN notification_count INTEGER NOT NULL DEFAULT 0 CHECK (notification_count >= 0);

CREATE INDEX IF NOT EXISTS idx_student_survey_assignments_notification_due
  ON student_survey_assignments(next_notification_at, status)
  WHERE notification_schedule_started_at IS NOT NULL;
