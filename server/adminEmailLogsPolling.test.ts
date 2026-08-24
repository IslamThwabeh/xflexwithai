import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/AdminEmailLogs.tsx", import.meta.url)),
  "utf8",
);

describe("Admin Email Logs outbox-health polling", () => {
  it("polls the detailed health query every five minutes only while visible", () => {
    expect(source).toContain("const OUTBOX_HEALTH_REFRESH_MS = 5 * 60_000");
    expect(source).toContain("document.visibilityState === 'visible'");
    expect(source).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)");
    expect(source).toContain("document.removeEventListener('visibilitychange', handleVisibilityChange)");
    expect(source).toContain(
      "refetchInterval: isAdmin && isPageVisible ? OUTBOX_HEALTH_REFRESH_MS : false",
    );
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: true");
    expect(source).not.toContain("refetchInterval: 60000");
  });

  it("still refreshes detailed health immediately after a manual drain", () => {
    expect(source).toContain("utils.adminEmail.outboxHealth.invalidate()");
    expect(source).toContain("utils.adminEmail.deliveryLogs.invalidate()");
    expect(source).toContain("utils.adminEmail.deliveryLogSummary.invalidate()");
  });
});
