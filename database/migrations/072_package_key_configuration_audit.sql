-- Migration 072: Let key managers configure order-linked keys while keeping
-- activated credentials immutable and every configuration change auditable.

ALTER TABLE registrationKeys ADD COLUMN configurationNotes TEXT;
ALTER TABLE registrationKeys ADD COLUMN configurationUpdatedAt TEXT;
ALTER TABLE registrationKeys ADD COLUMN configurationUpdatedByType TEXT;
ALTER TABLE registrationKeys ADD COLUMN configurationUpdatedById INTEGER;

CREATE TABLE IF NOT EXISTS package_key_configuration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id INTEGER NOT NULL,
  order_id INTEGER,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  previous_entitlement_days INTEGER,
  new_entitlement_days INTEGER,
  previous_expires_at TEXT,
  new_expires_at TEXT,
  previous_configuration_notes TEXT,
  new_configuration_notes TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_package_key_configuration_history_key_created
  ON package_key_configuration_history(key_id, created_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_no_update
BEFORE UPDATE ON package_key_configuration_history
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'package_key_configuration_history_append_only');
END;

CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_no_delete
BEFORE DELETE ON package_key_configuration_history
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'package_key_configuration_history_append_only');
END;

-- The application writes the editor identity together with the configuration.
-- The insert/update triggers below capture meaningful configuration changes.
CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_update
AFTER UPDATE OF entitlementDays, expiresAt, configurationNotes ON registrationKeys
FOR EACH ROW
WHEN OLD.packageId IS NOT NULL
  AND (
    OLD.entitlementDays IS NOT NEW.entitlementDays
    OR OLD.expiresAt IS NOT NEW.expiresAt
    OR OLD.configurationNotes IS NOT NEW.configurationNotes
  )
BEGIN
  INSERT INTO package_key_configuration_history (
    key_id,
    order_id,
    actor_type,
    actor_id,
    previous_entitlement_days,
    new_entitlement_days,
    previous_expires_at,
    new_expires_at,
    previous_configuration_notes,
    new_configuration_notes,
    reason,
    created_at
  ) VALUES (
    NEW.id,
    NEW.orderId,
    COALESCE(NULLIF(trim(NEW.configurationUpdatedByType), ''), 'system'),
    COALESCE(NEW.configurationUpdatedById, 0),
    OLD.entitlementDays,
    NEW.entitlementDays,
    OLD.expiresAt,
    NEW.expiresAt,
    OLD.configurationNotes,
    NEW.configurationNotes,
    'configuration_updated',
    COALESCE(NEW.configurationUpdatedAt, datetime('now'))
  );
END;

CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_insert
AFTER INSERT ON registrationKeys
FOR EACH ROW
WHEN NEW.packageId IS NOT NULL
  AND (
    NEW.entitlementDays IS NOT NULL
    OR NEW.expiresAt IS NOT NULL
    OR NEW.configurationNotes IS NOT NULL
  )
BEGIN
  INSERT INTO package_key_configuration_history (
    key_id,
    order_id,
    actor_type,
    actor_id,
    new_entitlement_days,
    new_expires_at,
    new_configuration_notes,
    reason,
    created_at
  ) VALUES (
    NEW.id,
    NEW.orderId,
    COALESCE(NULLIF(trim(NEW.configurationUpdatedByType), ''), COALESCE(NULLIF(trim(NEW.assignedByType), ''), 'system')),
    COALESCE(NEW.configurationUpdatedById, NEW.assignedById, NEW.createdBy, 0),
    NEW.entitlementDays,
    NEW.expiresAt,
    NEW.configurationNotes,
    CASE WHEN NEW.orderId IS NOT NULL THEN 'order_key_issued' ELSE 'key_created' END,
    COALESCE(NEW.configurationUpdatedAt, NEW.createdAt, datetime('now'))
  );
END;

-- Defense in depth: changing an activated key would rewrite the commercial
-- entitlement that was already consumed, so reject it even if a future API
-- path forgets the application-level check.
CREATE TRIGGER IF NOT EXISTS package_key_configuration_activated_immutable
BEFORE UPDATE OF entitlementDays, expiresAt, configurationNotes ON registrationKeys
FOR EACH ROW
WHEN OLD.activatedAt IS NOT NULL
  AND (
    OLD.entitlementDays IS NOT NEW.entitlementDays
    OR OLD.expiresAt IS NOT NEW.expiresAt
    OR OLD.configurationNotes IS NOT NEW.configurationNotes
  )
BEGIN
  SELECT RAISE(ABORT, 'activated_package_key_configuration_immutable');
END;
