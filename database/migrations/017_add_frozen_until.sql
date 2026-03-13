-- Timed freeze: if set, the system will auto-unfreeze on this date and email the client
ALTER TABLE lexaiSubscriptions ADD COLUMN frozenUntil TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN frozenUntil TEXT;
