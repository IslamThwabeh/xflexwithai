export const EMAIL_DELIVERY_CLASSES = ["critical", "urgent", "bulk"] as const;
export type EmailDeliveryClass = (typeof EMAIL_DELIVERY_CLASSES)[number];

const BULK_EVENT_TYPES = new Set([
  "admin_bulk_notification",
  "student_community_post_published",
  "student_survey_assigned",
  "student_survey_reminder",
  "live_session_reminder",
]);

const CRITICAL_EVENT_TYPES = new Set([
  "billing_balance_reminder",
  "outstanding_balance_notice",
  "timed_service_activation",
  "timed_service_activation_reminder",
]);

/**
 * Keep delivery policy centralized so producers, campaign materialization, and
 * queue claims cannot silently disagree about which capacity a message uses.
 * Unknown transactional events fail toward the urgent lane; they must never be
 * delayed behind a bulk campaign merely because a new event was introduced.
 */
export function classifyEmailDelivery(input: {
  eventType: string;
  emailCategory?: "transactional" | "service_lifecycle" | "marketing" | null;
}): EmailDeliveryClass {
  if (BULK_EVENT_TYPES.has(input.eventType) || input.emailCategory === "marketing") {
    return "bulk";
  }
  if (
    CRITICAL_EVENT_TYPES.has(input.eventType)
    || /(?:login|security|payment|billing)/i.test(input.eventType)
  ) return "critical";
  return "urgent";
}
