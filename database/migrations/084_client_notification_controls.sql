-- Additive, category-scoped controls for non-transactional client notifications.
-- Existing clients remain enabled until an authorized operator explicitly acts.
CREATE TABLE IF NOT EXISTS client_notification_controls (
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('recommendations')),
  is_disabled INTEGER NOT NULL DEFAULT 0 CHECK (is_disabled IN (0, 1)),
  reason TEXT,
  updated_by_type TEXT NOT NULL CHECK (updated_by_type IN ('admin', 'support')),
  updated_by_id INTEGER NOT NULL,
  disabled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, category),
  CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 5 AND 1000),
  CHECK (
    (is_disabled = 0 AND disabled_at IS NULL)
    OR (is_disabled = 1 AND disabled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_client_notification_controls_category_disabled
  ON client_notification_controls(category, is_disabled);

CREATE TABLE IF NOT EXISTS client_notification_control_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('recommendations')),
  action TEXT NOT NULL CHECK (action IN ('disabled', 'enabled')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'support')),
  actor_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_notification_audit_user_category_created
  ON client_notification_control_audit(user_id, category, created_at DESC, id DESC);
