-- ============================================================================
-- 031: Staff monitoring tables for action trail + session tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS staffActionLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staffUserId INTEGER NOT NULL,
  actionType TEXT NOT NULL,
  resourceType TEXT,
  resourceId INTEGER,
  details TEXT,
  ipAddress TEXT,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (staffUserId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_action_logs_staff_created
  ON staffActionLogs(staffUserId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_staff_action_logs_action_created
  ON staffActionLogs(actionType, createdAt DESC);

CREATE TABLE IF NOT EXISTS staffSessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staffUserId INTEGER NOT NULL,
  loginAt INTEGER NOT NULL,
  logoutAt INTEGER,
  durationSeconds INTEGER,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (staffUserId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff_login
  ON staffSessions(staffUserId, loginAt DESC);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_active
  ON staffSessions(staffUserId, logoutAt);
