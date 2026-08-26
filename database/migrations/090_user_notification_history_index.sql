-- Bound the default admin sent-notification history read by creation time.
--
-- This index is deliberately additive, non-unique, and partial. It preserves
-- every notification row and only indexes rows eligible for sent-history
-- grouping, allowing an explicit created_at cutoff to avoid a full table scan.

CREATE INDEX IF NOT EXISTS idx_user_notifications_batched_created_at
  ON user_notifications(created_at DESC, batch_id)
  WHERE batch_id IS NOT NULL;
