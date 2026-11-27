-- Non-unique lookup indexes only; no historical contact, cash or access rewrite.
CREATE INDEX IF NOT EXISTS idx_users_customer_registered ON users(isStaff,julianday(createdAt) DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_users_customer_country ON users(isStaff,country);
CREATE INDEX IF NOT EXISTS idx_registration_keys_customer_activation ON registrationKeys(lower(trim(email)),isRenewal)
WHERE packageId IS NOT NULL AND activatedAt IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_subscriptions_customer ON packageSubscriptions(userId,id DESC);
CREATE INDEX IF NOT EXISTS idx_lexai_subscriptions_customer ON lexaiSubscriptions(userId,id DESC);
INSERT OR IGNORE INTO schema_migrations(migration_name,source,notes)
VALUES('142_customer_report_pages.sql','codex_local_release','Bounded customer reports; five non-unique indexes only.');
