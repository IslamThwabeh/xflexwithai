-- Private trade-copier service sale flow.
-- The website records purchase/payment/subscriber state only; external trade
-- account linking remains an operational step outside the platform.

DROP TRIGGER IF EXISTS orders_transaction_purpose_valid_insert;
DROP TRIGGER IF EXISTS orders_transaction_purpose_set_once;
DROP TRIGGER IF EXISTS payment_confirmation_transaction_purpose_guard;
DROP TRIGGER IF EXISTS payment_ledger_transaction_purpose_guard;
DROP TRIGGER IF EXISTS registration_keys_transaction_purpose_valid_insert;

CREATE TRIGGER IF NOT EXISTS orders_transaction_purpose_valid_insert
BEFORE INSERT ON orders FOR EACH ROW
WHEN NEW.transactionPurpose IS NULL OR NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','copier_subscription','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_required'); END;

CREATE TRIGGER IF NOT EXISTS orders_transaction_purpose_set_once
BEFORE UPDATE OF transactionPurpose ON orders FOR EACH ROW
WHEN OLD.transactionPurpose IS NOT NULL OR NEW.transactionPurpose IS NULL
  OR NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','copier_subscription','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'order_transaction_purpose_immutable'); END;

CREATE TRIGGER IF NOT EXISTS payment_confirmation_transaction_purpose_guard
BEFORE INSERT ON order_payment_confirmations FOR EACH ROW
WHEN NEW.transaction_purpose IS NULL
  OR NEW.transaction_purpose NOT IN ('new_sale','renewal','upgrade','copier_subscription')
  OR NEW.source_type <> 'order_payment_' || NEW.transaction_purpose
  OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.transactionPurpose=NEW.transaction_purpose)
BEGIN SELECT RAISE(ABORT, 'payment_confirmation_transaction_purpose_mismatch'); END;

CREATE TRIGGER IF NOT EXISTS payment_ledger_transaction_purpose_guard
BEFORE INSERT ON financial_ledger_entries FOR EACH ROW
WHEN NEW.entry_type='payment' AND (
  NEW.transaction_purpose IS NULL
  OR NEW.transaction_purpose NOT IN ('new_sale','renewal','upgrade','copier_subscription')
  OR NEW.source_type <> 'order_payment_' || NEW.transaction_purpose
  OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.transactionPurpose=NEW.transaction_purpose)
)
BEGIN SELECT RAISE(ABORT, 'payment_ledger_transaction_purpose_mismatch'); END;

CREATE TRIGGER IF NOT EXISTS registration_keys_transaction_purpose_valid_insert
BEFORE INSERT ON registrationKeys FOR EACH ROW
WHEN NEW.transactionPurpose IS NOT NULL AND NEW.transactionPurpose NOT IN ('new_sale','renewal','upgrade','copier_subscription','legacy_migration')
BEGIN SELECT RAISE(ABORT, 'registration_key_transaction_purpose_invalid'); END;

CREATE TABLE IF NOT EXISTS trade_copier_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','awaiting_external_link','active','suspended','expired','cancelled')),
  service_key TEXT NOT NULL DEFAULT 'trade_copier',
  amount_ils_minor INTEGER NOT NULL DEFAULT 100000 CHECK (amount_ils_minor > 0),
  access_days INTEGER NOT NULL DEFAULT 365 CHECK (access_days BETWEEN 1 AND 3650),
  starts_at TEXT,
  ends_at TEXT,
  external_provider TEXT,
  trading_account_ref TEXT,
  external_linked_at TEXT,
  support_notes TEXT,
  created_by_type TEXT NOT NULL DEFAULT 'user',
  created_by_id INTEGER NOT NULL,
  activated_by_type TEXT,
  activated_by_id INTEGER,
  activated_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_copier_open_per_user
  ON trade_copier_subscriptions(user_id)
  WHERE status IN ('pending_payment','awaiting_external_link','active','suspended');
CREATE INDEX IF NOT EXISTS idx_trade_copier_subscriptions_user_status
  ON trade_copier_subscriptions(user_id, status, id);
CREATE INDEX IF NOT EXISTS idx_trade_copier_subscriptions_status_updated
  ON trade_copier_subscriptions(status, updated_at, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '129_trade_copier_service.sql',
  'codex',
  'Adds private trade copier sale/payment tracking and external-linking subscription state.'
);
