-- Migration 122: recognize Jumaa's owner-confirmed ILS 2,000 Package Live
-- payment after migration 121 corrected the commercial source records.

INSERT INTO order_payment_confirmations (
  order_id, paid_at, payment_method, payment_reference, rationale,
  evidence_metadata, confirmed_by_type, confirmed_by_id, source_type,
  source_reference, transaction_purpose, created_at
)
SELECT
  orders.id,
  orders.completedAt,
  orders.paymentMethod,
  orders.paymentReference,
  'Business owner confirmed ILS 2,000 payment for Package Live; source sale corrected from Comprehensive.',
  json_object('evidenceType', 'order_payment_proof', 'orderPaymentProofUrl', orders.paymentProofUrl),
  'admin',
  1,
  'order_payment_new_sale',
  'order:80',
  'new_sale',
  datetime('now')
FROM orders
WHERE orders.id = 80
  AND orders.userId = 146
  AND orders.status = 'completed'
  AND orders.totalAmount = 200000
  AND orders.currency = 'ILS'
  AND orders.transactionPurpose = 'new_sale'
  AND orders.completedAt IS NOT NULL
  AND orders.paymentProofUrl IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM order_payment_confirmations WHERE order_id = orders.id
  );

INSERT INTO financial_ledger_entries (
  entry_type, status, effective_at, reporting_month, amount_minor, currency,
  base_amount_ils_minor, exchange_rate, exchange_rate_source, order_id,
  order_item_id, registration_key_id, source_type, source_reference,
  payment_method, payment_reference, description, internal_notes, reason,
  evidence_metadata, created_by_type, created_by_id, submitted_by_type,
  submitted_by_id, approved_by_type, approved_by_id, approved_at,
  audit_metadata, transaction_purpose, created_at
)
SELECT
  'payment',
  'approved',
  confirmation.paid_at,
  substr(confirmation.paid_at, 1, 7),
  200000,
  'ILS',
  200000,
  NULL,
  NULL,
  80,
  80,
  172,
  'order_payment_new_sale',
  'order:80',
  confirmation.payment_method,
  confirmation.payment_reference,
  'Confirmed Package Live payment for order #80',
  'Corrected from Comprehensive after business-owner verification.',
  confirmation.rationale,
  confirmation.evidence_metadata,
  'admin',
  1,
  'admin',
  1,
  'admin',
  1,
  datetime('now'),
  json_object(
    'financialEventVersion', 1,
    'orderStatusAtConfirmation', 'completed',
    'originalMisclassifiedAmountMinor', 50000,
    'originalMisclassifiedCurrency', 'USD',
    'correctedPackage', 'live-package',
    'ownerConfirmed', 1
  ),
  'new_sale',
  datetime('now')
FROM order_payment_confirmations AS confirmation
WHERE confirmation.order_id = 80
  AND confirmation.transaction_purpose = 'new_sale'
  AND NOT EXISTS (
    SELECT 1 FROM financial_ledger_entries
    WHERE source_type = 'order_payment_new_sale'
      AND source_reference = 'order:80'
  );

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '122_jumaa_live_payment_confirmation.sql',
  'codex_local_release',
  'Recognizes the owner-confirmed ILS 2,000 Package Live payment for corrected order #80 in the immutable cash-basis ledger.'
);
