-- Cover recommendation root ordering and child/result lookups with one index.
--
-- This migration is additive, idempotent, and non-unique. The parent/type
-- prefix supports both root rows (parentId IS NULL) and child rows, while the
-- trailing creation/id columns support deterministic root ordering.

CREATE INDEX IF NOT EXISTS idx_recommendation_messages_parent_type_created_id
  ON recommendationMessages(parentId, type, createdAt DESC, id DESC);
