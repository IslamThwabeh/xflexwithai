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

-- The production AFTER UPDATE trigger writes the single append-only audit row.
-- Restrict the update so rerunning the migration does not rewrite timestamps.
UPDATE registrationKeys
SET expiresAt = NULL,
    configurationNotes = 'Live entitlement is cohort-based; manual registration state does not expire issued keys.',
    configurationUpdatedAt = datetime('now'),
    configurationUpdatedByType = 'system',
    configurationUpdatedById = 0
WHERE packageId = (SELECT id FROM packages WHERE slug = 'live-package')
  AND activatedAt IS NULL
  AND (
    expiresAt IS NOT NULL
    OR configurationNotes IS NOT 'Live entitlement is cohort-based; manual registration state does not expire issued keys.'
  );
