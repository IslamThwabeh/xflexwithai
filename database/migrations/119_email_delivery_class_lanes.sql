-- Durable delivery lanes prevent bulk campaigns from consuming the indexed
-- claim path reserved for critical account mail and person-to-person replies.
ALTER TABLE email_outbox
  ADD COLUMN deliveryClass TEXT NOT NULL DEFAULT 'urgent'
  CHECK (deliveryClass IN ('critical', 'urgent', 'bulk'));

ALTER TABLE email_outbox_campaigns
  ADD COLUMN deliveryClass TEXT NOT NULL DEFAULT 'bulk'
  CHECK (deliveryClass IN ('critical', 'urgent', 'bulk'));

UPDATE email_outbox
SET deliveryClass = CASE
  WHEN eventType IN (
    'admin_bulk_notification',
    'student_community_post_published',
    'student_survey_assigned',
    'student_survey_reminder',
    'live_session_reminder'
  ) OR emailCategory = 'marketing' THEN 'bulk'
  WHEN eventType IN (
    'billing_balance_reminder',
    'outstanding_balance_notice',
    'timed_service_activation',
    'timed_service_activation_reminder'
  ) THEN 'critical'
  ELSE 'urgent'
END;

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_class_due
  ON email_outbox(status, deliveryClass, nextAttemptAt, createdAt, id);

CREATE INDEX IF NOT EXISTS idx_email_outbox_campaign_status_class_created
  ON email_outbox_campaigns(status, deliveryClass, createdAt, id);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '119_email_delivery_class_lanes.sql',
  'codex_local_release',
  'Adds durable critical, urgent, and bulk email lanes with indexed claim paths.'
);
