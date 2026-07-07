-- Migration 062: Admin broker report and admin password rotation
-- Additive only: token invalidation timestamp plus indexes for broker reporting/review paging.

ALTER TABLE admins ADD COLUMN passwordChangedAt TEXT;

CREATE INDEX IF NOT EXISTS idx_broker_onboarding_report_step_status_broker_reviewed
  ON broker_onboarding(step, status, brokerId, reviewedAt);

CREATE INDEX IF NOT EXISTS idx_broker_onboarding_status_updated
  ON broker_onboarding(status, updatedAt);

CREATE INDEX IF NOT EXISTS idx_broker_onboarding_broker_step_status
  ON broker_onboarding(brokerId, step, status);
