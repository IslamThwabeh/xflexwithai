-- Additive tables/lookup index. Existing business values are unchanged.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON orderItems(orderId);
CREATE TABLE IF NOT EXISTS checkout_intents (
  user_id INTEGER NOT NULL CHECK(user_id>0),
  intent_key TEXT NOT NULL CHECK(length(intent_key) BETWEEN 16 AND 128),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  flow TEXT NOT NULL CHECK(flow IN ('package','upgrade','renewal','copier')),
  order_id INTEGER REFERENCES orders(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,intent_key)
);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_order ON checkout_intents(order_id) WHERE order_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS checkout_intents_owner_insert
BEFORE INSERT ON checkout_intents WHEN NEW.order_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT,'checkout_intent_order_owner') WHERE NOT EXISTS(
    SELECT 1 FROM orders WHERE id=NEW.order_id AND userId=NEW.user_id);
END;
CREATE TRIGGER IF NOT EXISTS checkout_intents_assign_once
BEFORE UPDATE ON checkout_intents BEGIN
  SELECT RAISE(ABORT,'checkout_intent_immutable') WHERE OLD.order_id IS NOT NULL
    OR NEW.user_id IS NOT OLD.user_id OR NEW.intent_key IS NOT OLD.intent_key
    OR NEW.request_hash IS NOT OLD.request_hash OR NEW.flow IS NOT OLD.flow
    OR NEW.created_at IS NOT OLD.created_at OR NEW.order_id IS NULL;
  SELECT RAISE(ABORT,'checkout_intent_order_owner') WHERE NOT EXISTS(
    SELECT 1 FROM orders WHERE id=NEW.order_id AND userId=NEW.user_id);
END;
CREATE TRIGGER IF NOT EXISTS checkout_intents_no_delete BEFORE DELETE ON checkout_intents
BEGIN SELECT RAISE(ABORT,'checkout_intent_immutable'); END;

-- Only future discounted orders use format2. Native amounts preserve the
-- distinction between the net invoice discount and VAT-inclusive savings.
CREATE TABLE IF NOT EXISTS order_pricing_snapshots (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  format_version INTEGER NOT NULL CHECK(format_version=2),
  gross_subtotal_minor INTEGER NOT NULL CHECK(gross_subtotal_minor>=0),
  gross_discount_minor INTEGER NOT NULL CHECK(gross_discount_minor>=0 AND gross_discount_minor<=gross_subtotal_minor),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS order_pricing_snapshot_guard BEFORE INSERT ON order_pricing_snapshots BEGIN
  SELECT RAISE(ABORT,'checkout_pricing_mismatch') WHERE NOT EXISTS(
    SELECT 1 FROM orders WHERE id=NEW.order_id
      AND totalAmount=NEW.gross_subtotal_minor-NEW.gross_discount_minor
      AND subtotal-discountAmount+vatAmount=totalAmount);
END;
CREATE TRIGGER IF NOT EXISTS order_pricing_snapshot_no_update BEFORE UPDATE ON order_pricing_snapshots
BEGIN SELECT RAISE(ABORT,'checkout_pricing_immutable'); END;
CREATE TRIGGER IF NOT EXISTS order_pricing_snapshot_no_delete BEFORE DELETE ON order_pricing_snapshots
BEGIN SELECT RAISE(ABORT,'checkout_pricing_immutable'); END;

INSERT OR IGNORE INTO schema_migrations(migration_name,source,notes)
VALUES('140_checkout_intents_and_pricing.sql','codex_local_release',
  'Durable account-scoped checkout retries and immutable future net-discount invoice snapshots; no historical rewrite.');
