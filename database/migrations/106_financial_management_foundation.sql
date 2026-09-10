-- Phase 1: append-only financial-management foundation.
-- This migration is additive and uses only idempotent CREATE statements. Payment
-- confirmation is an immutable event rather than an ALTER of legacy orders, so
-- historic order rows are never silently rewritten.

CREATE TABLE IF NOT EXISTS order_payment_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE,
  paid_at TEXT NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  rationale TEXT NOT NULL,
  evidence_metadata TEXT,
  confirmed_by_type TEXT NOT NULL CHECK (confirmed_by_type IN ('admin', 'staff', 'gateway')),
  confirmed_by_id INTEGER,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (length(paid_at) >= 10)
);

CREATE TRIGGER IF NOT EXISTS order_payment_confirmations_no_update
BEFORE UPDATE ON order_payment_confirmations
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'order_payment_confirmation_append_only');
END;

CREATE TRIGGER IF NOT EXISTS order_payment_confirmations_no_delete
BEFORE DELETE ON order_payment_confirmations
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'order_payment_confirmation_append_only');
END;

CREATE TABLE IF NOT EXISTS financial_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment', 'refund', 'expense', 'opening_balance', 'adjustment', 'reversal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'reversed')),
  effective_at TEXT NOT NULL,
  reporting_month TEXT NOT NULL CHECK (reporting_month = substr(effective_at, 1, 7)),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  base_amount_ils_minor INTEGER NOT NULL,
  exchange_rate REAL,
  exchange_rate_source TEXT,
  order_id INTEGER,
  order_item_id INTEGER,
  registration_key_id INTEGER,
  refund_id INTEGER,
  expense_id INTEGER,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  description TEXT,
  internal_notes TEXT,
  reason TEXT,
  evidence_metadata TEXT,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('admin', 'staff', 'system', 'gateway')),
  created_by_id INTEGER,
  submitted_by_type TEXT,
  submitted_by_id INTEGER,
  approved_by_type TEXT,
  approved_by_id INTEGER,
  approved_at TEXT,
  reversal_of_entry_id INTEGER,
  audit_metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (entry_type <> 'payment' OR amount_minor > 0),
  CHECK (entry_type <> 'refund' OR amount_minor < 0),
  CHECK (entry_type <> 'expense' OR amount_minor < 0),
  CHECK (currency NOT IN ('ILS', 'NIS') OR amount_minor = base_amount_ils_minor),
  CHECK (currency IN ('ILS', 'NIS') OR (exchange_rate IS NOT NULL AND exchange_rate > 0 AND exchange_rate_source IS NOT NULL)),
  CHECK (status <> 'approved' OR approved_at IS NOT NULL),
  CHECK (status <> 'approved' OR approved_by_type IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_payment_order
  ON financial_ledger_entries(order_id)
  WHERE entry_type = 'payment' AND order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_ledger_expense_id
  ON financial_ledger_entries(expense_id)
  WHERE entry_type = 'expense' AND expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_ledger_approved_period
  ON financial_ledger_entries(status, reporting_month, effective_at, id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_source_link
  ON financial_ledger_entries(source_type, source_reference, id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_reversal
  ON financial_ledger_entries(reversal_of_entry_id, id)
  WHERE reversal_of_entry_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS financial_ledger_entries_approved_immutable
BEFORE UPDATE ON financial_ledger_entries
FOR EACH ROW WHEN OLD.status IN ('approved', 'reversed') BEGIN
  SELECT RAISE(ABORT, 'financial_ledger_entry_approved_immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_ledger_entries_no_delete
BEFORE DELETE ON financial_ledger_entries
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_ledger_entry_append_only');
END;

CREATE TABLE IF NOT EXISTS financial_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'reversed')),
  paid_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payroll', 'advertising', 'software_and_subscriptions', 'professional_services', 'payment_and_bank_fees', 'rent_and_office', 'taxes_and_government_fees', 'training_and_content', 'other')),
  supplier_or_payee TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  base_amount_ils_minor INTEGER NOT NULL CHECK (base_amount_ils_minor > 0),
  exchange_rate REAL,
  exchange_rate_source TEXT,
  vat_rate INTEGER,
  vat_amount_minor INTEGER,
  vat_included INTEGER,
  payment_method TEXT,
  payment_reference TEXT,
  description TEXT,
  internal_notes TEXT,
  receipt_metadata TEXT,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('admin', 'staff')),
  created_by_id INTEGER NOT NULL,
  submitted_by_type TEXT,
  submitted_by_id INTEGER,
  approved_by_type TEXT,
  approved_by_id INTEGER,
  approved_at TEXT,
  ledger_entry_id INTEGER UNIQUE,
  reversal_of_expense_id INTEGER,
  correction_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (currency NOT IN ('ILS', 'NIS') OR amount_minor = base_amount_ils_minor),
  CHECK (currency IN ('ILS', 'NIS') OR (exchange_rate IS NOT NULL AND exchange_rate > 0 AND exchange_rate_source IS NOT NULL)),
  CHECK (status <> 'approved' OR (approved_at IS NOT NULL AND approved_by_type IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_financial_expenses_status_paid
  ON financial_expenses(status, paid_at, id);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_category_paid
  ON financial_expenses(category, paid_at, id);

CREATE TRIGGER IF NOT EXISTS financial_expenses_approved_immutable
BEFORE UPDATE ON financial_expenses
FOR EACH ROW WHEN OLD.status IN ('approved', 'reversed') BEGIN
  SELECT RAISE(ABORT, 'financial_expense_approved_immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_expenses_approved_no_delete
BEFORE DELETE ON financial_expenses
FOR EACH ROW WHEN OLD.status IN ('approved', 'reversed') BEGIN
  SELECT RAISE(ABORT, 'financial_expense_approved_append_only');
END;

CREATE TABLE IF NOT EXISTS financial_period_locks (
  month TEXT PRIMARY KEY CHECK (length(month) = 7),
  locked_by_admin_id INTEGER NOT NULL,
  locked_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_period_lock_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL CHECK (length(month) = 7),
  action TEXT NOT NULL CHECK (action IN ('locked', 'unlocked')),
  performed_by_admin_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_period_lock_events_month_created
  ON financial_period_lock_events(month, created_at, id);

CREATE TABLE IF NOT EXISTS financial_reconciliation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  proposed_treatment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'approved_opening_balance', 'approved_adjustment', 'excluded', 'resolved')),
  proposed_amount_ils_minor INTEGER,
  notes TEXT,
  reviewer_type TEXT,
  reviewer_id INTEGER,
  resolved_at TEXT,
  resolution_metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_reference, issue_type)
);

CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_status_created
  ON financial_reconciliation_items(status, created_at, id);
CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_source
  ON financial_reconciliation_items(source_type, source_reference);

CREATE TABLE IF NOT EXISTS financial_reconciliation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_item_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'staff', 'system')),
  actor_id INTEGER,
  reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_events_item_created
  ON financial_reconciliation_events(reconciliation_item_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_events_no_update
BEFORE UPDATE ON financial_reconciliation_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_reconciliation_event_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_events_no_delete
BEFORE DELETE ON financial_reconciliation_events
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_reconciliation_event_append_only');
END;

CREATE TABLE IF NOT EXISTS financial_role_assignment_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('finance_manager', 'finance_clerk', 'finance_viewer')),
  action TEXT NOT NULL CHECK (action IN ('assigned', 'removed')),
  performed_by_admin_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_role_audit_user_created
  ON financial_role_assignment_audit(user_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS financial_role_assignment_audit_no_update
BEFORE UPDATE ON financial_role_assignment_audit
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_role_audit_append_only');
END;

CREATE TRIGGER IF NOT EXISTS financial_role_assignment_audit_no_delete
BEFORE DELETE ON financial_role_assignment_audit
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_role_audit_append_only');
END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '106_financial_management_foundation.sql',
  'codex_wrangler',
  'Financial management foundation: immutable payment confirmations, ledger, expense, period-lock, reconciliation, and finance-role audit tables.'
);
