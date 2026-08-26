import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../frontend/src/pages/AdminRecommendations.tsx", import.meta.url)
  ),
  "utf8"
);

describe("Admin recommendation open-thread polling", () => {
  it("polls every minute only for an authorized manager in a visible tab", () => {
    expect(source).toContain("const ADMIN_OPEN_THREADS_REFRESH_MS = 60_000");
    expect(source).toMatch(
      /recommendations\.openThreads\.useQuery\([\s\S]*?enabled:\s*canManageChannel[\s\S]*?canManageChannel\s*&&\s*isPageVisible\s*\?\s*ADMIN_OPEN_THREADS_REFRESH_MS\s*:\s*false[\s\S]*?refetchIntervalInBackground:\s*false[\s\S]*?refetchOnWindowFocus:\s*true[\s\S]*?retry:\s*false/
    );
  });

  it("refreshes immediately when a hidden manager tab becomes visible", () => {
    expect(source).toContain("refetch: refetchOpenThreadFeed");
    expect(source).toContain("void refetchOpenThreadFeed()");
  });

  it("preserves immediate mutation refreshes and protected adjacent cadences", () => {
    expect(source).toContain("utils.recommendations.openThreads.invalidate()");
    expect(source).toContain("const ADMIN_THREAD_SUMMARY_REFRESH_MS = 60_000");
    expect(source).toContain(
      "refetchInterval: canManageChannel ? 1000 : false"
    );
  });
});
