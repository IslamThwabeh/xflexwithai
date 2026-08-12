-- Durable, per-channel idempotency for timed-service lifecycle notifications.
-- Existing rows remain unchanged because NULL values are not unique conflicts.
ALTER TABLE user_notifications ADD COLUMN dedupe_key TEXT;
ALTER TABLE staff_notifications ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_notifications_dedupe_key
  ON user_notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_notifications_user_dedupe_key
  ON staff_notifications(userId, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
