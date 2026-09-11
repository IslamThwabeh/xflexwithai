-- Phase 2: controlled expense workflow and immutable audit trail.
-- Additive only: no historic expense or ledger row is rewritten.

CREATE TABLE IF NOT EXISTS financial_expense_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'receipt_attached', 'submitted', 'approved', 'rejected')),
  previous_status TEXT,
  next_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'staff')),
  actor_id INTEGER NOT NULL,
  reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_expense_events_expense_created
  ON financial_expense_events(expense_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_financial_expenses_creator_status_updated
  ON financial_expenses(created_by_type, created_by_id, status, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_financial_expenses_updated
  ON financial_expenses(updated_at, id);

CREATE TRIGGER IF NOT EXISTS financial_expense_events_no_update
BEFORE UPDATE ON financial_expense_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_expense_event_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_expense_events_no_delete
BEFORE DELETE ON financial_expense_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_expense_event_append_only');
END;

-- No expense is physically deleted, including drafts and rejected records.
CREATE TRIGGER IF NOT EXISTS financial_expenses_no_delete
BEFORE DELETE ON financial_expenses
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_expense_no_hard_delete');
END;

-- Approval inserts the ledger entry first, in the same atomic batch, while the
-- expense is pending. This guard prevents standalone or back-dated expense
-- ledger inserts that bypass the approval workflow.
CREATE TRIGGER IF NOT EXISTS financial_ledger_expense_requires_pending
BEFORE INSERT ON financial_ledger_entries
FOR EACH ROW WHEN NEW.entry_type = 'expense' BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM financial_expenses
    WHERE id = NEW.expense_id
      AND status = 'pending_approval'
  ) THEN RAISE(ABORT, 'financial_expense_must_be_pending_before_ledger') END;
END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '110_financial_expense_workflow.sql',
  'codex_local_release',
  'Expense lifecycle audit, no-hard-delete enforcement, approval guard, and indexed creator/status lookup.'
);
