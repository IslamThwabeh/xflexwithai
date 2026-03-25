-- Add file/image attachment columns to supportMessages (missed in previous migrations)
ALTER TABLE supportMessages ADD COLUMN attachment_url TEXT DEFAULT NULL;
ALTER TABLE supportMessages ADD COLUMN attachment_name TEXT DEFAULT NULL;
ALTER TABLE supportMessages ADD COLUMN attachment_size INTEGER DEFAULT NULL;
