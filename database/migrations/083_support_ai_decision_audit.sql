CREATE TABLE IF NOT EXISTS support_ai_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  user_id INTEGER,
  trigger_message_id INTEGER,
  bot_message_id INTEGER,
  action_type TEXT NOT NULL,
  decision_source TEXT NOT NULL,
  provider_request_id TEXT,
  model TEXT,
  intent TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  needs_human INTEGER NOT NULL CHECK (needs_human IN (0, 1)),
  escalation_reason TEXT NOT NULL,
  validation_outcome TEXT NOT NULL CHECK (validation_outcome IN ('valid', 'normalized')),
  validation_issue TEXT,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_ai_decisions_conversation_created
  ON support_ai_decisions(conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_ai_decisions_validation_created
  ON support_ai_decisions(validation_outcome, created_at DESC, id DESC);
