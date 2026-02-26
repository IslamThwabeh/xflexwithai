-- Add price and currency columns to registrationKeys table
ALTER TABLE registrationKeys ADD COLUMN price INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE registrationKeys ADD COLUMN currency TEXT DEFAULT 'USD' NOT NULL;
