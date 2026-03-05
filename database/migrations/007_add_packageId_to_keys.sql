-- Add packageId column to registrationKeys for package key consolidation
ALTER TABLE registrationKeys ADD COLUMN packageId INTEGER;
