import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url)),
  "utf8",
);

describe("Dashboard staff notification badges", () => {
  it("uses one combined badge endpoint at the Free-plan cadence", () => {
    expect(source).toContain("trpc.staffNotifications.badgeCounts.useQuery");
    expect(source).toContain(
      "canReadStaffNotifications && isPageVisible ? 120_000 : false",
    );
    expect(source).toContain("staffNotificationBadges?.byRoute");
    expect(source).toContain("staffNotificationBadges?.total ?? 0");
    expect(source).not.toContain("trpc.staffNotifications.unreadCount.useQuery");
    expect(source).not.toContain("trpc.staffNotifications.countByRoute.useQuery");
  });

  it("refreshes the combined badge result after route notifications are read", () => {
    expect(source).toContain("utils.staffNotifications.badgeCounts.invalidate()");
  });

  it("pauses polling while hidden and refreshes when the dashboard becomes visible", () => {
    expect(source).toContain("document.visibilityState === \"visible\"");
    expect(source).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(source).toContain('document.removeEventListener("visibilitychange", handleVisibilityChange)');
    expect(source).toContain(
      "canReadStaffNotifications && isPageVisible ? 120_000 : false",
    );
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: true");
    expect(source).toContain("void refetchStaffNotificationBadges()");
  });
});
