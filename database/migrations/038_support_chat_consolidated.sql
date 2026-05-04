-- Migration 038: Support chat consolidated thread + AI re-enable timer
-- 1. Track when needsHuman was set so we can auto-resume AI after a configurable delay
ALTER TABLE supportConversations ADD COLUMN needsHumanAt TEXT;

-- 2. Seed the admin-configurable AI auto-resume delay (default 30 minutes)
INSERT OR IGNORE INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('support_ai_resume_minutes', '30', datetime('now'));
