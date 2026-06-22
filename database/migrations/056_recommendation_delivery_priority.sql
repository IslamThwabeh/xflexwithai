-- Support recommendation-first queue scans introduced after the June 2026
-- delivery backlog incident. This is additive and safe to apply before code.
CREATE INDEX IF NOT EXISTS idx_rec_deliveries_status_kind_created
  ON recommendation_deliveries (status, eventKind, createdAt, id);
