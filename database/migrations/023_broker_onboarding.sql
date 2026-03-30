-- Migration 023: Broker Onboarding System
-- Purpose: Track student broker account opening journey (4 steps with proof upload & admin review)

-- 1. Main broker onboarding progress table (one row per step per user)
CREATE TABLE IF NOT EXISTS broker_onboarding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  brokerId INTEGER NOT NULL,
  step TEXT NOT NULL CHECK(step IN ('select_broker','open_account','verify_account','deposit')),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','pending_review','approved','rejected')),
  proofUrl TEXT,
  proofType TEXT,
  aiConfidence REAL,
  aiResult TEXT,
  adminNote TEXT,
  rejectionReason TEXT,
  submittedAt TEXT,
  reviewedAt TEXT,
  reviewedBy INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_broker_onboarding_userId ON broker_onboarding(userId);
CREATE INDEX IF NOT EXISTS idx_broker_onboarding_status ON broker_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_broker_onboarding_step ON broker_onboarding(step);
CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_onboarding_user_step ON broker_onboarding(userId, step);

-- 2. Add broker onboarding completion flag to users table (quick lookup)
ALTER TABLE users ADD COLUMN brokerOnboardingComplete INTEGER DEFAULT 0;

-- 3. Add YouTube video urls to brokers table for onboarding step videos
ALTER TABLE brokers ADD COLUMN videoOpenAccount TEXT;
ALTER TABLE brokers ADD COLUMN videoVerify TEXT;
ALTER TABLE brokers ADD COLUMN videoDeposit TEXT;
