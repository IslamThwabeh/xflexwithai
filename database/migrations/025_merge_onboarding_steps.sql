-- Migration 025: Merge open_account + verify_account into single step
-- The proof image confirms both account opening AND verification,
-- so we reduce from 4 steps to 3: select_broker → open_account → deposit

-- Delete all verify_account rows (no longer needed as a separate step)
DELETE FROM broker_onboarding WHERE step = 'verify_account';

-- Note: SQLite CHECK constraint still allows 'verify_account' as a historical value,
-- but the application code no longer creates it. This is safe.
