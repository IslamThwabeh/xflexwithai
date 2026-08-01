import { describe, expect, it } from "vitest";
import {
  ADMIN_FEATURE_CATALOG,
  ADMIN_FEATURE_IDS,
  canViewAdminFeatureNavigation,
  getAdminFeatureByPath,
} from "../shared/adminFeatureCatalog";
import { ADMIN_FEATURE_FLAG_KEYS } from "../shared/featureFlags";
import { ROLE_PAGE_ACCESS } from "../shared/const";

describe("admin feature catalog", () => {
  it("keeps every business feature id, route, overview key, and flag unique", () => {
    expect(ADMIN_FEATURE_CATALOG.map(feature => feature.id)).toEqual(
      ADMIN_FEATURE_IDS
    );

    for (const field of [
      "adminPath",
      "previewPath",
      "overviewKey",
      "flagKey",
    ] as const) {
      const values = ADMIN_FEATURE_CATALOG.map(feature => feature[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("maps every feature to an audited flag and a role that can open its page", () => {
    for (const feature of ADMIN_FEATURE_CATALOG) {
      expect(ADMIN_FEATURE_FLAG_KEYS).toContain(feature.flagKey);
      expect(ROLE_PAGE_ACCESS[feature.managerRole]).toContain(
        feature.adminPath
      );
      expect(getAdminFeatureByPath(feature.adminPath)).toBe(feature);
      expect(feature.previewPath).toBe(
        `${feature.adminPath}?preview=${feature.id === "staff-performance" ? "employee" : "student"}`
      );
    }
  });

  it("keeps disabled admin workspaces discoverable for admins and assigned feature managers", () => {
    const feature = ADMIN_FEATURE_CATALOG[0];

    expect(
      canViewAdminFeatureNavigation({
        feature,
        isAdmin: true,
        staffRoles: [],
        enabled: false,
      })
    ).toBe(true);

    expect(
      canViewAdminFeatureNavigation({
        feature,
        isAdmin: false,
        staffRoles: [feature.managerRole],
        enabled: false,
      })
    ).toBe(true);

    expect(
      canViewAdminFeatureNavigation({
        feature,
        isAdmin: false,
        staffRoles: ["support"],
        enabled: false,
      })
    ).toBe(false);
  });

  it("shows an enabled module only to staff with its matching manager role", () => {
    const feature = ADMIN_FEATURE_CATALOG[1];

    expect(
      canViewAdminFeatureNavigation({
        feature,
        isAdmin: false,
        staffRoles: [feature.managerRole],
        enabled: true,
      })
    ).toBe(true);

    expect(
      canViewAdminFeatureNavigation({
        feature,
        isAdmin: false,
        staffRoles: ["support"],
        enabled: true,
      })
    ).toBe(false);
  });
});
