import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_NAVIGATION_GROUPS,
  CLIENT_ACCOUNT_PATHS,
  findActiveNavigationPath,
  groupAdminDestinations,
  groupClientDestinations,
  matchNavigationQuery,
  readNavigationPreference,
  saveNavigationPreference,
} from "../frontend/src/lib/navigationV2";
import { ROLE_PAGE_ACCESS } from "../shared/const";
const adminPaths = [
  ...readFileSync(
    new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url),
    "utf8"
  )
    .split("const menuSectionsDef")[1]
    .split("const employeeTrainingSection")[0]
    .replace(/\/\/[^\n]*/g, "")
    .matchAll(/path: "([^"]+)"/g),
].map(match => match[1]);
const destinations = (paths: string[]) =>
  paths.map(path => ({
    path,
    label: path,
    badge: path.includes("support") ? 7 : 0,
  }));
describe("navigation V2 destination preservation", () => {
  it("maps all 48 existing catalog destinations once", () => {
    expect(adminPaths).toHaveLength(48);
    const mapped = ADMIN_NAVIGATION_GROUPS.flatMap(group => [...group.paths]);
    expect([...mapped].sort()).toEqual([...adminPaths].sort());
    expect(new Set(mapped).size).toBe(48);
  });
  it.each(Object.entries(ROLE_PAGE_ACCESS))(
    "preserves the already-authorized set for %s in both languages",
    (_role, paths) => {
      for (const language of ["en", "ar"] as const) {
        const input = destinations(paths);
        expect(
          groupAdminDestinations(input, language)
            .flatMap(group => group.items)
            .sort((a, b) => a.path.localeCompare(b.path))
        ).toEqual([...input].sort((a, b) => a.path.localeCompare(b.path)));
      }
    }
  );
  it("preserves training and future unknown destinations without granting extra routes", () => {
    const input = destinations([
      "/courses",
      "/admin/support",
      "/admin/future-page",
    ]);
    const groups = groupAdminDestinations(input, "ar");
    expect(groups[0].id).toBe("training");
    expect(groups.at(-1)?.id).toBe("other");
    expect(groups.flatMap(group => group.items)).toEqual(input);
    expect(groupAdminDestinations([], "en")).toEqual([]);
  });
  it("preserves every combination of conditional student destinations and account links", () => {
    const conditional = [
      "/community",
      "/surveys",
      "/job-opportunities",
      "/live-package",
      "/admin/live-expert",
    ];
    for (let mask = 0; mask < 32; mask++) {
      const paths = [
        "/courses",
        "/lexai",
        "/recommendations",
        "/documents",
        "/guides",
        "/support",
        "/quiz",
        "/my-packages",
        "/activate-key",
        "/broker-onboarding",
        "/notifications",
        "/my-points",
        "/calculators",
        "/future-tool",
        ...conditional.filter((_, bit) => mask & (1 << bit)),
      ];
      for (const language of ["en", "ar"] as const) {
        const input = destinations(paths);
        const mapped = [
          ...groupClientDestinations(input, language).flatMap(
            group => group.items
          ),
          ...input.filter(
            item =>
              CLIENT_ACCOUNT_PATHS.includes(item.path) ||
              item.path === "/notifications"
          ),
        ];
        expect(mapped.map(item => item.path).sort()).toEqual(paths.sort());
      }
    }
  });
  it("selects the most specific matching page and searches bilingual labels", () => {
    const items = destinations(["/admin/finance", "/admin/finance/controls"]);
    expect(
      findActiveNavigationPath(items, "/admin/finance/controls/4?tab=one")
    ).toBe("/admin/finance/controls");
    expect(findActiveNavigationPath(items, "/admin/finances")).toBeUndefined();
    expect(
      matchNavigationQuery(
        { path: "/keys", label: "مفاتيح التفعيل", keywords: "Package Keys" },
        "KEYS"
      )
    ).toBe(true);
    expect(
      matchNavigationQuery({ path: "/keys", label: "مَفاتيح" }, "مفاتيح")
    ).toBe(true);
  });
  it("works when saved preferences are invalid or storage is disabled", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => '[1,"support",null]',
      setItem: () => {
        throw new Error("disabled");
      },
    });
    expect(readNavigationPreference("test")).toEqual(["support"]);
    expect(() => saveNavigationPreference("test", ["support"])).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("disabled");
      },
    });
    expect(readNavigationPreference("test", ["overview"])).toEqual([
      "overview",
    ]);
    vi.unstubAllGlobals();
  });
});
