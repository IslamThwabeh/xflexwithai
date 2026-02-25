-- Recommendations feature: analyst role, subscriptions, group messages, reactions

ALTER TABLE users ADD COLUMN canPublishRecommendations INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS recommendationSubscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  registrationKeyId INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1,
  startDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  endDate TEXT NOT NULL,
  paymentStatus TEXT NOT NULL DEFAULT 'key',
  paymentAmount INTEGER NOT NULL DEFAULT 100,
  paymentCurrency TEXT NOT NULL DEFAULT 'USD',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendationMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'recommendation',
  content TEXT NOT NULL,
  symbol TEXT,
  side TEXT,
  entryPrice TEXT,
  stopLoss TEXT,
  takeProfit1 TEXT,
  takeProfit2 TEXT,
  riskPercent TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendationReactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  reaction TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(messageId, userId)
);

CREATE INDEX IF NOT EXISTS idx_recommendationSubscriptions_userId ON recommendationSubscriptions(userId);
CREATE INDEX IF NOT EXISTS idx_recommendationSubscriptions_endDate ON recommendationSubscriptions(endDate);
CREATE INDEX IF NOT EXISTS idx_recommendationMessages_createdAt ON recommendationMessages(createdAt);
CREATE INDEX IF NOT EXISTS idx_recommendationReactions_messageId ON recommendationReactions(messageId);
