-- One bounded historical retention batch. Repeat with reconciliation.
UPDATE email_delivery_logs
SET subject='', error_message=NULL, metadata=NULL
WHERE id IN (SELECT id FROM email_delivery_logs INDEXED BY idx_email_delivery_logs_created_retention
  WHERE datetime(created_at)<datetime('now','-7 days')
    AND (subject<>'' OR error_message IS NOT NULL OR metadata IS NOT NULL)
  ORDER BY created_at,id LIMIT 500);

UPDATE email_provider_webhook_events
SET diagnostic=NULL
WHERE id IN (SELECT id FROM email_provider_webhook_events INDEXED BY idx_email_provider_events_received_retention
  WHERE datetime(received_at)<datetime('now','-7 days') AND diagnostic IS NOT NULL
  ORDER BY received_at,id LIMIT 500);

DELETE FROM email_delivery_logs WHERE id IN (
  SELECT id FROM email_delivery_logs INDEXED BY idx_email_delivery_logs_created_retention
  WHERE datetime(created_at)<datetime('now','-30 days')
    AND status NOT IN ('complained','bounced_hard','bounced_soft','deferred','rejected','failed')
    AND lower(event_type) NOT LIKE '%login%' AND lower(event_type) NOT LIKE '%otp%'
    AND lower(event_type) NOT LIKE '%auth%' AND lower(event_type) NOT LIKE '%password%'
    AND lower(event_type) NOT LIKE '%security%'
  ORDER BY created_at,id LIMIT 500);

DELETE FROM email_delivery_logs WHERE id IN (
  SELECT id FROM email_delivery_logs INDEXED BY idx_email_delivery_logs_created_retention
  WHERE datetime(created_at)<datetime('now','-180 days')
  ORDER BY created_at,id LIMIT 500);

DELETE FROM email_provider_webhook_events WHERE id IN (
  SELECT id FROM email_provider_webhook_events INDEXED BY idx_email_provider_events_received_retention
  WHERE datetime(received_at)<datetime('now','-30 days')
    AND COALESCE(delivery_status,'') NOT IN ('complained','bounced_hard','bounced_soft','deferred','rejected','failed')
  ORDER BY received_at,id LIMIT 500);

DELETE FROM email_provider_webhook_events WHERE id IN (
  SELECT id FROM email_provider_webhook_events INDEXED BY idx_email_provider_events_received_retention
  WHERE datetime(received_at)<datetime('now','-180 days')
  ORDER BY received_at,id LIMIT 500);
