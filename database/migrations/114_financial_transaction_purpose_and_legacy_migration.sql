-- Corrective financial release: explicit transaction purpose, paid renewal
-- orders, and zero-impact legacy-customer migration. Existing rows remain NULL
-- and are never silently classified or rewritten by this migration.

ALTER TABLE orders ADD COLUMN transactionPurpose TEXT;
ALTER TABLE orderItems ADD COLUMN transactionPurpose TEXT;
ALTER TABLE order_payment_confirmations ADD COLUMN transaction_purpose TEXT;
ALTER TABLE financial_ledger_entries ADD COLUMN transaction_purpose TEXT;
ALTER TABLE registrationKeys ADD COLUMN transactionPurpose TEXT;
ALTER TABLE registrationKeys ADD COLUMN legacyMigrationId INTEGER;

CREATE TRIGGER IF NOT EXISTS orders_transaction_purpose_valid_insert
BEFORE INSERT ON orders FOR EACH ROW
WHEN NEW.transactionPurpose IS NULL OR NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_required'); END;

CREATE TRIGGER IF NOT EXISTS orders_transaction_purpose_set_once
BEFORE UPDATE OF transactionPurpose ON orders FOR EACH ROW
WHEN OLD.transactionPurpose IS NOT NULL OR NEW.transactionPurpose IS NULL
  OR NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_immutable'); END;

CREATE TRIGGER IF NOT EXISTS order_items_transaction_purpose_matches_insert
BEFORE INSERT ON orderItems FOR EACH ROW
WHEN NEW.transactionPurpose IS NULL OR NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.id=NEW.orderId AND o.transactionPurpose=NEW.transactionPurpose
)
BEGIN SELECT RAISE(ABORT, 'order_item_transaction_purpose_mismatch'); END;

CREATE TRIGGER IF NOT EXISTS order_items_transaction_purpose_immutable
BEFORE UPDATE OF transactionPurpose ON orderItems FOR EACH ROW
WHEN OLD.transactionPurpose IS NOT NULL AND OLD.transactionPurpose IS NOT NEW.transactionPurpose
BEGIN SELECT RAISE(ABORT, 'order_item_transaction_purpose_immutable'); END;

CREATE TRIGGER IF NOT EXISTS payment_confirmation_transaction_purpose_guard
BEFORE INSERT ON order_payment_confirmations FOR EACH ROW
WHEN NEW.transaction_purpose IS NULL
  OR NEW.transaction_purpose NOT IN ('new_sale','renewal','upgrade')
  OR NEW.source_type <> 'order_payment_' || NEW.transaction_purpose
  OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.transactionPurpose=NEW.transaction_purpose)
BEGIN SELECT RAISE(ABORT, 'payment_confirmation_transaction_purpose_mismatch'); END;

CREATE TRIGGER IF NOT EXISTS payment_ledger_transaction_purpose_guard
BEFORE INSERT ON financial_ledger_entries FOR EACH ROW
WHEN NEW.entry_type='payment' AND (
  NEW.transaction_purpose IS NULL
  OR NEW.transaction_purpose NOT IN ('new_sale','renewal','upgrade')
  OR NEW.source_type <> 'order_payment_' || NEW.transaction_purpose
  OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.transactionPurpose=NEW.transaction_purpose)
)
BEGIN SELECT RAISE(ABORT, 'payment_ledger_transaction_purpose_mismatch'); END;

CREATE TRIGGER IF NOT EXISTS registration_keys_transaction_purpose_valid_insert
BEFORE INSERT ON registrationKeys FOR EACH ROW
WHEN NEW.transactionPurpose IS NOT NULL AND NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'registration_key_transaction_purpose_invalid'); END;

CREATE TRIGGER IF NOT EXISTS registration_keys_transaction_purpose_immutable
BEFORE UPDATE OF transactionPurpose ON registrationKeys FOR EACH ROW
WHEN OLD.transactionPurpose IS NOT NULL AND OLD.transactionPurpose IS NOT NEW.transactionPurpose
BEGIN SELECT RAISE(ABORT, 'registration_key_transaction_purpose_immutable'); END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_open_renewal_per_user
  ON orders(userId, transactionPurpose)
  WHERE transactionPurpose='renewal' AND status IN ('pending','awaiting_confirmation','paid');
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_keys_renewal_order
  ON registrationKeys(orderId)
  WHERE transactionPurpose='renewal' AND orderId IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_keys_legacy_migration
  ON registrationKeys(legacyMigrationId)
  WHERE legacyMigrationId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_purpose_created
  ON orders(transactionPurpose, createdAt, id);

