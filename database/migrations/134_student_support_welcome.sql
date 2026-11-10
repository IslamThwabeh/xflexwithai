-- A durable receipt also prevents re-sending after a welcome is deleted in chat.
CREATE TABLE IF NOT EXISTS student_support_welcomes (
  user_id INTEGER PRIMARY KEY,
  conversation_id INTEGER,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- This is forward-only onboarding. Do not message the existing student base.
INSERT OR IGNORE INTO student_support_welcomes (user_id)
SELECT u.id FROM users u
WHERE u.firstPackageActivatedAt IS NOT NULL
   OR lower(trim(u.email)) IN (
     SELECT lower(trim(k.email)) FROM registrationKeys k WHERE k.activatedAt IS NOT NULL
   );
