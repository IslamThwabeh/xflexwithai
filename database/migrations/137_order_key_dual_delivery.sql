-- Forward-only. Existing orders are recovered explicitly from their order panel.
-- The job is committed in the SAME transaction that creates/links a paid key.
CREATE TABLE IF NOT EXISTS order_key_delivery_jobs (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','blocked','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  locked_at TEXT,
  claim_token TEXT,
  last_error_code TEXT,
  support_status TEXT NOT NULL DEFAULT 'pending' CHECK(support_status IN ('pending','delivered','recipient_unregistered')),
  support_recipient_user_id INTEGER,
  support_conversation_id INTEGER,
  support_message_id INTEGER,
  support_delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_key_delivery_jobs_due
  ON order_key_delivery_jobs(status,next_attempt_at,order_id);

CREATE TRIGGER IF NOT EXISTS trg_order_key_delivery_insert
AFTER INSERT ON registrationKeys
WHEN NEW.orderId IS NOT NULL AND NEW.packageId IS NOT NULL AND NEW.issuanceType = 'order'
 AND NEW.activatedAt IS NULL
BEGIN
  INSERT OR IGNORE INTO order_key_delivery_jobs(order_id,next_attempt_at,created_at,updated_at)
  SELECT NEW.orderId,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM orders o WHERE o.id = NEW.orderId AND o.status = 'completed'
    AND EXISTS(SELECT 1 FROM order_payment_confirmations c WHERE c.order_id = o.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_order_key_delivery_link
AFTER UPDATE OF orderId,issuanceType ON registrationKeys
WHEN NEW.orderId IS NOT NULL AND NEW.packageId IS NOT NULL AND NEW.issuanceType = 'order'
 AND NEW.activatedAt IS NULL
BEGIN
  INSERT OR IGNORE INTO order_key_delivery_jobs(order_id,next_attempt_at,created_at,updated_at)
  SELECT NEW.orderId,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM orders o WHERE o.id = NEW.orderId AND o.status = 'completed'
    AND EXISTS(SELECT 1 FROM order_payment_confirmations c WHERE c.order_id = o.id);
END;
