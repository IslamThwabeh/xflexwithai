-- Migration 074: Community access controls and ban audit trail.
-- Safe/additive only. Missing access rows mean "allowed", so every existing and
-- future client/support account is included automatically without a bulk copy.

CREATE TABLE IF NOT EXISTS student_community_access_controls (
  user_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'banned'
    CHECK (status IN ('allowed', 'banned')),
  reason TEXT,
  banned_by_user_id INTEGER,
  banned_at TEXT,
  expires_at TEXT,
  restored_by_user_id INTEGER,
  restored_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_community_access_status
  ON student_community_access_controls (status, expires_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS student_community_access_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ban', 'restore')),
  reason TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_community_access_audit_user
  ON student_community_access_audit_logs (user_id, created_at DESC, id DESC);
