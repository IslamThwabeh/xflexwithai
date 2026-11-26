-- Additive, non-unique read index for explicitly requested purchaser history.
-- Does not modify order statuses, receipts, payments, keys or entitlements.
CREATE INDEX IF NOT EXISTS idx_orders_user_status_id
  ON orders(userId, status, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '138_order_review_lookup.sql',
  'codex_local_release',
  'Supports bounded, on-demand completed-order review by purchaser.'
);
