import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../frontend/src/pages/AdminPoints.tsx", import.meta.url),
  "utf8"
);
const layoutSource = readFileSync(
  new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url),
  "utf8"
);

describe("admin points safety UI", () => {
  it("does not use raw user ids or browser prompts for operator actions", () => {
    expect(source).not.toMatch(/\bprompt\s*\(/);
    expect(source).not.toContain("User ID");
    expect(source).toContain("points.searchStudents.useQuery");
    expect(source).toContain("PointAdjustmentDialog");
  });

  it("routes rejection, fulfillment, and visibility changes through dialogs", () => {
    expect(source).toContain("RedemptionActionDialog");
    expect(source).toContain("RewardVisibilityDialog");
    expect(source).toContain(
      'setRedemptionAction({ action: "reject", request })'
    );
    expect(source).toContain(
      'setRedemptionAction({ action: "fulfill", request })'
    );
    expect(source).toContain("rejecting && note.trim().length === 0");
  });

  it("creates rewards as hidden drafts and links prelaunch setup to Feature Center", () => {
    expect(source).toContain(
      "createRewardMut.mutate({ ...payload, isActive: false })"
    );
    expect(source).toContain('setLocation("/admin/features")');
    expect(source).toContain(
      "Prepare the rewards catalog safely before launch"
    );
  });

  it("keeps prelaunch catalog preparation discoverable only through authorized staff paths", () => {
    expect(layoutSource).toContain(
      'staffRolesForAvailability.includes("loyalty_rewards_manager")'
    );
    expect(layoutSource).toContain(
      "return rewardsAvailability?.enabled === true || canPrepareRewards"
    );
    expect(layoutSource).toContain(
      "items: section.items.filter(item => accessiblePaths.has(item.path))"
    );
  });
});
