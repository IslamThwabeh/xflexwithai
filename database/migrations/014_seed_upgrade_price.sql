-- Set the upgrade price for the Comprehensive package
-- $300 = 30000 cents (one-time upgrade fee from Basic)
UPDATE packages SET upgradePrice = 30000 WHERE slug = 'comprehensive';
