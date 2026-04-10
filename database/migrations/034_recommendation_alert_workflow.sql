ALTER TABLE users ADD COLUMN lastInteractiveAt TEXT;

CREATE TABLE recommendationAlerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analystUserId INTEGER NOT NULL,
  note TEXT,
  notifiedAt TEXT NOT NULL,
  unlockAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cancelledAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommendation_alerts_pending
  ON recommendationAlerts (analystUserId, status, expiresAt);