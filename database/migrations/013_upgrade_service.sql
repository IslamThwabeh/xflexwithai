-- Migration: Add upgrade service support
-- Adds upgradePrice to packages and upgradeFromPackageId to orders/packageSubscriptions

ALTER TABLE packages ADD COLUMN upgradePrice INTEGER DEFAULT 0;
-- upgradePrice in cents: the price to upgrade FROM a lower-tier package TO this one
-- e.g. Comprehensive.upgradePrice = 30000 (= $300 to upgrade from Basic)

ALTER TABLE orders ADD COLUMN isUpgrade INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN upgradeFromPackageId INTEGER;

ALTER TABLE packageSubscriptions ADD COLUMN upgradedFromPackageId INTEGER;
ALTER TABLE packageSubscriptions ADD COLUMN upgradedAt TEXT;
