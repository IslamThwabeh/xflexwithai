import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../frontend/src/pages/Recommendations.tsx", import.meta.url)
  ),
  "utf8"
);

describe("Client recommendation open-thread polling", () => {
  it("polls at most every minute only for an eligible client in a visible tab", () => {
    expect(source).toContain(
      "const CLIENT_RECOMMENDATION_OPEN_THREADS_REFRESH_MS = 60_000"
    );
    expect(source).toContain('document.visibilityState === "visible"');
    expect(source).toMatch(
      /recommendations\.openThreads\.useQuery\([\s\S]*?enabled:\s*canRead[\s\S]*?canRead\s*&&\s*isPageVisible\s*\?\s*CLIENT_RECOMMENDATION_OPEN_THREADS_REFRESH_MS\s*:\s*false[\s\S]*?refetchIntervalInBackground:\s*false[\s\S]*?refetchOnWindowFocus:\s*true/
    );
    expect(source).not.toContain("RECOMMENDATION_LIVE_REFETCH_MS = 3_000");
  });

  it("refreshes immediately when an eligible client returns to the tab", () => {
    expect(source).toContain("const wasPageVisibleRef = useRef(isPageVisible)");
    expect(source).toContain("refetch: refetchOpenThreadFeed");
    expect(source).toContain("if (!wasVisible && isPageVisible && canRead)");
    expect(source).toContain("void refetchOpenThreadFeed()");
  });

  it("preserves reaction and mute invalidations plus active-alert cadence", () => {
    expect(source).toContain("utils.recommendations.openThreads.invalidate()");
    expect(source).toContain("refetchInterval: 15_000");
  });
});
