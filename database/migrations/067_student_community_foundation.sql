-- Migration 067: Student community and moderation foundation
-- Safe/additive only. The feature flag is disabled by default.

CREATE TABLE IF NOT EXISTS student_community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted')),
  pinned_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_community_posts_status_created
  ON student_community_posts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_community_posts_user
  ON student_community_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_community_comments_post_status
  ON student_community_comments (post_id, status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_student_community_comments_user
  ON student_community_comments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_community_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id INTEGER NOT NULL,
  reporter_user_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by_user_id INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (target_type, target_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_community_reports_status_created
  ON student_community_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS student_community_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'comment', 'report')),
  entity_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_community_audit_entity
  ON student_community_audit_logs (entity_type, entity_id, created_at DESC);

INSERT INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('student_community_enabled', 'false', datetime('now'))
ON CONFLICT(settingKey) DO NOTHING;
