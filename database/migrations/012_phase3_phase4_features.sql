-- Migration 012: Phase 3 + Phase 4 features
-- Phase 3: Support attachments, Global search support
-- Phase 4: Course reviews, Notifications, Loyalty points, Engagement tracking

-- ============================================================================
-- Support Attachments (Phase 3)
-- ============================================================================
ALTER TABLE supportMessages ADD COLUMN attachment_url TEXT;
ALTER TABLE supportMessages ADD COLUMN attachment_name TEXT;
ALTER TABLE supportMessages ADD COLUMN attachment_size INTEGER;

-- ============================================================================
-- Course Reviews / Star Ratings (Phase 4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS course_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

-- ============================================================================
-- User Notifications (Phase 4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  content_en TEXT,
  content_ar TEXT,
  action_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Loyalty Points (Phase 4)
-- ============================================================================
ALTER TABLE users ADD COLUMN points_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS points_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earn',
  reason_en TEXT,
  reason_ar TEXT,
  reference_id INTEGER,
  reference_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Engagement Tracking (Phase 4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
