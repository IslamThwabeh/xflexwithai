-- Migration 022: Add isAdminSkipped to enrollments + admin_actions audit table
-- Purpose: Fix LexAI/Rec timing bug + make skip course rollback-able

-- 1. Add isAdminSkipped flag to enrollments (preserves real progress on skip)
ALTER TABLE enrollments ADD COLUMN isAdminSkipped INTEGER DEFAULT 0;

-- 2. Create admin_actions audit table for tracking admin operations
CREATE TABLE IF NOT EXISTS admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adminId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_userId ON admin_actions(userId);
CREATE INDEX IF NOT EXISTS idx_admin_actions_adminId ON admin_actions(adminId);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions(action);
