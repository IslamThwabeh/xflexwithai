-- Archive-history index is isolated from the other full-table index builds so
-- production can preserve one index build per UTC-day write budget.

CREATE INDEX IF NOT EXISTS idx_staff_notif_archive_history
  ON staff_notifications(userId, archivedAt DESC, id DESC);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '118_staff_notification_archive_history.sql',
  'codex_local_release',
  'Adds paginated staff-notification archive history access without changing existing rows.'
);
