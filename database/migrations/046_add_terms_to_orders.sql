-- Add auditable terms acceptance fields to orders table
ALTER TABLE orders ADD COLUMN termsAcceptedAt TEXT;
ALTER TABLE orders ADD COLUMN termsAcceptedVersion TEXT;
