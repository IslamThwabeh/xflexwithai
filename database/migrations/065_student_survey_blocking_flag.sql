-- Phase 2D: separate, disabled-by-default enforcement switch for gradual survey blocking.
-- This keeps survey pilots independent from route blocking until explicitly approved.

INSERT OR IGNORE INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('student_surveys_blocking_enabled', 'false', datetime('now'));
