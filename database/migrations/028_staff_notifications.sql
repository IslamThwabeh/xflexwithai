-- ============================================================================
-- 028: Staff Notifications, Admin Settings, Staff Notification Preferences
-- ============================================================================

-- Staff/Admin notification inbox (separate from student user_notifications)
CREATE TABLE IF NOT EXISTS staff_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  eventType TEXT NOT NULL,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  contentEn TEXT,
  contentAr TEXT,
  actionUrl TEXT,
  metadata TEXT,
  isRead INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_notif_userId ON staff_notifications(userId);
CREATE INDEX IF NOT EXISTS idx_staff_notif_isRead ON staff_notifications(userId, isRead);
CREATE INDEX IF NOT EXISTS idx_staff_notif_eventType ON staff_notifications(eventType);
CREATE INDEX IF NOT EXISTS idx_staff_notif_actionUrl ON staff_notifications(userId, isRead, actionUrl);

-- Admin settings (key-value store for site-wide admin config)
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settingKey TEXT NOT NULL UNIQUE,
  settingValue TEXT,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default settings
INSERT OR IGNORE INTO admin_settings (settingKey, settingValue) VALUES
  ('notification_email', ''),
  ('email_alert_prefs', '{"new_support_message":true,"human_escalation":true,"new_order":true,"key_activated":true,"offer_agreement":true,"plan_progress_update":true,"broker_proof_submitted":true,"subscription_expiring":true,"course_completion":true,"student_inactivity":true}');

-- Per-staff email notification preferences (JSON toggles)
ALTER TABLE users ADD COLUMN staffNotificationPrefs TEXT DEFAULT '{}';
