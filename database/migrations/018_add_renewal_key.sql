-- Add isRenewal flag to registrationKeys
-- Renewal keys extend existing subscriptions rather than starting fresh
ALTER TABLE registrationKeys ADD COLUMN isRenewal INTEGER DEFAULT 0;
