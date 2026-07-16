-- Migration 071: Account-level terms acceptance for checkout, manual-key,
-- legacy-client, and future re-consent flows.

CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  source TEXT NOT NULL,
  order_id INTEGER,
  CONSTRAINT uq_user_terms_acceptance_version UNIQUE (user_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_user_terms_acceptances_user_accepted
  ON user_terms_acceptances(user_id, accepted_at DESC);

-- Safe rollout: deploy migration, Worker, and Pages first; enable only after
-- the acceptance UI is confirmed live.
INSERT OR IGNORE INTO admin_settings (settingKey, settingValue, updatedAt)
VALUES ('terms_acceptance_gate_enabled', 'false', datetime('now'));

-- Preserve only acceptance evidence that already exists. Clients without
-- evidence are intentionally NOT backfilled as accepted.
INSERT OR IGNORE INTO user_terms_acceptances (
  user_id, terms_version, accepted_at, ip_address, user_agent, source, order_id
)
SELECT
  o.userId,
  o.termsAcceptedVersion,
  o.termsAcceptedAt,
  o.termsAcceptedIpAddress,
  o.termsAcceptedUserAgent,
  'order_checkout',
  o.id
FROM orders o
WHERE o.termsAcceptedAt IS NOT NULL
  AND trim(o.termsAcceptedAt) <> ''
  AND o.termsAcceptedVersion IS NOT NULL
  AND trim(o.termsAcceptedVersion) <> ''
ORDER BY o.termsAcceptedAt ASC, o.id ASC;

-- Keep checkout and upgrade-order acceptance synchronized at the database
-- boundary even if another application path creates an order later.
CREATE TRIGGER IF NOT EXISTS orders_sync_account_terms_acceptance_insert
AFTER INSERT ON orders
FOR EACH ROW
WHEN NEW.termsAcceptedAt IS NOT NULL
  AND trim(NEW.termsAcceptedAt) <> ''
  AND NEW.termsAcceptedVersion IS NOT NULL
  AND trim(NEW.termsAcceptedVersion) <> ''
BEGIN
  INSERT OR IGNORE INTO user_terms_acceptances (
    user_id, terms_version, accepted_at, ip_address, user_agent, source, order_id
  ) VALUES (
    NEW.userId,
    NEW.termsAcceptedVersion,
    NEW.termsAcceptedAt,
    NEW.termsAcceptedIpAddress,
    NEW.termsAcceptedUserAgent,
    'order_checkout',
    NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS orders_sync_account_terms_acceptance_update
AFTER UPDATE OF termsAcceptedAt, termsAcceptedVersion ON orders
FOR EACH ROW
WHEN NEW.termsAcceptedAt IS NOT NULL
  AND trim(NEW.termsAcceptedAt) <> ''
  AND NEW.termsAcceptedVersion IS NOT NULL
  AND trim(NEW.termsAcceptedVersion) <> ''
BEGIN
  INSERT OR IGNORE INTO user_terms_acceptances (
    user_id, terms_version, accepted_at, ip_address, user_agent, source, order_id
  ) VALUES (
    NEW.userId,
    NEW.termsAcceptedVersion,
    NEW.termsAcceptedAt,
    NEW.termsAcceptedIpAddress,
    NEW.termsAcceptedUserAgent,
    'order_checkout',
    NEW.id
  );
END;

-- Defense in depth: no package key can be consumed for an account that lacks
-- recorded acceptance, even if a future application path skips middleware.
CREATE TRIGGER IF NOT EXISTS package_key_activation_requires_terms_acceptance
BEFORE UPDATE OF activatedAt ON registrationKeys
FOR EACH ROW
WHEN OLD.activatedAt IS NULL
  AND NEW.activatedAt IS NOT NULL
  AND NEW.packageId IS NOT NULL
  AND COALESCE((
    SELECT settingValue FROM admin_settings
    WHERE settingKey = 'terms_acceptance_gate_enabled'
    LIMIT 1
  ), 'false') = 'true'
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN user_terms_acceptances uta ON uta.user_id = u.id
    WHERE lower(trim(u.email)) = lower(trim(COALESCE(NEW.email, '')))
  )
BEGIN
  SELECT RAISE(ABORT, 'package_key_terms_acceptance_required');
END;
