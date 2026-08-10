-- Reconcile production indexes for the highest-volume D1 read paths.
--
-- This migration is deliberately additive and idempotent. It does not alter,
-- deduplicate, or delete production data. Episode progress indexes remain
-- non-unique because historical production rows can contain duplicates.

CREATE INDEX IF NOT EXISTS idx_support_conversations_updated_id
  ON supportConversations(updatedAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status_updated_id
  ON supportConversations(status, updatedAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_created_id
  ON supportMessages(conversationId, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_unread_client
  ON supportMessages(conversationId, senderType, isRead)
  WHERE senderType = 'client' AND isRead = 0;

CREATE INDEX IF NOT EXISTS idx_episode_progress_user_course_watched
  ON episodeProgress(userId, courseId, lastWatchedAt);

CREATE INDEX IF NOT EXISTS idx_episode_progress_user_episode
  ON episodeProgress(userId, episodeId);
