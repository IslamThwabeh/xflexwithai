-- Phase 4: controlled adjustments, reversals, and accounting-period locks.
-- Approved ledger rows stay append-only; corrections are new reversing and
-- optional replacement entries, never edits to historic transactions.

CREATE TABLE IF NOT EXISTS financial_adjustment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  effective_at TEXT NOT NULL,
  reporting_month TEXT NOT NULL CHECK (reporting_month = substr(effective_at, 1, 7)),
  amount_ils_minor INTEGER NOT NULL CHECK (amount_ils_minor <> 0),
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  internal_notes TEXT,
  evidence_metadata TEXT,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('admin', 'staff')),
  created_by_id INTEGER NOT NULL,
  submitted_by_type TEXT,
  submitted_by_id INTEGER,
  submitted_at TEXT,
  reviewed_by_type TEXT,
  reviewed_by_id INTEGER,
  reviewed_at TEXT,
  review_reason TEXT,
  ledger_entry_id INTEGER UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_adjustments_status_updated
  ON financial_adjustment_requests(status, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_financial_adjustments_creator_status_updated
  ON financial_adjustment_requests(created_by_type, created_by_id, status, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_financial_adjustments_updated
  ON financial_adjustment_requests(updated_at, id);

CREATE TABLE IF NOT EXISTS financial_adjustment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'submitted', 'approved', 'rejected')),
  previous_status TEXT,
  next_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'staff')),
  actor_id INTEGER NOT NULL,
  reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_adjustment_events_item_created
  ON financial_adjustment_events(adjustment_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS financial_adjustment_events_no_update
BEFORE UPDATE ON financial_adjustment_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_adjustment_event_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_adjustment_events_no_delete
BEFORE DELETE ON financial_adjustment_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_adjustment_event_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_adjustments_terminal_immutable
BEFORE UPDATE ON financial_adjustment_requests
FOR EACH ROW WHEN OLD.status IN ('approved', 'rejected') BEGIN
  SELECT RAISE(ABORT, 'financial_adjustment_terminal_immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_adjustments_no_delete
BEFORE DELETE ON financial_adjustment_requests
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_adjustment_no_hard_delete');
END;

-- A retry or concurrent request can never reverse the same approved entry twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_single_reversal
  ON financial_ledger_entries(reversal_of_entry_id)
  WHERE entry_type = 'reversal' AND reversal_of_entry_id IS NOT NULL;

-- Application adjustments must come from a pending independently reviewed
-- request. Historical reconciliation uses separate source types in Phase 5.
CREATE TRIGGER IF NOT EXISTS financial_ledger_adjustment_requires_pending
BEFORE INSERT ON financial_ledger_entries
FOR EACH ROW WHEN NEW.entry_type = 'adjustment' AND NEW.source_type = 'financial_adjustment' BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM financial_adjustment_requests
    WHERE id = CAST(substr(NEW.source_reference, 12) AS INTEGER)
      AND NEW.source_reference = 'adjustment:' || id
      AND status = 'pending_approval'
  ) THEN RAISE(ABORT, 'financial_adjustment_must_be_pending_before_ledger') END;
END;

-- Locked periods reject all ordinary approved postings. Only an explicit
-- owner-authorized adjustment/reversal path may post to a locked month.
CREATE TRIGGER IF NOT EXISTS financial_ledger_locked_period_insert
BEFORE INSERT ON financial_ledger_entries
FOR EACH ROW WHEN NEW.status = 'approved' AND EXISTS (
  SELECT 1 FROM financial_period_locks WHERE month = NEW.reporting_month
) BEGIN
  SELECT CASE WHEN NOT (
    NEW.entry_type IN ('adjustment', 'reversal')
    AND NEW.approved_by_type = 'admin'
    AND json_extract(COALESCE(NEW.audit_metadata, '{}'), '$.ownerAuthorizedLockedPeriod') = 1
  ) THEN RAISE(ABORT, 'financial_period_locked') END;
END;

CREATE TRIGGER IF NOT EXISTS financial_ledger_locked_period_approval
BEFORE UPDATE OF status, effective_at, reporting_month ON financial_ledger_entries
FOR EACH ROW WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND EXISTS (
  SELECT 1 FROM financial_period_locks WHERE month = NEW.reporting_month
) BEGIN
  SELECT CASE WHEN NOT (
    NEW.entry_type IN ('adjustment', 'reversal')
    AND NEW.approved_by_type = 'admin'
    AND json_extract(COALESCE(NEW.audit_metadata, '{}'), '$.ownerAuthorizedLockedPeriod') = 1
  ) THEN RAISE(ABORT, 'financial_period_locked') END;
END;

CREATE TRIGGER IF NOT EXISTS financial_period_lock_events_no_update
BEFORE UPDATE ON financial_period_lock_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_period_lock_event_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_period_lock_events_no_delete
BEFORE DELETE ON financial_period_lock_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_period_lock_event_append_only');
END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '112_financial_controls.sql',
  'codex_local_release',
  'Independent adjustment workflow, audited period locks, database-enforced posting locks, and append-only reversals.'
);
