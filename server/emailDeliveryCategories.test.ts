import { describe, expect, it } from "vitest";
import {
  EMAIL_DELIVERY_EVENT_CATEGORIES,
  FEATURE_EMAIL_DELIVERY_CATEGORY,
  getAdminFeatureNotificationEventType,
  getEmailDeliveryEventCategory,
} from "../shared/emailDeliveryCategories";

describe("email delivery feature categories", () => {
  it("provides a dedicated category for every admin feature", () => {
    expect(FEATURE_EMAIL_DELIVERY_CATEGORY).toEqual({
      "staff-performance": "staff_performance",
      "student-surveys": "surveys",
      "points-rewards": "rewards",
      "student-community": "community",
      "job-eligibility": "jobs",
    });
    for (const category of Object.values(FEATURE_EMAIL_DELIVERY_CATEGORY)) {
      expect(EMAIL_DELIVERY_EVENT_CATEGORIES).toContain(category);
    }
  });

  it.each([
    ["student_survey_submitted", "surveys"],
    ["loyalty_reward_requested", "rewards"],
    ["community_client_reply", "community"],
    ["job_eligibility_review_requested", "jobs"],
    ["staff_performance_submitted", "staff_performance"],
    ["lexai_case_assigned", "support"],
    ["lexai_expiry_soon", "lifecycle"],
  ] as const)("classifies %s as %s", (eventType, expected) => {
    expect(getEmailDeliveryEventCategory(eventType)).toBe(expected);
  });

  it.each([
    ["staff-performance", "staff_performance", "staff_performance_admin_notification_test"],
    ["student-surveys", "surveys", "student_survey_admin_notification_test"],
    ["points-rewards", "rewards", "loyalty_reward_admin_notification_test"],
    ["student-community", "community", "community_admin_notification_test"],
    ["job-eligibility", "jobs", "job_eligibility_admin_notification_test"],
  ] as const)("keeps %s campaign and test delivery visible in %s logs", (featureId, category, testEventType) => {
    const campaignEventType = getAdminFeatureNotificationEventType(featureId, "campaign");
    expect(getEmailDeliveryEventCategory(campaignEventType)).toBe(category);
    expect(getAdminFeatureNotificationEventType(featureId, "test")).toBe(testEventType);
    expect(getEmailDeliveryEventCategory(testEventType)).toBe(category);
  });
});
