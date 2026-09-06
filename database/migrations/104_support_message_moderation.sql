-- Immutable, content-free audit trail for support-chat message deletion.
CREATE TABLE IF NOT EXISTS support_message_deletion_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL UNIQUE,
  conversation_id INTEGER NOT NULL,
  original_sender_id INTEGER NOT NULL,
  original_sender_type TEXT NOT NULL,
  deleted_by_user_id INTEGER NOT NULL,
  deleted_by_admin_id INTEGER,
  actor_type TEXT NOT NULL,
  reason_category TEXT NOT NULL,
  reason_details TEXT,
  had_attachment INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_deletion_audit_conversation_created
  ON support_message_deletion_audit(conversation_id, created_at DESC);
