-- Enrollment and Live-key redemption close together on September 30.
-- The cohort/session end remains December 31 and permanent content is unchanged.
UPDATE admin_settings
SET settingValue = '2026-09-30T20:59:00.000Z',
    updatedAt = datetime('now')
WHERE settingKey = 'package_live_sales_ends_at';
