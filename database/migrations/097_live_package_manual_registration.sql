-- Phase A: registration is an explicit admin decision, independent of dates.
-- INSERT OR IGNORE intentionally preserves any previously chosen production state.
INSERT OR IGNORE INTO admin_settings (settingKey, settingValue) VALUES
  ('package_live_registration_open', 'false'),
  ('package_live_target_subscriber_count', ''),
  ('package_live_cohort_status', 'not_started');

UPDATE admin_settings
SET settingValue = 'permanent',
    updatedAt = datetime('now')
WHERE settingKey = 'package_live_recording_policy';

UPDATE live_package_entitlements
SET recordingPolicy = 'permanent',
    recordingAccessEndsAt = NULL,
    updatedAt = datetime('now')
WHERE recordingPolicy <> 'permanent' OR recordingAccessEndsAt IS NOT NULL;

-- Live is its own product entitlement. It must not grant or depend on courses.
DELETE FROM packageCourses
WHERE packageId = (SELECT id FROM packages WHERE slug = 'live-package');

UPDATE packages
SET descriptionEn = 'A standalone cohort-based Live program with scheduled sessions and permanent access to published recordings unless access is explicitly revoked.',
    descriptionAr = 'برنامج لايف مستقل قائم على فوج واحد، يشمل اللقاءات المجدولة ووصولاً دائماً إلى التسجيلات المنشورة ما لم يُلغَ الوصول صراحةً.',
    updatedAt = datetime('now')
WHERE slug = 'live-package';

-- Issued Live keys remain redeemable after registration closes. Preserve an
-- append-only configuration record before removing the legacy sales cutoff.
INSERT INTO package_key_configuration_history (
  key_id, order_id, actor_type, actor_id,
  previous_entitlement_days, new_entitlement_days,
  previous_expires_at, new_expires_at,
  previous_configuration_notes, new_configuration_notes,
  reason, created_at
)
SELECT
  registrationKeys.id, registrationKeys.orderId, 'system', 0,
  registrationKeys.entitlementDays, registrationKeys.entitlementDays,
  registrationKeys.expiresAt, NULL,
  registrationKeys.configurationNotes,
  'Live entitlement is cohort-based; manual registration state does not expire issued keys.',
  'Phase A removed the legacy Live enrollment cutoff from issued keys.',
  datetime('now')
FROM registrationKeys
JOIN packages ON packages.id = registrationKeys.packageId
WHERE packages.slug = 'live-package'
  AND registrationKeys.activatedAt IS NULL
  AND registrationKeys.expiresAt IS NOT NULL;

UPDATE registrationKeys
SET expiresAt = NULL,
    configurationNotes = 'Live entitlement is cohort-based; manual registration state does not expire issued keys.',
    configurationUpdatedAt = datetime('now'),
    configurationUpdatedByType = 'system',
    configurationUpdatedById = 0
WHERE packageId = (SELECT id FROM packages WHERE slug = 'live-package')
  AND activatedAt IS NULL;
