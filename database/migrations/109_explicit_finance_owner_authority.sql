-- Phase 1: replace the temporary hard-coded owner ID with an explicit,
-- database-backed finance-owner assignment. This migration bootstraps only the
-- single owner admin explicitly approved for the current production database.

CREATE TABLE IF NOT EXISTS finance_owner_assignments (
  admin_id INTEGER PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  assigned_by_admin_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_by_admin_id INTEGER,
  revoked_at TEXT,
  reason TEXT NOT NULL,
  CHECK (
    (is_active = 1 AND revoked_by_admin_id IS NULL AND revoked_at IS NULL)
    OR
    (is_active = 0 AND revoked_by_admin_id IS NOT NULL AND revoked_at IS NOT NULL)
  ),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_owner_assignment_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'revoked')),
  performed_by_admin_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_finance_owner_audit_admin_created
  ON finance_owner_assignment_audit(admin_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS finance_owner_assignment_audit_no_update
BEFORE UPDATE ON finance_owner_assignment_audit
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'finance_owner_audit_append_only');
END;

CREATE TRIGGER IF NOT EXISTS finance_owner_assignment_audit_no_delete
BEFORE DELETE ON finance_owner_assignment_audit
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'finance_owner_audit_append_only');
END;

-- The owner selected option A on 2026-09-11. Production discovery proved that
-- admin id 1 is the sole current admin. This is a one-time data bootstrap, not
-- an authorization convention; application code must query the table.
INSERT OR IGNORE INTO finance_owner_assignments (
  admin_id,
  is_active,
  assigned_by_admin_id,
  assigned_at,
  reason
)
SELECT id, 1, id, datetime('now'), 'Explicit business owner bootstrap approved on 2026-09-11'
FROM admins
WHERE id = 1;

INSERT OR IGNORE INTO finance_owner_assignment_audit (
  admin_id,
  action,
  performed_by_admin_id,
  reason,
  event_key,
  created_at
)
SELECT id,
       'assigned',
       id,
       'Explicit business owner bootstrap approved on 2026-09-11',
       'migration-109:finance-owner:admin:' || id,
       datetime('now')
FROM admins
WHERE id = 1;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '109_explicit_finance_owner_authority.sql',
  'codex_local',
  'Explicit finance-owner assignment and immutable owner-authority audit; bootstraps only the approved current owner.'
);
