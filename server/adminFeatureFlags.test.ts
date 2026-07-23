import { describe, expect, it } from "vitest";
import {
  ADMIN_FEATURE_FLAG_KEYS,
  getAdminFeatureFlagUpdates,
} from "../shared/featureFlags";

describe("admin feature flag controls", () => {
  it("exposes every phased feature through the typed admin control list", () => {
    expect(ADMIN_FEATURE_FLAG_KEYS).toEqual([
      "staff_performance_enabled",
      "student_surveys_enabled",
      "student_surveys_blocking_enabled",
      "loyalty_rewards_enabled",
      "student_community_enabled",
      "student_job_eligibility_enabled",
    ]);
  });

  it("turns survey blocking off when surveys are disabled", () => {
    expect(getAdminFeatureFlagUpdates("student_surveys_enabled", false)).toEqual([
      { key: "student_surveys_enabled", enabled: false },
      { key: "student_surveys_blocking_enabled", enabled: false },
    ]);
  });

  it("does not modify unrelated flags", () => {
    expect(getAdminFeatureFlagUpdates("student_community_enabled", true)).toEqual([
      { key: "student_community_enabled", enabled: true },
    ]);
  });
});
