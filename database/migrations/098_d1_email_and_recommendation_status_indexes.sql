-- Add the last measured D1 index candidates for notification email markers
-- and the rolling recommendation-delivery status report.
--
-- Both indexes are additive, idempotent, and non-unique. The notification
-- index is partial so it only covers rows that participate in batch email
-- status updates.

CREATE INDEX IF NOT EXISTS idx_user_notifications_batch_user
  ON user_notifications(batch_id, user_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_deliveries_created_status
  ON recommendation_deliveries(createdAt, status);
