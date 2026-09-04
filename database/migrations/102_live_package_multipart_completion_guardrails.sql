-- Live Package Phase 2 QA fix: persist multipart completion expectations.
-- Additive only; no existing orders, entitlements, sessions, recordings, uploads, or settings are changed.

ALTER TABLE live_package_recording_uploads ADD COLUMN part_size_bytes INTEGER;
ALTER TABLE live_package_recording_uploads ADD COLUMN expected_part_count INTEGER;
ALTER TABLE live_package_recording_uploads ADD COLUMN completed_part_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_live_recording_uploads_completion
  ON live_package_recording_uploads(status, expected_part_count, completed_part_count);
