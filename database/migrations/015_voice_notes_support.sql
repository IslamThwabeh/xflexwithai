-- Add voice note support to support messages
ALTER TABLE supportMessages ADD COLUMN attachmentType TEXT DEFAULT NULL;
ALTER TABLE supportMessages ADD COLUMN attachmentDuration INTEGER DEFAULT NULL;
