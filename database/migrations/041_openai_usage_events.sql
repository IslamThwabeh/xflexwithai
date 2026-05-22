CREATE TABLE IF NOT EXISTS openai_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  telegram_user_id TEXT,
  customer_id TEXT,
  endpoint TEXT,
  feature_name TEXT,
  flow_type TEXT,
  flow_id TEXT,
  action_type TEXT,
  model TEXT,
  request_mode TEXT,
  image_detail TEXT,
  timeframe TEXT,
  currency_pair TEXT,
  request_id TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd REAL,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_openai_usage_events_created_at
  ON openai_usage_events(created_at);

CREATE INDEX IF NOT EXISTS idx_openai_usage_events_user_id
  ON openai_usage_events(user_id);

CREATE INDEX IF NOT EXISTS idx_openai_usage_events_feature_name
  ON openai_usage_events(feature_name);

CREATE INDEX IF NOT EXISTS idx_openai_usage_events_action_type
  ON openai_usage_events(action_type);