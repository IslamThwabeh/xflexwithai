-- Add narrow indexes for measured LexAI and course/episode read paths.
--
-- These are additive, idempotent, and non-unique. They support newest-first
-- LexAI history by user and stable episode ordering by course.

CREATE INDEX IF NOT EXISTS idx_lexai_messages_user_created_id
  ON lexaiMessages(userId, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_episodes_course_order_id
  ON episodes(courseId, "order", id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '125_lexai_course_hot_path_indexes.sql',
  'codex_local_release',
  'Adds D1 hot-path indexes for LexAI history and course episode ordering.'
);
