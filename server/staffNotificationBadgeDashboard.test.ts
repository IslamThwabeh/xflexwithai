import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url)),
  "utf8",
);

describe("Dashboard staff notification badges", () => {
  it("uses one combined badge endpoint at the existing cadence", () => {
    expect(source).toContain("trpc.staffNotifications.badgeCounts.useQuery");
    expect(source).toContain("refetchInterval: canReadStaffNotifications ? 30_000 : false");
    expect(source).toContain("staffNotificationBadges?.byRoute");
    expect(source).toContain("staffNotificationBadges?.total ?? 0");
    expect(source).not.toContain("trpc.staffNotifications.unreadCount.useQuery");
    expect(source).not.toContain("trpc.staffNotifications.countByRoute.useQuery");
  });

  it("refreshes the combined badge result after route notifications are read", () => {
    expect(source).toContain("utils.staffNotifications.badgeCounts.invalidate()");
  });
});
