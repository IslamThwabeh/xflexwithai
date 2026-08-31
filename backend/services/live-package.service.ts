import { ENV } from "../_core/env";

export const LIVE_PACKAGE_SLUG = "live-package";
export const LIVE_PACKAGE_SETTING_KEYS = {
  adminVisible: "package_live_admin_visible",
  purchaseApproved: "package_live_purchase_approved",
  lifecycle: "package_live_lifecycle",
  cohortKey: "package_live_cohort_key",
  salesStartsAt: "package_live_sales_starts_at",
  salesEndsAt: "package_live_sales_ends_at",
  sessionStartsAt: "package_live_session_starts_at",
  sessionEndsAt: "package_live_session_ends_at",
  recordingPolicy: "package_live_recording_policy",
  recordingAccessEndsAt: "package_live_recording_access_ends_at",
} as const;

export const LIVE_PACKAGE_LIFECYCLES = [
  "coming_soon",
  "active",
  "expired",
] as const;
export const LIVE_PACKAGE_RECORDING_POLICIES = [
  "permanent",
  "until_date",
] as const;

export type LivePackageLifecycle = (typeof LIVE_PACKAGE_LIFECYCLES)[number];
export type LivePackageRecordingPolicy =
  (typeof LIVE_PACKAGE_RECORDING_POLICIES)[number];

export type LivePackageConfig = {
  deploymentEnabled: boolean;
  adminVisible: boolean;
  purchaseApproved: boolean;
  lifecycle: LivePackageLifecycle;
  cohortKey: string;
  salesStartsAt: string;
  salesEndsAt: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  recordingPolicy: LivePackageRecordingPolicy;
  recordingAccessEndsAt: string | null;
};

const isTrue = (value: string | null | undefined) =>
  value?.trim().toLowerCase() === "true";
const isValidDate = (value: string | null | undefined) =>
  Boolean(value && Number.isFinite(Date.parse(value)));

export const isLivePackageDeploymentEnabled = () =>
  ENV.packageLiveDeploymentEnabled;

export function parseLivePackageConfig(
  settings: Record<string, string>,
  deploymentEnabled = isLivePackageDeploymentEnabled()
): LivePackageConfig {
  const lifecycle = settings[
    LIVE_PACKAGE_SETTING_KEYS.lifecycle
  ] as LivePackageLifecycle;
  const recordingPolicy = settings[
    LIVE_PACKAGE_SETTING_KEYS.recordingPolicy
  ] as LivePackageRecordingPolicy;
  const recordingAccessEndsAt =
    settings[LIVE_PACKAGE_SETTING_KEYS.recordingAccessEndsAt]?.trim() || null;
  return {
    deploymentEnabled,
    adminVisible: isTrue(settings[LIVE_PACKAGE_SETTING_KEYS.adminVisible]),
    purchaseApproved: isTrue(
      settings[LIVE_PACKAGE_SETTING_KEYS.purchaseApproved]
    ),
    lifecycle: LIVE_PACKAGE_LIFECYCLES.includes(lifecycle)
      ? lifecycle
      : "coming_soon",
    cohortKey:
      settings[LIVE_PACKAGE_SETTING_KEYS.cohortKey]?.trim() || "live-2026",
    salesStartsAt:
      settings[LIVE_PACKAGE_SETTING_KEYS.salesStartsAt] ||
      "2026-09-03T21:00:00.000Z",
    salesEndsAt:
      settings[LIVE_PACKAGE_SETTING_KEYS.salesEndsAt] ||
      "2026-12-31T20:59:00.000Z",
    sessionStartsAt:
      settings[LIVE_PACKAGE_SETTING_KEYS.sessionStartsAt] ||
      "2026-09-04T21:00:00.000Z",
    sessionEndsAt:
      settings[LIVE_PACKAGE_SETTING_KEYS.sessionEndsAt] ||
      "2026-12-31T20:59:00.000Z",
    recordingPolicy: LIVE_PACKAGE_RECORDING_POLICIES.includes(recordingPolicy)
      ? recordingPolicy
      : "permanent",
    recordingAccessEndsAt,
  };
}

export function getLivePackageConfigurationErrors(input: {
  config: LivePackageConfig;
  packageRecord?: {
    packageType?: string;
    currency?: string;
    price?: number;
    renewalPrice?: number | null;
  } | null;
  assignedCourseCount: number;
}) {
  const { config, packageRecord, assignedCourseCount } = input;
  const errors: string[] = [];
  if (!packageRecord || packageRecord.packageType !== "live")
    errors.push("Live package row is missing or has the wrong type.");
  if (packageRecord?.currency !== "ILS" || packageRecord?.price !== 200000)
    errors.push("Live package price must be ILS 2,000.00 inclusive of VAT.");
  if ((packageRecord?.renewalPrice ?? 0) !== 0)
    errors.push("Live package cannot have a renewal price.");
  if (!config.cohortKey) errors.push("A cohort key is required.");
  for (const [label, value] of [
    ["Sales start", config.salesStartsAt],
    ["Sales end", config.salesEndsAt],
    ["Live start", config.sessionStartsAt],
    ["Live end", config.sessionEndsAt],
  ] as const) {
    if (!isValidDate(value)) errors.push(`${label} must be a valid timestamp.`);
  }
  if (
    isValidDate(config.salesStartsAt) &&
    isValidDate(config.salesEndsAt) &&
    Date.parse(config.salesStartsAt) >= Date.parse(config.salesEndsAt)
  ) {
    errors.push("Sales end must be after sales start.");
  }
  if (
    isValidDate(config.sessionStartsAt) &&
    isValidDate(config.sessionEndsAt) &&
    Date.parse(config.sessionStartsAt) >= Date.parse(config.sessionEndsAt)
  ) {
    errors.push("Live end must be after Live start.");
  }
  if (
    config.recordingPolicy === "until_date" &&
    !isValidDate(config.recordingAccessEndsAt)
  ) {
    errors.push(
      "A recording access end is required for the until-date policy."
    );
  }
  if (assignedCourseCount < 1)
    errors.push("Assign at least one base course before sales can open.");
  return errors;
}

export function getLivePackageAvailability(
  input: Parameters<typeof getLivePackageConfigurationErrors>[0] & {
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const errors = getLivePackageConfigurationErrors(input);
  const { config } = input;
  const deploymentEnabled = config.deploymentEnabled;
  const visible = deploymentEnabled && config.adminVisible;
  const withinSalesWindow =
    isValidDate(config.salesStartsAt) &&
    isValidDate(config.salesEndsAt) &&
    now.getTime() >= Date.parse(config.salesStartsAt) &&
    now.getTime() <= Date.parse(config.salesEndsAt);
  const purchasable =
    visible &&
    config.purchaseApproved &&
    config.lifecycle === "active" &&
    withinSalesWindow &&
    errors.length === 0;
  return {
    deploymentEnabled,
    visible,
    purchasable,
    withinSalesWindow,
    readiness: errors.length === 0,
    errors,
    lifecycle: config.lifecycle,
  };
}

export function isPublicStandardPackage(pkg: {
  packageType?: string;
  isPublished?: boolean | number;
}) {
  return (
    (pkg.packageType ?? "standard") === "standard" && Boolean(pkg.isPublished)
  );
}
