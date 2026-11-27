import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getStaffReviewMenuSections,
  getVisibleAdminMenuSections,
} from "../frontend/src/lib/adminNavigationAccess";
import { menuSectionsDef } from "../frontend/src/lib/adminNavigationCatalog";
import { ROLE_LABELS } from "../frontend/src/lib/staffRoleMetadata";
import {
  STAFF_REVIEW_CAPABILITIES,
  SUPPORT_REVIEW_ROLES,
  canReviewCapability,
} from "../frontend/src/lib/staffReviewCapabilities";
import { ALL_STAFF_ROLES, ROLE_PAGE_ACCESS } from "../shared/const";

const paths = (sections: ReturnType<typeof getVisibleAdminMenuSections>) =>
  sections.flatMap(section => section.items.map(item => item.path));
const router = readFileSync(
  new URL("../backend/routers.ts", import.meta.url),
  "utf8"
);
const review = readFileSync(
  new URL("../frontend/src/pages/AdminStaffReview.tsx", import.meta.url),
  "utf8"
);

describe("staff access review parity", () => {
  it.each(ALL_STAFF_ROLES)(
    "matches the role's current destinations for %s",
    role => {
      const actual = paths(
        getStaffReviewMenuSections({
          isStaff: true,
          roles: [role],
          performanceEnabled: true,
        })
      );
      const catalogPaths = new Set(
        menuSectionsDef.flatMap(section => section.items.map(item => item.path))
      );
      expect(actual.sort()).toEqual(
        (ROLE_PAGE_ACCESS[role] ?? [])
          .filter(path => catalogPaths.has(path))
          .sort()
      );
      expect(new Set(actual).size).toBe(actual.length);
    }
  );
  it("does not let the reviewing admin's finance authority leak into the selected employee", () => {
    const actual = paths(
      getStaffReviewMenuSections({ isStaff: true, roles: ["support"] })
    );
    expect(actual).not.toContain("/admin/finance");
    expect(actual).not.toContain("/admin/finance/legacy-migrations");
  });
  it("keeps training account-specific, removes inactive access, and honors performance precedence", () => {
    expect(
      paths(
        getStaffReviewMenuSections({
          isStaff: true,
          roles: ["support"],
          hasEmployeeTraining: true,
        })
      )
    ).toContain("/courses");
    expect(
      paths(
        getStaffReviewMenuSections({
          isStaff: true,
          roles: ["staff_performance_employee"],
          performanceEnabled: false,
        })
      )
    ).toEqual([]);
    const manager = paths(
      getStaffReviewMenuSections({
        isStaff: true,
        roles: ["staff_performance_employee", "staff_performance_manager"],
        performanceEnabled: true,
      })
    );
    expect(manager).toContain("/admin/staff-performance");
    expect(manager).not.toContain("/admin/my-performance");
    expect(
      paths(
        getStaffReviewMenuSections({
          isStaff: false,
          roles: ["support"],
          hasEmployeeTraining: true,
        })
      )
    ).toEqual([]);
    expect(
      paths(
        getStaffReviewMenuSections({
          isStaff: true,
          roles: ["support"],
          loginBlockedAt: "2026-11-20",
        })
      )
    ).toEqual([]);
  });
  it("preserves feature preparation and owner-only admin visibility", () => {
    for (const role of [
      "student_surveys_manager",
      "student_community_moderator",
      "loyalty_rewards_manager",
      "student_job_eligibility_manager",
    ]) {
      expect(
        paths(
          getStaffReviewMenuSections({
            isStaff: true,
            roles: [role],
            performanceEnabled: false,
          })
        ).length
      ).toBeGreaterThan(0);
    }
    const admin = paths(
      getVisibleAdminMenuSections({ adminCheck: { isAdmin: true } })
    );
    const owner = paths(
      getVisibleAdminMenuSections({
        adminCheck: { isAdmin: true },
        financeAuthority: { isFinanceOwner: true },
      })
    );
    expect(admin).not.toContain("/admin/finance");
    expect(owner).toContain("/admin/finance");
    expect(owner).not.toContain("/admin/my-performance");
  });
  it("uses one catalog, safe employee switching, and no review mutation", () => {
    expect(review).not.toContain("FULL_SIDEBAR");
    expect(review).not.toContain(".useMutation");
    expect(review).toContain("previewQuery.data?.userId === selectedStaffId");
    expect(review).toContain("formatAcademyDateTime");
    expect(review).not.toContain("max-h-[500px]");
    expect(review).toContain("getStaffReviewMenuSections");
    expect(
      Object.values(ROLE_LABELS).every(role => role.labelKey && role.color)
    ).toBe(true);
  });
  it("matches actual support gates and never advertises deletion of immutable recommendations", () => {
    const gate = router
      .split("const supportStaffProcedure =")[1]
      .split("const lexaiSupportProcedure")[0];
    const names = gate.split("hasAnyRole(ctx.user.id, [")[1].split("])")[0];
    expect(
      [...names.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()
    ).toEqual([...SUPPORT_REVIEW_ROLES].sort());
    const deletion = STAFF_REVIEW_CAPABILITIES.find(row => row.immutable)!;
    expect(canReviewCapability(["analyst", "support"], deletion)).toBe(false);
    expect(
      canReviewCapability(["support"], STAFF_REVIEW_CAPABILITIES[0], false)
    ).toBe(false);
    for (const capability of STAFF_REVIEW_CAPABILITIES) {
      const procedure = capability.endpoint.split(".").at(-1)!;
      expect(router).toContain(`${procedure}:`);
    }
  });
});
