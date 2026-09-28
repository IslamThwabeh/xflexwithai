-- Migration 121: include the core course with Package Live and correct Jumaa's
-- misclassified ILS 2,000 sale. The correction is deliberately guarded by the
-- exact user, email, order, key, and original Comprehensive package values.

INSERT OR IGNORE INTO packageCourses (packageId, courseId, displayOrder)
SELECT live.id, course.id, 1
FROM packages AS live
JOIN courses AS course ON course.id = 1
WHERE live.slug = 'live-package' AND live.packageType = 'live';

-- Backfill permanent paid-course ownership for every active Live client.
INSERT INTO enrollments (
  userId, courseId, enrolledAt, lastAccessed, progressPercentage,
  completedEpisodes, completedAt, paymentStatus, paymentAmount,
  paymentCurrency, isSubscriptionActive, subscriptionStartDate,
  subscriptionEndDate, registrationKeyId, activatedViaKey, isAdminSkipped
)
SELECT
  entitlement.userId,
  assigned.courseId,
  entitlement.createdAt,
  entitlement.createdAt,
  0,
  0,
  NULL,
  'completed',
  0,
  'ILS',
  1,
  entitlement.createdAt,
  NULL,
  entitlement.registrationKeyId,
  CASE WHEN entitlement.registrationKeyId IS NULL THEN 0 ELSE 1 END,
  0
FROM live_package_entitlements AS entitlement
JOIN packageCourses AS assigned ON assigned.packageId = entitlement.packageId
WHERE entitlement.isActive = 1
  AND NOT EXISTS (
    SELECT 1 FROM enrollments AS existing
    WHERE existing.userId = entitlement.userId
      AND existing.courseId = assigned.courseId
  );

-- Correct the commercial source: ILS 2,000 VAT-inclusive Package Live sale.
UPDATE orders
SET subtotal = 172414,
    discountAmount = 0,
    vatRate = 16,
    vatAmount = 27586,
    totalAmount = 200000,
    currency = 'ILS',
    isUpgrade = 0,
    upgradeFromPackageId = NULL,
    transactionPurpose = 'new_sale',
    notes = CASE
      WHEN notes IS NULL OR trim(notes) = '' THEN 'Corrected from Comprehensive to Package Live: verified ILS 2,000 payment.'
      ELSE notes || ' | Corrected from Comprehensive to Package Live: verified ILS 2,000 payment.'
    END,
    updatedAt = datetime('now')
WHERE id = 80
  AND userId = 146
  AND totalAmount = 50000
  AND currency = 'USD'
  AND EXISTS (SELECT 1 FROM users WHERE id = 146 AND lower(email) = 'jumaashuman@gmail.com');

INSERT INTO order_transaction_purpose_events (
  order_id, previous_purpose, next_purpose, actor_type, actor_id, reason, created_at
)
SELECT 80, NULL, 'new_sale', 'admin', 1,
  'Business owner confirmed ILS 2,000 Package Live sale; correcting prior Comprehensive classification.',
  datetime('now')
WHERE EXISTS (
  SELECT 1 FROM orders
  WHERE id = 80 AND userId = 146 AND transactionPurpose = 'new_sale'
)
AND NOT EXISTS (
  SELECT 1 FROM order_transaction_purpose_events
  WHERE order_id = 80 AND next_purpose = 'new_sale'
    AND reason LIKE 'Business owner confirmed ILS 2,000 Package Live sale%'
);

UPDATE orderItems
SET packageId = (SELECT id FROM packages WHERE slug = 'live-package'),
    courseId = NULL,
    priceAtPurchase = 200000,
    currency = 'ILS',
    transactionPurpose = 'new_sale'
WHERE id = 80
  AND orderId = 80
  AND packageId = (SELECT id FROM packages WHERE slug = 'comprehensive')
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id = 80 AND userId = 146 AND totalAmount = 200000 AND currency = 'ILS'
  );

UPDATE registrationKeys
SET packageId = (SELECT id FROM packages WHERE slug = 'live-package'),
    courseId = 0,
    price = 2000,
    currency = 'ILS',
    isUpgrade = 0,
    isRenewal = 0,
    transactionPurpose = 'new_sale',
    notes = 'Order #80 payment approved | Corrected from Comprehensive to Package Live after verified ILS 2,000 payment'
