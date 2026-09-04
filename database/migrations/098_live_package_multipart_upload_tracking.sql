-- Live Package Phase 2 follow-up: persist Cloudflare R2 multipart identifiers.
-- Additive only; no existing objects/orders/access records are changed.

ALTER TABLE live_package_recording_uploads ADD COLUMN r2_upload_id TEXT;
ALTER TABLE live_package_recording_uploads ADD COLUMN completed_parts_json TEXT;

CREATE INDEX IF NOT EXISTS idx_live_recording_uploads_r2_upload
  ON live_package_recording_uploads(r2_upload_id);
