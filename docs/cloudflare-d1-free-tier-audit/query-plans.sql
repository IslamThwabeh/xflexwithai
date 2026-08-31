-- Read-only query-plan checks for the highest-volume D1 query families.
-- Placeholder values are intentionally generic; EXPLAIN QUERY PLAN does not
-- execute the underlying statements or change production data.

EXPLAIN QUERY PLAN
SELECT
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),
  SUM(CASE WHEN status = 'pending' AND nextAttemptAt <= '2026-08-24T00:00:00.000Z' THEN 1 ELSE 0 END),
  MIN(CASE WHEN status IN ('pending', 'failed', 'processing') THEN createdAt ELSE NULL END),
  MAX(sentAt)
FROM email_outbox;

EXPLAIN QUERY PLAN
SELECT
  SUM(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
    AND (threadStatus IS NULL OR threadStatus <> 'closed') THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
    AND NOT EXISTS (
      SELECT 1 FROM recommendationMessages child
      WHERE child.parentId = recommendationMessages.id AND child.type = 'result'
    ) THEN 1 ELSE 0 END)
FROM recommendationMessages;

EXPLAIN QUERY PLAN
SELECT id
FROM recommendationMessages
WHERE parentId IS NULL
  AND type = 'recommendation'
  AND (threadStatus IS NULL OR threadStatus <> 'closed')
ORDER BY createdAt DESC;

EXPLAIN QUERY PLAN
SELECT id
FROM recommendationMessages
WHERE parentId IN (1, 2, 3, 4, 5);

EXPLAIN QUERY PLAN
SELECT packageId
FROM registrationKeys
WHERE LOWER(email) = LOWER('example@example.com')
  AND activatedAt IS NOT NULL
  AND packageId IS NOT NULL
ORDER BY activatedAt DESC
LIMIT 1;

EXPLAIN QUERY PLAN
SELECT id
FROM staff_notifications
WHERE eventType = 'email_delivery_anomaly'
  AND actionUrl = '/admin/email-logs'
  AND createdAt >= '2026-08-24T00:00:00.000Z'
LIMIT 1;

EXPLAIN QUERY PLAN
SELECT courseId, progressPercentage, completedAt, isAdminSkipped
FROM enrollments
WHERE userId = 1 AND courseId IN (1);

EXPLAIN QUERY PLAN
SELECT id, courseId, titleEn, titleAr, videoUrl, duration, "order"
FROM episodes
WHERE courseId = 1
ORDER BY "order";

EXPLAIN QUERY PLAN
SELECT COUNT(*)
FROM user_notifications
WHERE user_id = 1 AND is_read = 0;
