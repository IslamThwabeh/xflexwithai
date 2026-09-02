import { describe, expect, it } from "vitest";
import {
  getLivePackageAvailability,
  parseLivePackageConfig,
} from "../backend/services/live-package.service";

const settings = {
  package_live_admin_visible: "true",
  package_live_registration_open: "true",
  package_live_purchase_approved: "true",
  package_live_lifecycle: "active",
  package_live_cohort_key: "live-2026",
  package_live_sales_starts_at: "2026-09-03T21:00:00.000Z",
  package_live_sales_ends_at: "2026-09-30T20:59:00.000Z",
  package_live_session_starts_at: "2026-09-04T21:00:00.000Z",
  package_live_session_ends_at: "2026-12-31T20:59:00.000Z",
  package_live_recording_policy: "permanent",
  package_live_recording_access_ends_at: "",
};

const packageRecord = {
  packageType: "live",
  currency: "ILS",
  price: 200000,
  renewalPrice: 0,
};

describe("Live package availability", () => {
  it("has no hard-coded registration cutoff", () => {
    expect(parseLivePackageConfig({}, true).salesStartsAt).toBe("");
    expect(parseLivePackageConfig({}, true).salesEndsAt).toBe("");
  });

  it("cannot be visible or purchasable while the deployment switch is off", () => {
    const result = getLivePackageAvailability({
      config: parseLivePackageConfig(settings, false),
      packageRecord,
      assignedCourseCount: 1,
      now: new Date("2026-09-05T10:00:00.000Z"),
    });
    expect(result.visible).toBe(false);
    expect(result.purchasable).toBe(false);
  });

  it("keeps visibility separate from the manual registration switch", () => {
    const config = parseLivePackageConfig(
      { ...settings, package_live_registration_open: "false" },
      true
    );
    const result = getLivePackageAvailability({
      config,
      packageRecord,
      assignedCourseCount: 1,
      now: new Date("2026-09-05T10:00:00.000Z"),
    });
    expect(result.visible).toBe(true);
    expect(result.purchasable).toBe(false);
  });

  it("does not require or grant an assigned base course", () => {
    const config = parseLivePackageConfig(settings, true);
    const result = getLivePackageAvailability({
      config,
      packageRecord,
      assignedCourseCount: 0,
      now: new Date("2026-09-05T10:00:00.000Z"),
    });
    expect(result.purchasable).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("stays open across legacy sales dates until an admin closes it", () => {
    const config = parseLivePackageConfig(settings, true);
    expect(
      getLivePackageAvailability({
        config,
        packageRecord,
        assignedCourseCount: 1,
        now: new Date("2026-09-05T10:00:00.000Z"),
      }).purchasable
    ).toBe(true);
    expect(
      getLivePackageAvailability({
        config,
        packageRecord,
        assignedCourseCount: 1,
        now: new Date("2026-09-30T21:00:00.000Z"),
      }).purchasable
    ).toBe(true);
  });
});
