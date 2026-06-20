-- Reliable staff sessions, work schedules, and retained daily aggregates.

ALTER TABLE staffSessions ADD COLUMN sessionKey TEXT;
ALTER TABLE staffSessions ADD COLUMN endedAt INTEGER;
ALTER TABLE staffSessions ADD COLUMN lastInteractionAt INTEGER;
ALTER TABLE staffSessions ADD COLUMN hardExpiresAt INTEGER;
ALTER TABLE staffSessions ADD COLUMN endReason TEXT;

UPDATE staffSessions
SET
  endedAt = logoutAt,
  lastInteractionAt = COALESCE(logoutAt, loginAt),
  hardExpiresAt = loginAt + 86400,
  endReason = CASE WHEN logoutAt IS NOT NULL THEN 'logout' ELSE NULL END
WHERE endedAt IS NULL OR lastInteractionAt IS NULL OR hardExpiresAt IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_sessions_session_key
  ON staffSessions(sessionKey)
  WHERE sessionKey IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_sessions_interaction
  ON staffSessions(staffUserId, lastInteractionAt DESC);

CREATE TABLE IF NOT EXISTS staffWorkSchedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staffUserId INTEGER NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Amman',
  workDays TEXT NOT NULL DEFAULT '[0,1,2,3,4]',
  startTime TEXT NOT NULL DEFAULT '09:00',
  endTime TEXT NOT NULL DEFAULT '17:00',
  graceMinutes INTEGER NOT NULL DEFAULT 15,
  enabled INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (staffUserId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS staffDailyAggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  localDate TEXT NOT NULL,
  timezone TEXT NOT NULL,
  actionCount INTEGER NOT NULL DEFAULT 0,
  sessionCount INTEGER NOT NULL DEFAULT 0,
  activeSeconds INTEGER NOT NULL DEFAULT 0,
  timeoutCount INTEGER NOT NULL DEFAULT 0,
  exceptionCount INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(localDate, timezone)
);

CREATE INDEX IF NOT EXISTS idx_staff_daily_aggregates_date
  ON staffDailyAggregates(localDate DESC);
