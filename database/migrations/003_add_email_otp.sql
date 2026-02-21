-- Add email OTP table for passwordless sign-in

CREATE TABLE IF NOT EXISTS authEmailOtps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  codeHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  ipHash TEXT,
  userAgentHash TEXT,
  sentAtMs INTEGER NOT NULL,
  expiresAtMs INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_authEmailOtps_email_purpose_sent
  ON authEmailOtps(email, purpose, sentAtMs);

CREATE INDEX IF NOT EXISTS idx_authEmailOtps_expires
  ON authEmailOtps(expiresAtMs);
