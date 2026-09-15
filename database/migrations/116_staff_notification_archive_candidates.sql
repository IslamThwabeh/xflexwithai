-- Separate archive-candidate index so its creation can occur on a different UTC
-- day from migration 115 and preserve the D1 write-limit safety reserve.

CREATE INDEX IF NOT EXISTS idx_staff_notif_archive_candidates
  ON staff_notifications(eventType, archivedAt, createdAt, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '116_staff_notification_archive_candidates.sql',
  'codex_local_release',
  'Adds the bounded archive-candidate index without archiving or deleting notification rows.'
);
