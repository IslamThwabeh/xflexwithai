-- Bounded support client lookup uses prefix ranges rather than leading-wildcard
-- LIKE predicates. These expression indexes let SQLite satisfy each OR branch
-- without scanning the complete users table for an unsuccessful search.

CREATE INDEX IF NOT EXISTS idx_users_support_email_lower
  ON users(lower(email));

CREATE INDEX IF NOT EXISTS idx_users_support_name_lower
  ON users(lower(COALESCE(name, '')));

CREATE INDEX IF NOT EXISTS idx_users_support_phone
  ON users(COALESCE(phone, ''));
