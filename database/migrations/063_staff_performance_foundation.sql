-- Phase 1A: additive backend foundation for staff performance management.
-- This migration does not alter existing staff monitoring data or enable the feature.

CREATE TABLE IF NOT EXISTS staff_performance_monthly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_user_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  expected_outcomes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'locked')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL,
  submitted_at TEXT,
  reviewed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  UNIQUE (staff_user_id, month),
  CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_monthly_plans_staff_month
  ON staff_performance_monthly_plans(staff_user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_monthly_plans_status
  ON staff_performance_monthly_plans(status, month DESC);

CREATE TABLE IF NOT EXISTS staff_performance_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  expected_result TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES staff_performance_monthly_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_goals_plan
  ON staff_performance_goals(plan_id, sort_order, id);

CREATE TABLE IF NOT EXISTS staff_performance_daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_user_id INTEGER NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Amman',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'locked')),
  end_summary TEXT,
  employee_notes TEXT,
  manager_feedback TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT,
  reviewed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  UNIQUE (staff_user_id, local_date),
  CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_daily_logs_staff_date
  ON staff_performance_daily_logs(staff_user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_daily_logs_status
  ON staff_performance_daily_logs(status, local_date DESC);

CREATE TABLE IF NOT EXISTS staff_performance_daily_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL,
  monthly_goal_id INTEGER,
  title TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  actual_output TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (daily_log_id) REFERENCES staff_performance_daily_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (monthly_goal_id) REFERENCES staff_performance_goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_daily_tasks_log
  ON staff_performance_daily_tasks(daily_log_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_daily_tasks_goal
  ON staff_performance_daily_tasks(monthly_goal_id);

CREATE TABLE IF NOT EXISTS staff_performance_weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Amman',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'locked')),
  outputs TEXT,
  achievement_percent INTEGER CHECK (achievement_percent BETWEEN 0 AND 100),
  complaints TEXT,
  suggestions TEXT,
  blockers TEXT,
  training_needs TEXT,
  tool_needs TEXT,
  manager_feedback TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT,
  reviewed_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  UNIQUE (staff_user_id, week_start),
  CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  CHECK (week_end GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_weekly_reports_staff_week
  ON staff_performance_weekly_reports(staff_user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_weekly_reports_status
  ON staff_performance_weekly_reports(status, week_start DESC);

CREATE TABLE IF NOT EXISTS staff_performance_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('monthly_plan', 'goal', 'daily_log', 'daily_task', 'weekly_report')),
  entity_id INTEGER NOT NULL,
  staff_user_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_performance_audit_entity
  ON staff_performance_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_performance_audit_staff
  ON staff_performance_audit_logs(staff_user_id, created_at DESC);

INSERT OR IGNORE INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('staff_performance_enabled', 'false', datetime('now'));
