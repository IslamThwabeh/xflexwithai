-- Retire a superseded order from operational views while preserving immutable
-- payment evidence and financial attribution. All cash corrections are appended.
CREATE TABLE IF NOT EXISTS order_retirements (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  replacement_order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_ledger_entry_id INTEGER NOT NULL UNIQUE REFERENCES financial_ledger_entries(id),
  replacement_ledger_entry_id INTEGER NOT NULL UNIQUE REFERENCES financial_ledger_entries(id),
  paid_ils_minor INTEGER NOT NULL CHECK (paid_ils_minor > 0),
  replacement_ils_minor INTEGER NOT NULL CHECK (replacement_ils_minor > 0),
  credit_ils_minor INTEGER NOT NULL CHECK (credit_ils_minor >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  actor_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (order_id <> replacement_order_id),
  CHECK (paid_ils_minor = replacement_ils_minor + credit_ils_minor)
);
CREATE INDEX IF NOT EXISTS idx_order_retirements_user ON order_retirements(user_id);
CREATE TRIGGER IF NOT EXISTS order_retirements_guard
BEFORE INSERT ON order_retirements BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM finance_owner_assignments WHERE admin_id = NEW.actor_admin_id AND is_active = 1
  ) THEN RAISE(ABORT, 'finance_owner_required') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM orders o JOIN orders n ON n.id = NEW.replacement_order_id
    WHERE o.id = NEW.order_id AND o.userId = NEW.user_id AND n.userId = o.userId
      AND o.status = 'completed' AND n.status = 'completed'
      AND o.isGift = 0 AND n.isGift = 0 AND o.createdAt < n.createdAt
      AND (SELECT COUNT(*) FROM orderItems WHERE orderId = o.id) = 1
      AND (SELECT COUNT(*) FROM orderItems WHERE orderId = n.id) = 1
      AND EXISTS (SELECT 1 FROM orderItems i JOIN packages p ON p.id = i.packageId
        WHERE i.orderId = o.id AND i.itemType = 'package' AND p.slug = 'live-package')
      AND EXISTS (SELECT 1 FROM orderItems i JOIN packages p ON p.id = i.packageId
        WHERE i.orderId = n.id AND i.itemType = 'package' AND p.slug = 'comprehensive')
  ) THEN RAISE(ABORT, 'matching_completed_live_and_comprehensive_orders_required') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM registrationKeys WHERE orderId = NEW.order_id AND activatedAt IS NOT NULL
  ) THEN RAISE(ABORT, 'activated_live_order_requires_manual_review') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM account_refunds WHERE order_id IN (NEW.order_id, NEW.replacement_order_id)
  ) THEN RAISE(ABORT, 'refunded_order_requires_manual_review') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM financial_ledger_entries l
    JOIN order_payment_confirmations c ON c.order_id = l.order_id
    WHERE l.id = NEW.source_ledger_entry_id AND l.order_id = NEW.order_id
      AND l.entry_type = 'payment' AND l.status = 'approved' AND l.currency = 'ILS'
      AND l.base_amount_ils_minor = NEW.paid_ils_minor
      AND l.amount_minor = NEW.paid_ils_minor
  ) OR NOT EXISTS (
    SELECT 1 FROM financial_ledger_entries l
    JOIN order_payment_confirmations c ON c.order_id = l.order_id
    WHERE l.id = NEW.replacement_ledger_entry_id AND l.order_id = NEW.replacement_order_id
      AND l.entry_type = 'payment' AND l.status = 'approved' AND l.currency = 'ILS'
      AND l.base_amount_ils_minor = NEW.replacement_ils_minor
      AND l.amount_minor = NEW.replacement_ils_minor
  ) THEN RAISE(ABORT, 'verified_ils_payments_required') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM financial_ledger_entries WHERE status = 'approved'
      AND order_id IN (NEW.order_id, NEW.replacement_order_id)
      AND id NOT IN (NEW.source_ledger_entry_id, NEW.replacement_ledger_entry_id)
  ) OR EXISTS (
    SELECT 1 FROM financial_ledger_entries WHERE entry_type = 'reversal'
      AND reversal_of_entry_id IN (NEW.source_ledger_entry_id, NEW.replacement_ledger_entry_id)
  ) THEN RAISE(ABORT, 'previous_financial_correction_requires_review') END;
END;
CREATE TRIGGER IF NOT EXISTS order_retirements_no_update BEFORE UPDATE ON order_retirements
BEGIN SELECT RAISE(ABORT, 'order_retirement_immutable'); END;
CREATE TRIGGER IF NOT EXISTS order_retirements_no_delete BEFORE DELETE ON order_retirements
BEGIN SELECT RAISE(ABORT, 'order_retirement_immutable'); END;

CREATE TABLE IF NOT EXISTS customer_renewal_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_order_id INTEGER NOT NULL REFERENCES orders(id),
  amount_ils_minor INTEGER NOT NULL CHECK (amount_ils_minor <> 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('grant', 'use', 'release')),
  source_reference TEXT NOT NULL UNIQUE,
  renewal_order_id INTEGER REFERENCES orders(id),
  reason TEXT NOT NULL,
  actor_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CHECK ((entry_type IN ('grant', 'release') AND amount_ils_minor > 0)
    OR (entry_type = 'use' AND amount_ils_minor < 0 AND renewal_order_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_customer_renewal_credits_user ON customer_renewal_credits(user_id, id);
CREATE TRIGGER IF NOT EXISTS renewal_credit_nonnegative BEFORE INSERT ON customer_renewal_credits
WHEN COALESCE((SELECT SUM(amount_ils_minor) FROM customer_renewal_credits WHERE user_id = NEW.user_id), 0) + NEW.amount_ils_minor < 0
BEGIN SELECT RAISE(ABORT, 'insufficient_renewal_credit'); END;
CREATE TRIGGER IF NOT EXISTS renewal_credit_no_update BEFORE UPDATE ON customer_renewal_credits
BEGIN SELECT RAISE(ABORT, 'renewal_credit_immutable'); END;
CREATE TRIGGER IF NOT EXISTS renewal_credit_no_delete BEFORE DELETE ON customer_renewal_credits
BEGIN SELECT RAISE(ABORT, 'renewal_credit_immutable'); END;
INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('133_live_order_retirement_credit.sql', 'codex_release', 'Audited superseded Live order retirement and ILS renewal credit.');
