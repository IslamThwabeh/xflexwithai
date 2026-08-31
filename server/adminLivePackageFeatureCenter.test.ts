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

  it("controls appearance and purchasing independently behind confirmation", () => {
    expect(source).toContain("packages.updateLiveConfig.useMutation");
    expect(source).toContain('control: "visibility"');
    expect(source).toContain('control: "purchasing"');
    expect(source).toContain("Confirm website visibility");
    expect(source).toContain("Confirm opening purchases");
    expect(source).toContain(
      "The package will appear on the website as Coming Soon"
    );
    expect(source).toContain("const purchaseApproved = changesVisibility");
    expect(source).toContain(
      'lifecycle: purchaseApproved ? "active" : "coming_soon"'
    );
  });

  it("keeps activation blocked until the package and owner decisions are ready", () => {
    expect(source).toContain("livePackageActivationBlocked");
    expect(source).toContain("availability.deploymentEnabled");
    expect(source).toContain("availability.readiness");
    expect(source).toContain("LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length");
  });

  it("includes Live Package in the Feature Center headline total", () => {
    expect(source).toContain(
      "const trackedFeatureCount = ADMIN_FEATURE_CATALOG.length + 1"
    );
    expect(source).toContain(
      "const trackedEnabledCount = enabledCount + Number(livePackageVisible)"
    );
    expect(source).toContain("`${trackedEnabledCount}/${trackedFeatureCount}`");
  });
});
