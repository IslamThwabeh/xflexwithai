-- Separate rollback index so emergency restoration remains bounded without
-- combining multiple full-table index builds in one UTC-day write budget.

CREATE INDEX IF NOT EXISTS idx_staff_notif_archive_batch
  ON staff_notifications(archiveBatchKey, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '117_staff_notification_archive_rollback.sql',
  'codex_local_release',
  'Adds the archive batch-key rollback index without archiving or deleting notification rows.'
);
