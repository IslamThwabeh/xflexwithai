-- Reversible staff-notification archiving foundation. This migration adds
-- lifecycle metadata and query indexes only; it does not archive or delete rows.

ALTER TABLE staff_notifications ADD COLUMN archivedAt TEXT;
ALTER TABLE staff_notifications ADD COLUMN archiveReason TEXT;
ALTER TABLE staff_notifications ADD COLUMN archiveBatchKey TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_notif_active_badges
  ON staff_notifications(userId, isRead, archivedAt, actionUrl);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '115_staff_notification_archiving.sql',
  'codex_local_release',
  'Adds reversible staff-notification archive metadata and the active-badge index without changing existing rows.'
);
