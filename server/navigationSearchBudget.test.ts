import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../frontend/src/${path}`, import.meta.url), "utf8");

describe("navigation search database budget", () => {
  it("keeps page matching local, with no request, prefetch or timer", () => {
    const pageSearch = source("components/navigation/NavigationSearchDialog.tsx");
    expect(pageSearch).toContain("items.filter(item => matchNavigationQuery(item, query))");
    expect(pageSearch).not.toMatch(/trpc|fetch\(|XMLHttpRequest|prefetch|setTimeout|setInterval/);
  });

  it("mounts the separate record search only after an explicit admin action", () => {
    const layout = source("components/DashboardLayout.tsx");
    expect(layout).toContain("useState(false)");
    expect(layout).toContain("{showAdminSearch && (");
    expect(layout).toContain('lazy(() => import("./AdminSearchDialog"))');
    expect(layout).toContain("onSearchRecords={adminCheck?.isAdmin ? () => setShowAdminSearch(true) : undefined}");
  });

  it("submits record queries explicitly and disables recurring or automatic fetches", () => {
    const recordSearch = source("components/AdminSearchDialog.tsx");
    expect(recordSearch).toContain("{ query: submittedQuery }");
    expect(recordSearch).toContain("enabled: submittedQuery.length >= 2");
    expect(recordSearch).toContain("onSubmit={submit}");
    expect(recordSearch).toContain("onChange={e => setQuery(e.target.value)}");
    expect(recordSearch).toContain("if (normalizedQuery.length < 2 || isFetching) return;");
    expect(recordSearch).toContain("maxLength={200}");
    expect(recordSearch).toContain("staleTime: 5 * 60_000");
    for (const option of ["retry", "refetchOnMount", "refetchOnWindowFocus", "refetchOnReconnect", "refetchInterval"]) {
      expect(recordSearch).toContain(`${option}: false`);
    }
    expect(recordSearch).not.toMatch(/debouncedQuery|setTimeout|setInterval/);
    expect(recordSearch).toContain('role="alert"');
    expect(recordSearch).toContain("showResults && data?.users?.length");
  });
});
