ALTER TABLE registrationKeys ADD COLUMN entitlementDays INTEGER;

ALTER TABLE lexaiSubscriptions ADD COLUMN isPaused INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE lexaiSubscriptions ADD COLUMN pausedAt TEXT;
ALTER TABLE lexaiSubscriptions ADD COLUMN pausedReason TEXT;
ALTER TABLE lexaiSubscriptions ADD COLUMN pausedRemainingDays INTEGER;

ALTER TABLE recommendationSubscriptions ADD COLUMN isPaused INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE recommendationSubscriptions ADD COLUMN pausedAt TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN pausedReason TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN pausedRemainingDays INTEGER;