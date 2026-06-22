-- Add provider-level batch correlation while preserving one delivery row per
-- recipient. This migration is additive and does not rewrite existing rows.
ALTER TABLE recommendation_deliveries ADD COLUMN providerRequestId TEXT;
ALTER TABLE recommendation_deliveries ADD COLUMN providerBatchKey TEXT;

CREATE INDEX IF NOT EXISTS idx_rec_deliveries_provider_batch
  ON recommendation_deliveries (providerBatchKey, status);
