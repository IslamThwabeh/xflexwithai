-- Migration 029: Add email tracking to user_notifications
-- Adds batch_id to group notifications from same send action
-- Adds email_sent to track per-recipient email delivery

ALTER TABLE user_notifications ADD COLUMN batch_id TEXT;
ALTER TABLE user_notifications ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0;
