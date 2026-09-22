CREATE TABLE IF NOT EXISTS email_bulk_delivery_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'automatic' CHECK (mode IN ('automatic', 'manual_paused')),
  isPaused INTEGER NOT NULL DEFAULT 0 CHECK (isPaused IN (0, 1)),
  reason TEXT,
  pausedAt TEXT,
  healthySince TEXT,
  lastEvaluatedAt TEXT,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedByAdminId INTEGER
);

CREATE TABLE IF NOT EXISTS email_bulk_delivery_control_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (action IN (
    'automatic_paused',
    'automatic_recovery_started',
    'automatic_recovery_cancelled',
    'automatic_resumed',
    'manual_paused',
    'manual_resumed'
  )),
  reason TEXT,
  adminId INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_bulk_control_events_created
  ON email_bulk_delivery_control_events(createdAt DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_email_bulk_control_audit
AFTER UPDATE OF mode, isPaused, healthySince ON email_bulk_delivery_control
FOR EACH ROW
BEGIN
  INSERT INTO email_bulk_delivery_control_events (action, reason, adminId, createdAt)
  SELECT
    CASE
      WHEN NEW.mode = 'manual_paused' AND OLD.mode <> 'manual_paused' THEN 'manual_paused'
      WHEN OLD.mode = 'manual_paused' AND NEW.mode = 'automatic' THEN 'manual_resumed'
      WHEN NEW.mode = 'automatic' AND NEW.isPaused = 1 AND OLD.isPaused = 0 THEN 'automatic_paused'
      WHEN NEW.mode = 'automatic' AND NEW.isPaused = 1
        AND OLD.healthySince IS NULL AND NEW.healthySince IS NOT NULL THEN 'automatic_recovery_started'
      WHEN NEW.mode = 'automatic' AND NEW.isPaused = 1
        AND OLD.healthySince IS NOT NULL AND NEW.healthySince IS NULL THEN 'automatic_recovery_cancelled'
      WHEN NEW.mode = 'automatic' AND NEW.isPaused = 0 AND OLD.isPaused = 1 THEN 'automatic_resumed'
      ELSE NULL
    END,
    NEW.reason,
    NEW.updatedByAdminId,
    NEW.updatedAt
  WHERE
    NEW.mode <> OLD.mode
    OR NEW.isPaused <> OLD.isPaused
    OR COALESCE(NEW.healthySince, '') <> COALESCE(OLD.healthySince, '');
END;

INSERT OR IGNORE INTO email_bulk_delivery_control (
  id, mode, isPaused, reason, pausedAt, healthySince, lastEvaluatedAt, updatedAt, updatedByAdminId
) VALUES (1, 'automatic', 0, NULL, NULL, NULL, NULL, datetime('now'), NULL);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '120_email_bulk_delivery_control.sql',
  'codex_local_release',
  'Adds an auditable automatic/manual bulk-email pause controller with recovery hysteresis.'
);
