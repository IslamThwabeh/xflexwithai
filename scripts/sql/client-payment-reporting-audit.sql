-- One-time, aggregate-only baseline for the client payment reporting plan.
-- Read-only; intentionally audits small source tables, not a request-time query.
-- Counts describe evidence gaps; they do not establish unpaid balances.
SELECT
  (SELECT COUNT(*) FROM users WHERE isStaff = 0) AS client_accounts,
  (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'completed')) AS completed_or_paid_orders,
  (SELECT COUNT(*) FROM orders o
   WHERE o.status IN ('paid', 'completed') AND NOT EXISTS (
     SELECT 1 FROM order_payment_confirmations c WHERE c.order_id = o.id
   )) AS completed_or_paid_without_confirmation,
  (SELECT COUNT(*) FROM order_payment_confirmations) AS payment_confirmations,
  (SELECT COUNT(*) FROM order_payment_confirmations c WHERE NOT EXISTS (
     SELECT 1 FROM financial_ledger_entries l
     WHERE l.entry_type = 'payment' AND l.status = 'approved' AND l.order_id = c.order_id
   )) AS confirmations_without_approved_payment_entry,
  (SELECT COUNT(*) FROM financial_ledger_entries
   WHERE status = 'approved' AND entry_type = 'payment') AS approved_payment_entries,
  (SELECT COALESCE(SUM(base_amount_ils_minor), 0) FROM financial_ledger_entries
   WHERE status = 'approved' AND entry_type = 'payment') AS approved_payment_ils_minor,
  (SELECT COUNT(*) FROM financial_ledger_entries l
   WHERE l.status = 'approved' AND l.entry_type = 'payment'
     AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = l.order_id)
  ) AS approved_payments_without_matching_order,
  (SELECT COUNT(*) FROM registrationKeys
   WHERE packageId IS NOT NULL AND activatedAt IS NOT NULL) AS activated_package_keys,
  (SELECT COUNT(*) FROM registrationKeys
   WHERE packageId IS NOT NULL AND activatedAt IS NOT NULL AND orderId IS NULL AND price > 0
  ) AS activated_manual_priced_package_keys,
  (SELECT COUNT(*) FROM registrationKeys k
   WHERE k.activatedAt IS NULL AND k.isActive = 1 AND EXISTS (
     SELECT 1 FROM order_payment_confirmations c WHERE c.order_id = k.orderId
   )) AS unused_active_keys_for_confirmed_orders,
  (SELECT COUNT(*) FROM account_refunds) AS account_refunds,
  (SELECT COUNT(*) FROM account_refunds r WHERE NOT EXISTS (
     SELECT 1 FROM financial_ledger_entries l
     WHERE l.entry_type = 'refund' AND l.status = 'approved' AND l.refund_id = r.id
   )) AS refunds_without_approved_refund_entry,
  (SELECT COUNT(*) FROM financial_reconciliation_items) AS financial_reconciliation_items,
  (SELECT COUNT(*) FROM legacy_customer_migrations) AS legacy_customer_migrations,
  (SELECT COUNT(*) FROM financial_ledger_entries
   WHERE status = 'approved' AND entry_type IN ('adjustment', 'reversal')
  ) AS approved_corrections_or_reversals,
  (SELECT COUNT(*) FROM orders WHERE isGift = 1) AS gift_orders;
