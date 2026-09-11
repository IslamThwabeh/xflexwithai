-- Phase 5: indexed, owner-reviewed historical reconciliation.
-- Source orders and registration keys remain untouched. Any recognized value
-- is represented by one append-only opening-balance ledger entry.

CREATE INDEX IF NOT EXISTS idx_orders_financial_reconciliation_status_id
  ON orders(status, id)
  WHERE status IN ('paid', 'completed');

CREATE INDEX IF NOT EXISTS idx_order_payment_confirmations_reconciliation_count
  ON order_payment_confirmations(id);

CREATE INDEX IF NOT EXISTS idx_registration_keys_financial_reconciliation_manual
  ON registrationKeys(id)
  WHERE orderId IS NULL AND price > 0
    AND COALESCE(isRenewal, 0) = 0 AND COALESCE(isUpgrade, 0) = 0;

CREATE INDEX IF NOT EXISTS idx_registration_keys_financial_reconciliation_renewal
  ON registrationKeys(id)
  WHERE orderId IS NULL AND price > 0 AND isRenewal = 1;

CREATE INDEX IF NOT EXISTS idx_registration_keys_financial_reconciliation_upgrade
  ON registrationKeys(id)
  WHERE orderId IS NULL AND price > 0
    AND COALESCE(isRenewal, 0) = 0 AND isUpgrade = 1;

CREATE INDEX IF NOT EXISTS idx_registration_keys_financial_reconciliation_free
  ON registrationKeys(id)
  WHERE orderId IS NULL AND price <= 0;

CREATE INDEX IF NOT EXISTS idx_registration_keys_order_activation_reconciliation
  ON registrationKeys(activatedAt, id)
  WHERE orderId IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_reconciliation_status_updated
  ON financial_reconciliation_items(status, updated_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_reconciliation_terminal_event
  ON financial_reconciliation_events(reconciliation_item_id)
  WHERE next_status IN ('approved_opening_balance', 'approved_adjustment', 'excluded');

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_items_no_delete
BEFORE DELETE ON financial_reconciliation_items
FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'financial_reconciliation_item_no_hard_delete');
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_items_terminal_immutable
BEFORE UPDATE ON financial_reconciliation_items
FOR EACH ROW WHEN OLD.status <> 'unresolved' BEGIN
  SELECT RAISE(ABORT, 'financial_reconciliation_item_terminal_immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_terminal_event_requires_unresolved
BEFORE INSERT ON financial_reconciliation_events
FOR EACH ROW WHEN NEW.next_status IN ('approved_opening_balance', 'approved_adjustment', 'excluded') BEGIN
  SELECT CASE WHEN NEW.previous_status <> 'unresolved'
    OR NEW.action <> NEW.next_status
    OR NOT EXISTS (
      SELECT 1 FROM financial_reconciliation_items
      WHERE id = NEW.reconciliation_item_id AND status = 'unresolved'
    ) THEN RAISE(ABORT, 'financial_reconciliation_terminal_event_requires_unresolved') END;
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_opening_requires_unresolved
BEFORE INSERT ON financial_ledger_entries
FOR EACH ROW WHEN NEW.entry_type IN ('opening_balance', 'adjustment')
  AND NEW.source_type = 'historical_reconciliation' BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM financial_reconciliation_items
    WHERE id = CAST(substr(NEW.source_reference, 16) AS INTEGER)
      AND NEW.source_reference = 'reconciliation:' || id
      AND status = 'unresolved'
  ) THEN RAISE(ABORT, 'financial_reconciliation_item_must_be_unresolved') END;
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_resolution_requires_ledger
BEFORE UPDATE OF status ON financial_reconciliation_items
FOR EACH ROW WHEN NEW.status IN ('approved_opening_balance', 'approved_adjustment') BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM financial_ledger_entries
    WHERE entry_type = CASE NEW.status WHEN 'approved_opening_balance' THEN 'opening_balance' ELSE 'adjustment' END
      AND source_type = 'historical_reconciliation'
      AND source_reference = 'reconciliation:' || OLD.id
      AND status = 'approved'
  ) THEN RAISE(ABORT, 'financial_reconciliation_opening_ledger_required') END;
END;

CREATE TRIGGER IF NOT EXISTS financial_reconciliation_resolution_requires_event
BEFORE UPDATE OF status ON financial_reconciliation_items
FOR EACH ROW WHEN NEW.status IN ('approved_opening_balance', 'approved_adjustment', 'excluded') BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM financial_reconciliation_events
    WHERE reconciliation_item_id = OLD.id
      AND previous_status = 'unresolved'
      AND next_status = NEW.status
      AND action = NEW.status
  ) THEN RAISE(ABORT, 'financial_reconciliation_terminal_event_required') END;
END;

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '113_historical_financial_reconciliation.sql',
  'codex_local_release',
  'Indexed dry-run queue, immutable owner decisions, and append-only historical opening balances.'
);
