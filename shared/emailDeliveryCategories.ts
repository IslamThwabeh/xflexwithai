import type { AdminFeatureId } from "./adminFeatureCatalog";

export const EMAIL_DELIVERY_EVENT_CATEGORIES = [
  "recommendations",
  "support",
  "orders",
  "login",
  "lifecycle",
  "surveys",
  "rewards",
  "community",
  "jobs",
  "staff_performance",
  "system",
] as const;

export type EmailDeliveryEventCategory = typeof EMAIL_DELIVERY_EVENT_CATEGORIES[number];
export type EmailDeliveryCategoryFilter = "all" | EmailDeliveryEventCategory;

export const FEATURE_EMAIL_DELIVERY_CATEGORY = {
  "staff-performance": "staff_performance",
  "student-surveys": "surveys",
  "points-rewards": "rewards",
  "student-community": "community",
  "job-eligibility": "jobs",
} as const satisfies Record<string, EmailDeliveryEventCategory>;

const ADMIN_FEATURE_EMAIL_EVENT_PREFIX: Record<AdminFeatureId, string> = {
  "staff-performance": "staff_performance_admin_notification",
  "student-surveys": "student_survey_admin_notification",
  "points-rewards": "loyalty_reward_admin_notification",
  "student-community": "community_admin_notification",
  "job-eligibility": "job_eligibility_admin_notification",
};

export function getAdminFeatureNotificationEventType(
  featureId: AdminFeatureId | undefined,
  mode: "campaign" | "test",
): string {
  if (!featureId) {
    return mode === "test" ? "admin_notification_test" : "admin_bulk_notification";
  }
  const prefix = ADMIN_FEATURE_EMAIL_EVENT_PREFIX[featureId];
  return mode === "test" ? `${prefix}_test` : prefix;
}

export function getEmailDeliveryEventCategory(eventType: string): EmailDeliveryEventCategory {
  if (eventType.startsWith("student_survey")) return "surveys";
  if (eventType.startsWith("loyalty_reward")) return "rewards";
  if (eventType.startsWith("community_")) return "community";
  if (eventType.startsWith("job_eligibility")) return "jobs";
  if (eventType.startsWith("staff_performance")) return "staff_performance";
  if (eventType.startsWith("recommendation") || eventType === "trade_result") return "recommendations";
  if (
    eventType.includes("support") ||
    (eventType.startsWith("lexai") && !eventType.startsWith("lexai_expiry")) ||
    eventType === "human_escalation"
  ) return "support";
  if (eventType.includes("order") || eventType.includes("payment")) return "orders";
  if (eventType.includes("login") || eventType.includes("otp")) return "login";
  if (
    eventType.includes("expiry") ||
    eventType.includes("expiring") ||
    eventType.includes("subscription") ||
    eventType.includes("renewal") ||
    eventType.includes("welcome") ||
    eventType.includes("drip") ||
    eventType.includes("milestone") ||
    eventType.includes("inactivity") ||
    eventType.includes("onboarding") ||
    eventType.includes("quiz") ||
    eventType.includes("freeze") ||
    eventType.startsWith("timed_service") ||
    eventType.startsWith("lexai_expiry")
  ) return "lifecycle";
  return "system";
}
