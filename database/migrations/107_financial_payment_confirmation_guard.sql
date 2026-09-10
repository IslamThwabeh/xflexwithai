-- Phase 2: a payment confirmation may only follow the controlled order
-- transition performed in the same D1 batch. This prevents a concurrent
-- cancellation/refund from receiving a financial payment entry.

CREATE TRIGGER IF NOT EXISTS order_payment_confirmations_requires_completed_order
BEFORE INSERT ON order_payment_confirmations
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM orders
  WHERE id = NEW.order_id AND status = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'order_payment_confirmation_requires_completed_order');
END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '107_financial_payment_confirmation_guard.sql',
  'codex_wrangler',
  'Phase 2 guard: payment confirmation requires the same atomic transition to completed.'
);