CREATE TABLE IF NOT EXISTS order_renewal_details (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  entitlement_days INTEGER NOT NULL CHECK (entitlement_days BETWEEN 1 AND 3650),
  amount_ils_minor INTEGER NOT NULL CHECK (amount_ils_minor > 0),
  recommendations_current_end_at TEXT,
  lexai_current_end_at TEXT,
  recommendations_projected_end_at TEXT,
  lexai_projected_end_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
);
CREATE TRIGGER IF NOT EXISTS order_renewal_details_no_update BEFORE UPDATE ON order_renewal_details
BEGIN SELECT RAISE(ABORT, 'order_renewal_details_immutable'); END;
CREATE TRIGGER IF NOT EXISTS order_renewal_details_no_delete BEFORE DELETE ON order_renewal_details
BEGIN SELECT RAISE(ABORT, 'order_renewal_details_immutable'); END;

CREATE TABLE IF NOT EXISTS order_transaction_purpose_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  previous_purpose TEXT,
  next_purpose TEXT NOT NULL CHECK(next_purpose IN ('new_sale','renewal','upgrade','legacy_migration')),
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin','staff','system')),
  actor_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_transaction_purpose_events_order_created
  ON order_transaction_purpose_events(order_id, created_at, id);
CREATE TRIGGER IF NOT EXISTS order_transaction_purpose_events_no_update BEFORE UPDATE ON order_transaction_purpose_events
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_event_append_only'); END;
CREATE TRIGGER IF NOT EXISTS order_transaction_purpose_events_no_delete BEFORE DELETE ON order_transaction_purpose_events
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_event_append_only'); END;

CREATE TABLE IF NOT EXISTS legacy_customer_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','rejected')),
  user_id INTEGER NOT NULL,
  package_id INTEGER NOT NULL,
  original_purchase_date TEXT,
  old_reference TEXT,
  old_receipt_metadata TEXT,
  original_amount_minor INTEGER,
  original_currency TEXT,
  timed_services_end_at TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  transaction_purpose TEXT NOT NULL DEFAULT 'legacy_migration' CHECK(transaction_purpose='legacy_migration'),
  financial_impact TEXT NOT NULL DEFAULT 'none' CHECK(financial_impact='none'),
  created_by_type TEXT NOT NULL CHECK(created_by_type IN ('admin','staff')),
  created_by_id INTEGER NOT NULL,
  submitted_by_type TEXT,
  submitted_by_id INTEGER,
  submitted_at TEXT,
  reviewed_by_admin_id INTEGER,
  reviewed_at TEXT,
  review_reason TEXT,
  migrated_at TEXT,
  migrated_by_admin_id INTEGER,
  migration_key_id INTEGER UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_legacy_customer_migrations_status_updated
  ON legacy_customer_migrations(status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_customer_migrations_creator_status_updated
  ON legacy_customer_migrations(created_by_type, created_by_id, status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_customer_migrations_user_package
  ON legacy_customer_migrations(user_id, package_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_customer_migrations_open_user_package
  ON legacy_customer_migrations(user_id, package_id)
  WHERE status IN ('draft','pending_approval','approved');
CREATE TRIGGER IF NOT EXISTS legacy_customer_migrations_no_delete BEFORE DELETE ON legacy_customer_migrations
BEGIN SELECT RAISE(ABORT, 'legacy_customer_migration_no_hard_delete'); END;
CREATE TRIGGER IF NOT EXISTS legacy_customer_migrations_approved_immutable BEFORE UPDATE ON legacy_customer_migrations
FOR EACH ROW WHEN OLD.status IN ('approved','rejected')
BEGIN SELECT RAISE(ABORT, 'legacy_customer_migration_terminal_immutable'); END;

CREATE TABLE IF NOT EXISTS legacy_customer_migration_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin','staff')),
  actor_id INTEGER NOT NULL,
  reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_legacy_customer_migration_events_migration_created
  ON legacy_customer_migration_events(migration_id, created_at, id);
CREATE TRIGGER IF NOT EXISTS legacy_customer_migration_events_no_update BEFORE UPDATE ON legacy_customer_migration_events
BEGIN SELECT RAISE(ABORT, 'legacy_customer_migration_event_append_only'); END;
CREATE TRIGGER IF NOT EXISTS legacy_customer_migration_events_no_delete BEFORE DELETE ON legacy_customer_migration_events
BEGIN SELECT RAISE(ABORT, 'legacy_customer_migration_event_append_only'); END;

CREATE TRIGGER IF NOT EXISTS legacy_migration_key_guard BEFORE INSERT ON registrationKeys
FOR EACH ROW WHEN NEW.transactionPurpose='legacy_migration' AND (
  NEW.legacyMigrationId IS NULL OR NEW.orderId IS NOT NULL OR NEW.price<>0
  OR UPPER(NEW.currency)<>'ILS' OR NEW.issuancePurpose<>'migration'
)
BEGIN SELECT RAISE(ABORT, 'legacy_migration_key_must_be_zero_impact'); END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('114_financial_transaction_purpose_and_legacy_migration.sql','codex_local_release',
  'Explicit immutable transaction purpose, order-backed paid renewal, and owner-approved zero-impact legacy migration.');
