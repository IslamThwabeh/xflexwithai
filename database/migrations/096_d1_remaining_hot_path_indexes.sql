-- Remove the remaining highest-cost D1 scans without changing application data.
--
-- Keep this migration additive, idempotent, and non-unique. The support
-- edit/delete/read indexes are partial so their one-time and ongoing write
-- cost stays proportional to actionable rows rather than message history.

CREATE INDEX IF NOT EXISTS idx_staff_notif_event_action_created
  ON staff_notifications(eventType, actionUrl, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_staff_notif_user_created
  ON staff_notifications(userId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_edited
  ON supportMessages(conversationId, editedAt)
  WHERE editedAt IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_deleted
  ON supportMessages(conversationId, deletedAt)
  WHERE deletedAt IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_unread_non_client
  ON supportMessages(conversationId, isRead)
  WHERE senderType <> 'client' AND isRead = 0;

CREATE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON enrollments(userId, courseId);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_reference_created
  ON points_transactions(user_id, reference_type, created_at);
