import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../frontend/src/pages/AdminFeatureCenter.tsx", import.meta.url),
  "utf8"
);

describe("Live Package in Admin Feature Center", () => {
  it("shows the admin-only preview and owner decision progress", () => {
    expect(source).toContain('data-feature-id="live-package"');
    expect(source).toContain("packages.liveAdminPreview.useQuery");
    expect(source).toContain("livePackageOwnerReview.get.useQuery");
    expect(source).toContain(
      "Admin preview—this view does not publish the package"
    );
    expect(source).toContain('setLocation("/admin/live-package-review")');
    expect(source).toContain('setLocation("/admin/live-package")');
  });

  it("uses the audited Live Package configuration mutation behind confirmation", () => {
    expect(source).toContain("packages.updateLiveConfig.useMutation");
    expect(source).toContain("Confirm Live Package activation");
    expect(source).toContain("Confirm Live Package deactivation");
    expect(source).toContain("adminVisible: pendingLivePackageChange.enabled");
    expect(source).toContain(
      "purchaseApproved: pendingLivePackageChange.enabled"
    );
    expect(source).toContain('? "active"');
    expect(source).toContain(': "coming_soon"');
  });

  it("keeps activation blocked until the package and owner decisions are ready", () => {
    expect(source).toContain("livePackageActivationBlocked");
    expect(source).toContain("availability.deploymentEnabled");
    expect(source).toContain("availability.readiness");
    expect(source).toContain("LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length");
  });
});
