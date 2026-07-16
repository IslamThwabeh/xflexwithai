-- Migration 070: Make package activation order-linked, email-bound, and auditable.

ALTER TABLE registrationKeys ADD COLUMN orderId INTEGER;
ALTER TABLE registrationKeys ADD COLUMN issuanceType TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE registrationKeys ADD COLUMN assignedAt TEXT;
ALTER TABLE registrationKeys ADD COLUMN assignedByType TEXT;
ALTER TABLE registrationKeys ADD COLUMN assignedById INTEGER;

-- Preserve legitimate legacy email-bound keys while keeping every key that
-- has no customer email explicitly unassigned.
UPDATE registrationKeys
SET assignedAt = COALESCE(createdAt, datetime('now')),
    assignedByType = 'system'
WHERE email IS NOT NULL AND trim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_keys_order_package
  ON registrationKeys(orderId, packageId)
  WHERE orderId IS NOT NULL AND packageId IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registration_keys_assignment
  ON registrationKeys(email, activatedAt, isActive);

CREATE TABLE IF NOT EXISTS package_key_activation_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id INTEGER,
  user_id INTEGER,
  email TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT NOT NULL,
  notification_sent INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_key_activation_attempts_key_created
  ON package_key_activation_attempts(key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_key_activation_attempts_user_created
  ON package_key_activation_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  reason TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON order_status_history(order_id, created_at DESC);

-- Database-level guardrail: inventory/unassigned keys cannot be consumed even
-- if a future code path accidentally skips application validation.
CREATE TRIGGER IF NOT EXISTS package_key_activation_requires_assignment
BEFORE UPDATE OF activatedAt ON registrationKeys
FOR EACH ROW
WHEN OLD.activatedAt IS NULL AND NEW.activatedAt IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.email IS NULL OR trim(NEW.email) = ''
      OR NEW.assignedAt IS NULL OR trim(NEW.assignedAt) = ''
      THEN RAISE(ABORT, 'package_key_email_assignment_required')
  END;

  SELECT CASE
    WHEN NEW.issuanceType = 'bulk_inventory'
      THEN RAISE(ABORT, 'package_key_inventory_not_assigned')
  END;

  SELECT CASE
    WHEN NEW.orderId IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM orders
      WHERE id = NEW.orderId AND status = 'completed'
    ) THEN RAISE(ABORT, 'package_key_order_not_approved')
  END;
END;
