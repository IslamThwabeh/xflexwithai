-- Add upgrade tracking columns to registrationKeys
ALTER TABLE registrationKeys ADD COLUMN isUpgrade INTEGER DEFAULT 0;
ALTER TABLE registrationKeys ADD COLUMN referredBy TEXT;
