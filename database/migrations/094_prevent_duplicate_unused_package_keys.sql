-- Existing duplicates are preserved for manual review. These triggers prevent
-- any new active, unused package key from being assigned to the same customer,
-- package, and activation type.
CREATE TRIGGER IF NOT EXISTS prevent_duplicate_unused_package_key_insert
BEFORE INSERT ON registrationKeys
WHEN NEW.packageId IS NOT NULL
  AND NEW.email IS NOT NULL
  AND length(trim(NEW.email)) > 0
  AND NEW.isActive = 1
  AND NEW.activatedAt IS NULL
  AND EXISTS (
    SELECT 1 FROM registrationKeys existing
    WHERE existing.packageId = NEW.packageId
      AND lower(trim(existing.email)) = lower(trim(NEW.email))
      AND existing.isActive = 1
      AND existing.activatedAt IS NULL
      AND coalesce(existing.isUpgrade, 0) = coalesce(NEW.isUpgrade, 0)
      AND coalesce(existing.isRenewal, 0) = coalesce(NEW.isRenewal, 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'duplicate active unused package key');
END;

CREATE TRIGGER IF NOT EXISTS prevent_duplicate_unused_package_key_update
BEFORE UPDATE OF packageId, email, isActive, activatedAt, isUpgrade, isRenewal ON registrationKeys
WHEN NEW.packageId IS NOT NULL
  AND NEW.email IS NOT NULL
  AND length(trim(NEW.email)) > 0
  AND NEW.isActive = 1
  AND NEW.activatedAt IS NULL
  AND EXISTS (
    SELECT 1 FROM registrationKeys existing
    WHERE existing.id <> OLD.id
      AND existing.packageId = NEW.packageId
      AND lower(trim(existing.email)) = lower(trim(NEW.email))
      AND existing.isActive = 1
      AND existing.activatedAt IS NULL
      AND coalesce(existing.isUpgrade, 0) = coalesce(NEW.isUpgrade, 0)
      AND coalesce(existing.isRenewal, 0) = coalesce(NEW.isRenewal, 0)
  )
BEGIN
  SELECT RAISE(ABORT, 'duplicate active unused package key');
END;
