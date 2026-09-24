import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("manual search D1 protections", () => {
  it("provides one shared 400ms and two-character debounce", () => {
    const hook = read("frontend/src/hooks/useDebouncedSearch.ts");
    expect(hook).toContain("delayMs = 400");
    expect(hook).toContain("minimumLength = 2");
    expect(hook).toContain("normalized.length >= minimumLength");
  });

  it.each([
    ["onboarding", "frontend/src/pages/AdminBrokerOnboarding.tsx", "debouncedSearch"],
    ["broker report", "frontend/src/pages/AdminBrokerReport.tsx", "debouncedSearch"],
    ["recommendation history", "frontend/src/pages/AdminRecommendations.tsx", "debouncedThreadSearch"],
    ["community members", "frontend/src/pages/AdminCommunityModeration.tsx", "debouncedSearch"],
    ["loyalty points", "frontend/src/pages/AdminPoints.tsx", "debouncedStudentSearch"],
  ])("debounces %s database searches", (_label, path, value) => {
    const source = read(path);
    expect(source).toContain("useDebouncedSearch");
    expect(source).toContain(value);
  });

  it("creates expression indexes for bounded support prefixes", () => {
    const migration = read("database/migrations/130_support_client_prefix_search.sql");
    expect(migration).toContain("idx_users_support_email_lower");
    expect(migration).toContain("idx_users_support_name_lower");
    expect(migration).toContain("idx_users_support_phone");
    expect(migration).not.toMatch(/DROP|DELETE|UPDATE/i);
  });
});
