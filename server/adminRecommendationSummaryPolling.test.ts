import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../frontend/src/pages/AdminRecommendations.tsx", import.meta.url)
  ),
  "utf8"
);

describe("Admin recommendation summary polling", () => {
  it("polls every minute only for an authorized manager in a visible tab", () => {
    expect(source).toContain("const ADMIN_THREAD_SUMMARY_REFRESH_MS = 60_000");
    expect(source).toContain('document.visibilityState === "visible"');
    expect(source).toContain(
      'document.addEventListener("visibilitychange", handleVisibilityChange)'
    );
    expect(source).toContain(
      'document.removeEventListener("visibilitychange", handleVisibilityChange)'
    );
    expect(source).toContain("enabled: canManageChannel");
    expect(source).toMatch(
      /canManageChannel\s*&&\s*isPageVisible\s*\?\s*ADMIN_THREAD_SUMMARY_REFRESH_MS\s*:\s*false/
    );
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: true");
    expect(source).toContain("retry: false");
  });

  it("refreshes immediately when a hidden admin tab becomes visible", () => {
    expect(source).toContain("const wasPageVisibleRef = useRef(isPageVisible)");
    expect(source).toContain(
      "if (!wasVisible && isPageVisible && canManageChannel)"
    );
    expect(source).toContain("void refetchThreadSummary()");
  });

  it("preserves immediate mutation refreshes and unrelated live cadences", () => {
    expect(source).toContain(
      "utils.recommendations.threadSummary.invalidate()"
    );
    expect(source).toContain(
      "refetchInterval: canManageChannel ? 1000 : false"
    );
    expect(source).toContain(
      "{ enabled: canManageChannel, refetchInterval: canManageChannel ? 30_000 : false }"
    );
  });
});
