-- Migration 073: separate key issuance from activation authorization.
-- Existing keys retain legacy behavior. Newly issued commercial fresh/upgrade
-- keys can be prepared by an admin but require a completed matching order at
-- redemption; explicitly authorized internal/compensation keys do not.

ALTER TABLE registrationKeys ADD COLUMN issuancePurpose TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE registrationKeys ADD COLUMN activationPolicy TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE registrationKeys ADD COLUMN authorizationReason TEXT;
ALTER TABLE registrationKeys ADD COLUMN authorizedByType TEXT;
ALTER TABLE registrationKeys ADD COLUMN authorizedById INTEGER;
ALTER TABLE registrationKeys ADD COLUMN authorizedAt TEXT;

UPDATE registrationKeys
SET
  issuancePurpose = 'commercial',
  activationPolicy = 'order_required'
WHERE orderId IS NOT NULL OR issuanceType = 'order';

CREATE INDEX IF NOT EXISTS idx_registration_keys_pending_policy_email
  ON registrationKeys(activationPolicy, email, packageId, isActive, activatedAt, orderId);

CREATE TRIGGER IF NOT EXISTS registration_keys_authorization_immutable
BEFORE UPDATE OF issuancePurpose, activationPolicy, authorizationReason,
  authorizedByType, authorizedById, authorizedAt
ON registrationKeys
FOR EACH ROW
WHEN
  OLD.issuancePurpose IS NOT NEW.issuancePurpose
  OR OLD.activationPolicy IS NOT NEW.activationPolicy
  OR OLD.authorizationReason IS NOT NEW.authorizationReason
  OR OLD.authorizedByType IS NOT NEW.authorizedByType
  OR OLD.authorizedById IS NOT NEW.authorizedById
  OR OLD.authorizedAt IS NOT NEW.authorizedAt
BEGIN
  SELECT RAISE(ABORT, 'package_key_authorization_immutable');
END;
