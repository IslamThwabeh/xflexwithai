import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LexAI case search D1 protection", () => {
  const source = readFileSync("frontend/src/pages/AdminLexai.tsx", "utf8");

  it("does not poll or refetch-on-focus while a remote search is active", () => {
    expect(source).toContain("const hasActiveCaseSearch = normalizedCaseSearch.length >= 2");
    expect(source).toContain("refetchInterval: hasActiveCaseSearch ? false : 15_000");
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: !hasActiveCaseSearch");
  });
});
