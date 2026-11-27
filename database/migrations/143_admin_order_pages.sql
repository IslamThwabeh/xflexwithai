-- Bounded order queues/counts by status and immutable order number. No business rewrite.
CREATE INDEX IF NOT EXISTS idx_orders_status_id ON orders(status,id);
INSERT OR IGNORE INTO schema_migrations(migration_name,source,notes)
VALUES('143_admin_order_pages.sql','codex','Non-unique status/order-number index for bounded admin order review');
