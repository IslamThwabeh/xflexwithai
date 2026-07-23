export const ADMIN_FEATURE_FLAG_KEYS = [
  "staff_performance_enabled",
  "student_surveys_enabled",
  "student_surveys_blocking_enabled",
  "loyalty_rewards_enabled",
  "student_community_enabled",
  "student_job_eligibility_enabled",
] as const;

export type AdminFeatureFlagKey = typeof ADMIN_FEATURE_FLAG_KEYS[number];

/**
 * Return every setting update required for one safe feature-toggle action.
 * Survey blocking is automatically turned off with surveys so it cannot be
 * reactivated unexpectedly when surveys are enabled again later.
 */
export function getAdminFeatureFlagUpdates(
  key: AdminFeatureFlagKey,
  enabled: boolean,
): Array<{ key: AdminFeatureFlagKey; enabled: boolean }> {
  if (key === "student_surveys_enabled" && !enabled) {
    return [
      { key, enabled: false },
      { key: "student_surveys_blocking_enabled", enabled: false },
    ];
  }

  return [{ key, enabled }];
}
