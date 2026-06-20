-- Support inbox pagination, latest-message lookup, and unread-count hot paths.

CREATE INDEX IF NOT EXISTS idx_support_conversations_updated_id
  ON supportConversations(updatedAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status_updated_id
  ON supportConversations(status, updatedAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_created_id
  ON supportMessages(conversationId, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_unread_client
  ON supportMessages(conversationId, senderType, isRead)
  WHERE senderType = 'client' AND isRead = 0;
