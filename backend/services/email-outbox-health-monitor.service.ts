import * as db from "../db";

export type ScheduledEmailOutboxHealthResult = {
  anomalyDetected: boolean;
  notificationAttempted: boolean;
};

/**
 * Keep the minute scheduler's normal path index-only. The detailed aggregate
 * remains available for the admin screen and is loaded here only when the
 * bounded probe finds a stale pending row or a dead letter.
 */
export async function checkScheduledEmailOutboxHealth(
  staleAfterMinutes: number = 5,
): Promise<ScheduledEmailOutboxHealthResult> {
  const anomalyDetected = await db.hasEmailOutboxAnomaly(staleAfterMinutes);
  if (!anomalyDetected) {
    return { anomalyDetected: false, notificationAttempted: false };
  }

  const health = await db.getEmailOutboxHealth(staleAfterMinutes);
  if (health.staleDuePending <= 0 && health.deadLetter <= 0) {
    return { anomalyDetected: false, notificationAttempted: false };
  }

  await db.notifyStaffByEvent("email_delivery_anomaly", {
    titleEn: `Email outbox delay detected (${health.staleDuePending} stale due)`,
    titleAr: `تم رصد تأخير في صندوق البريد (${health.staleDuePending} مستحقة ومتأخرة)`,
    contentEn: `${health.duePending} due pending, ${health.failedDue} failed due for retry, ${health.deadLetter} dead-lettered. Oldest pending: ${health.oldestPendingCreatedAt || "none"}.`,
    contentAr: `${health.duePending} رسائل مستحقة، ${health.failedDue} فاشلة مستحقة لإعادة المحاولة، ${health.deadLetter} فاشلة نهائياً. أقدم رسالة معلقة: ${health.oldestPendingCreatedAt || "لا يوجد"}.`,
    metadata: health,
  }).catch(() => {});

  return { anomalyDetected: true, notificationAttempted: true };
}
