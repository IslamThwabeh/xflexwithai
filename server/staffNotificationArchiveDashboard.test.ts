import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/AdminNotifications.tsx", import.meta.url)),
  "utf8",
);

describe("staff notification archive UI", () => {
  it("loads bounded archive pages only while the archive tab is active", () => {
    expect(source).toContain("trpc.staffNotifications.archive.useQuery");
    expect(source).toContain("STAFF_NOTIFICATION_ARCHIVE_PAGE_SIZE = 25");
    expect(source).toContain("{ enabled: tab === 'archive', retry: false }");
    expect(source).toContain("enabled: tab === 'alerts'");
  });

  it("keeps archive history read-only and separate from active mutations", () => {
    const archiveSection = source.slice(
      source.indexOf("Tab: Archived staff alerts"),
      source.indexOf("Tab: Send to Students"),
    );
    expect(archiveSection).toContain("Archived alert history");
    expect(archiveSection).toContain("archivedAlerts.items.map");
    expect(archiveSection).not.toContain("markRead.mutate");
    expect(archiveSection).not.toContain("markAllRead.mutate");
  });
});