WHERE id = 172
  AND orderId = 80
  AND lower(email) = 'jumaashuman@gmail.com'
  AND packageId = (SELECT id FROM packages WHERE slug = 'comprehensive')
  AND EXISTS (
    SELECT 1 FROM orderItems
    WHERE id = 80 AND orderId = 80
      AND packageId = (SELECT id FROM packages WHERE slug = 'live-package')
  );

-- Remove only the entitlements derived from the misclassified Comprehensive key.
DELETE FROM lexaiSubscriptions
WHERE id = 74 AND userId = 146 AND isPendingActivation = 1
  AND createdAt = '2026-09-09 11:20:02';

DELETE FROM recommendationSubscriptions
WHERE id = 142 AND userId = 146 AND registrationKeyId = 172
  AND isPendingActivation = 1;

DELETE FROM packageSubscriptions
WHERE id = 100 AND userId = 146 AND orderId = 80
  AND packageId = (SELECT id FROM packages WHERE slug = 'comprehensive');

-- Jumaa's existing course enrollment is retained and now belongs to the Live key.
UPDATE enrollments
SET paymentStatus = 'completed',
    paymentAmount = 0,
    paymentCurrency = 'ILS',
    isSubscriptionActive = 1,
    registrationKeyId = 172,
    activatedViaKey = 1,
    subscriptionEndDate = NULL
WHERE id = 100 AND userId = 146 AND courseId = 1;

INSERT INTO live_package_entitlements (
  userId, packageId, registrationKeyId, orderId, cohortKey, accessSource,
  grantReason, grantedByAdminId, sessionStartsAt, sessionEndsAt,
  recordingPolicy, recordingAccessEndsAt, isActive, createdAt, updatedAt
)
SELECT
  146,
  live.id,
  172,
  80,
  COALESCE((SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_cohort_key'), 'live-2026'),
  'purchase',
  'Corrected from Comprehensive after verification of ILS 2,000 Package Live payment',
  1,
  COALESCE((SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_session_starts_at'), ''),
  COALESCE((SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_session_ends_at'), ''),
  COALESCE((SELECT NULLIF(settingValue, '') FROM admin_settings WHERE settingKey = 'package_live_recording_policy'), 'permanent'),
  NULLIF((SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_recording_access_ends_at'), ''),
  1,
  COALESCE((SELECT activatedAt FROM registrationKeys WHERE id = 172), datetime('now')),
  datetime('now')
FROM packages AS live
WHERE live.slug = 'live-package'
  AND EXISTS (
    SELECT 1 FROM registrationKeys
    WHERE id = 172 AND packageId = live.id AND orderId = 80
  )
  AND NOT EXISTS (
    SELECT 1 FROM live_package_entitlements
    WHERE registrationKeyId = 172
  );

INSERT INTO admin_actions (adminId, userId, action, details, createdAt)
SELECT 1, 146, 'correct_jumaa_package_and_accounting', json_object(
  'orderId', 80,
  'registrationKeyId', 172,
  'previousPackage', 'comprehensive',
  'correctedPackage', 'live-package',
  'grossAmountIlsMinor', 200000,
  'netAmountIlsMinor', 172414,
  'vatAmountIlsMinor', 27586,
  'removedLexaiSubscriptionId', 74,
  'removedRecommendationSubscriptionId', 142,
  'removedPackageSubscriptionId', 100,
  'reason', 'Business owner confirmed Jumaa paid ILS 2,000 for Package Live only'
), datetime('now')
WHERE EXISTS (
  SELECT 1 FROM live_package_entitlements
  WHERE userId = 146 AND registrationKeyId = 172 AND orderId = 80 AND isActive = 1
)
AND NOT EXISTS (
  SELECT 1 FROM admin_actions
  WHERE userId = 146 AND action = 'correct_jumaa_package_and_accounting'
);

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES (
  '121_live_course_access_and_jumaa_sale_correction.sql',
  'codex_local_release',
  'Adds permanent assigned-course access to Package Live and audits the owner-approved correction of order #80 to an ILS 2,000 Live sale.'
);
