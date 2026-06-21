-- Timed-service policy activation audit fields and persistent generic email outbox.
-- Additive only: this migration does not rewrite existing subscription state.

ALTER TABLE lexaiSubscriptions ADD COLUMN activationReason TEXT;
ALTER TABLE lexaiSubscriptions ADD COLUMN activationProcessedAt TEXT;
ALTER TABLE lexaiSubscriptions ADD COLUMN courseWaivedByPolicy INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lexaiSubscriptions ADD COLUMN brokerWaivedByPolicy INTEGER NOT NULL DEFAULT 0;

ALTER TABLE recommendationSubscriptions ADD COLUMN activationReason TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN activationProcessedAt TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN courseWaivedByPolicy INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recommendationSubscriptions ADD COLUMN brokerWaivedByPolicy INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lexai_pending_activation_deadline
  ON lexaiSubscriptions(isPendingActivation, isActive, maxActivationDate);

CREATE INDEX IF NOT EXISTS idx_recommendation_pending_activation_deadline
  ON recommendationSubscriptions(isPendingActivation, isActive, maxActivationDate);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupeKey TEXT NOT NULL UNIQUE,
  batchId TEXT,
  recipientUserId INTEGER,
  recipientEmail TEXT NOT NULL,
  eventType TEXT NOT NULL,
  templateId TEXT,
  emailCategory TEXT,
  subject TEXT NOT NULL,
  bodyText TEXT NOT NULL,
  bodyHtml TEXT,
  metadataJson TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  nextAttemptAt TEXT NOT NULL,
  lockedAt TEXT,
  provider TEXT,
  attemptedProviders TEXT,
  errorCategory TEXT,
  errorMessage TEXT,
  sentAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_next_attempt
  ON email_outbox(status, nextAttemptAt);

CREATE INDEX IF NOT EXISTS idx_email_outbox_batch
  ON email_outbox(batchId);

CREATE TABLE IF NOT EXISTS email_outbox_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batchId TEXT NOT NULL UNIQUE,
  recipientsJson TEXT NOT NULL,
  cursor INTEGER NOT NULL DEFAULT 0,
  eventType TEXT NOT NULL,
  templateId TEXT,
  emailCategory TEXT,
  subject TEXT NOT NULL,
  bodyText TEXT NOT NULL,
  bodyHtml TEXT,
  metadataJson TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_campaign_status
  ON email_outbox_campaigns(status, createdAt);
