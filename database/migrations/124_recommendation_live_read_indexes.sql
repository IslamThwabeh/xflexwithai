-- Narrow indexes for the two measured live recommendation read paths.
-- Additive, idempotent, non-unique, and contains no historical data rewrite.

CREATE INDEX IF NOT EXISTS idx_recommendation_messages_open_roots
  ON recommendationMessages(
    parentId,
    type,
    COALESCE(threadStatus, 'open'),
    createdAt DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_recommendation_alerts_status_expiry_notified
  ON recommendationAlerts(status, expiresAt, notifiedAt DESC, id DESC);
