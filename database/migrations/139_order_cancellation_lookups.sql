-- Additive, non-unique lookup indexes. No business values are changed.
-- Used only by explicit order safety reviews/cancellation, not dashboard polling.
CREATE INDEX IF NOT EXISTS idx_registration_keys_order_guard
  ON registrationKeys(orderId) WHERE orderId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_ledger_order_guard
  ON financial_ledger_entries(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_entitlements_order_guard
  ON live_package_entitlements(orderId) WHERE orderId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_subscriptions_order_guard
  ON packageSubscriptions(orderId) WHERE orderId IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON order_status_history(order_id, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('139_order_cancellation_lookups.sql', 'codex_local_release',
  'Indexed explicit order cancellation safety and bounded status-history lookup; no business data changes.');
