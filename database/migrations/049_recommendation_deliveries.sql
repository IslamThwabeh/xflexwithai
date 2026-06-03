-- Recommendation notification delivery outbox.
-- One row per intended recipient per event (alert or message). The unique
-- (eventKey, userId) index makes router retries idempotent and gives admin a
-- queryable per-recipient audit independent of email_delivery_logs.
CREATE TABLE IF NOT EXISTS recommendation_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventKey TEXT NOT NULL,                -- e.g. rec_alert_<id> | rec_msg_<id>
  eventKind TEXT NOT NULL,               -- 'alert' | 'recommendation' | 'update' | 'result'
  refId INTEGER NOT NULL,                -- recommendationAlerts.id or recommendationMessages.id
  threadRootMessageId INTEGER,           -- only for messages
  userId INTEGER NOT NULL,
  recipientEmail TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL,                  -- 'pending' | 'sent' | 'failed' | 'skipped' | 'dead_letter'
  skipReason TEXT,                       -- 'muted' | 'opted_out' | 'pending_activation' | 'paused' | 'staff' | ...
  provider TEXT,
  attemptedProviders TEXT,
  errorCategory TEXT,                    -- 'timeout' | '5xx' | '4xx' | 'network' | 'config' | 'unknown'
  errorMessage TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  subject TEXT,
  bodyText TEXT,
  bodyHtml TEXT,
  metadataJson TEXT,
  lastAttemptAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rec_deliveries_event_user
  ON recommendation_deliveries (eventKey, userId);
CREATE INDEX IF NOT EXISTS idx_rec_deliveries_status
  ON recommendation_deliveries (status, createdAt);
CREATE INDEX IF NOT EXISTS idx_rec_deliveries_ref
  ON recommendation_deliveries (eventKind, refId);
CREATE INDEX IF NOT EXISTS idx_rec_deliveries_user
  ON recommendation_deliveries (userId, createdAt);

-- Snapshot of the eligibility funnel at send time, attached directly to the
-- alert / message row so admin can render diagnostics for past sends without
-- replaying state.
ALTER TABLE recommendationAlerts ADD COLUMN deliveryDiagnosticsJson TEXT;
ALTER TABLE recommendationMessages ADD COLUMN deliveryDiagnosticsJson TEXT;
