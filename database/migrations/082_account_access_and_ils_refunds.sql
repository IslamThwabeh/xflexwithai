-- Migration 082: audited client login restrictions and ILS refund ledger.
--
-- This migration is additive. Existing users, entitlements, orders, keys, and
-- revenue rows are not modified. Refunds are recorded in agorot so every
-- staff-facing amount remains denominated in Israeli shekels (ILS / ₪).

ALTER TABLE users ADD COLUMN login_blocked_at TEXT;
ALTER TABLE users ADD COLUMN login_blocked_reason TEXT;
ALTER TABLE users ADD COLUMN login_blocked_by_type TEXT;
ALTER TABLE users ADD COLUMN login_blocked_by_id INTEGER;

CREATE TABLE account_refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  order_id INTEGER REFERENCES orders(id),
  registration_key_id INTEGER NOT NULL REFERENCES registrationKeys(id),
  amount_ils_agorot INTEGER NOT NULL CHECK (amount_ils_agorot > 0),
  gross_amount_ils_agorot INTEGER NOT NULL CHECK (gross_amount_ils_agorot > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('bank_transfer', 'cash', 'other')),
  refund_reference TEXT,
  refunded_at TEXT NOT NULL,
  recorded_by_type TEXT NOT NULL CHECK (recorded_by_type IN ('admin', 'support')),
  recorded_by_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (amount_ils_agorot <= gross_amount_ils_agorot)
);

CREATE TABLE account_access_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('blocked', 'restored')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'support')),
  actor_id INTEGER NOT NULL,
  services_deactivated INTEGER NOT NULL DEFAULT 0 CHECK (services_deactivated IN (0, 1)),
  refund_id INTEGER REFERENCES account_refunds(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_account_refunds_user_refunded
  ON account_refunds(user_id, refunded_at DESC);
CREATE INDEX idx_account_refunds_key_refunded
  ON account_refunds(registration_key_id, refunded_at DESC);
CREATE INDEX idx_account_refunds_order_refunded
  ON account_refunds(order_id, refunded_at DESC);
CREATE INDEX idx_account_access_audit_user_created
  ON account_access_audit_logs(user_id, created_at DESC);

-- Protect against duplicate/concurrent refunds exceeding the original
-- canonical ILS sale value supplied by the application.
CREATE TRIGGER account_refunds_total_guard
BEFORE INSERT ON account_refunds
FOR EACH ROW
WHEN (
  COALESCE((
    SELECT SUM(existing.amount_ils_agorot)
    FROM account_refunds AS existing
    WHERE existing.registration_key_id = NEW.registration_key_id
  ), 0) + NEW.amount_ils_agorot > NEW.gross_amount_ils_agorot
)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_REFUND_EXCEEDS_ILS_SALE');
END;

CREATE TRIGGER account_refunds_sale_guard
BEFORE INSERT ON account_refunds
FOR EACH ROW
WHEN (
  NOT EXISTS (
    SELECT 1
    FROM registrationKeys AS key
    JOIN users AS client ON client.id = NEW.user_id
    LEFT JOIN orders AS sale_order ON sale_order.id = key.orderId
    WHERE key.id = NEW.registration_key_id
      AND key.activatedAt IS NOT NULL
      AND key.packageId IS NOT NULL
      AND key.price > 0
      AND (lower(trim(key.email)) = lower(trim(client.email)) OR sale_order.userId = NEW.user_id)
      AND (NEW.order_id IS NULL OR key.orderId = NEW.order_id)
  )
  OR EXISTS (
    SELECT 1
    FROM account_refunds AS existing
    WHERE existing.registration_key_id = NEW.registration_key_id
      AND existing.gross_amount_ils_agorot <> NEW.gross_amount_ils_agorot
  )
)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_REFUND_SALE_MISMATCH');
END;
