-- Dedicated Live expert conversations. General support data is untouched.
CREATE TABLE IF NOT EXISTS live_expert_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  expert_user_id INTEGER REFERENCES users(id),
  grace_days INTEGER NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 90),
  availability_en TEXT NOT NULL DEFAULT 'Leave your question here. Your expert will reply when available.',
  availability_ar TEXT NOT NULL DEFAULT 'اترك سؤالك هنا، وسيرد خبيرك عند توفره.'
);
INSERT OR IGNORE INTO live_expert_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS live_expert_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  entitlement_id INTEGER NOT NULL REFERENCES live_package_entitlements(id),
  cohort_key TEXT NOT NULL,
  expert_user_id INTEGER NOT NULL REFERENCES users(id),
  last_client_message_id INTEGER NOT NULL DEFAULT 0,
  last_expert_message_id INTEGER NOT NULL DEFAULT 0,
  client_read_id INTEGER NOT NULL DEFAULT 0,
  expert_read_id INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT NOT NULL,
  UNIQUE(user_id, cohort_key)
);
CREATE INDEX IF NOT EXISTS idx_live_expert_inbox ON live_expert_conversations(expert_user_id, last_message_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS live_expert_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES live_expert_conversations(id),
  sender_id INTEGER NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client','expert','admin')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) <= 5000),
  client_nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(conversation_id, client_nonce)
);
CREATE INDEX IF NOT EXISTS idx_live_expert_messages_thread ON live_expert_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS live_expert_attachments (
  id TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES live_expert_conversations(id),
  uploader_id INTEGER NOT NULL,
  message_id INTEGER UNIQUE REFERENCES live_expert_messages(id),
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png','image/jpeg','image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_live_expert_attachments_thread ON live_expert_attachments(conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_live_expert_attachments_pending ON live_expert_attachments(created_at, id) WHERE message_id IS NULL;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('130_live_expert_messaging.sql', 'codex', 'Separate private client/cohort expert threads, read cursors, private screenshot metadata and admin settings.');
