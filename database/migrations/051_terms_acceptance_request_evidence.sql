-- Store server-side request evidence for order terms acceptance.
ALTER TABLE orders ADD COLUMN termsAcceptedIpAddress TEXT;
ALTER TABLE orders ADD COLUMN termsAcceptedUserAgent TEXT;
