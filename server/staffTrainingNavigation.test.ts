import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardLayoutSource = readFileSync(
  new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url),
  "utf8",
);
const catalogSource = readFileSync(new URL("../frontend/src/lib/adminNavigationCatalog.ts", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("../frontend/src/lib/adminNavigationAccess.ts", import.meta.url), "utf8");
const clientLayoutSource = readFileSync(
  new URL("../frontend/src/components/ClientLayout.tsx", import.meta.url),
  "utf8",
);
const clientNavigationSource = readFileSync(new URL("../frontend/src/components/navigation/ClientNavigation.tsx", import.meta.url), "utf8");
const authSource = readFileSync(
  new URL("../frontend/src/pages/Auth.tsx", import.meta.url),
  "utf8",
);

describe("staff course-training navigation", () => {
  it("keeps the normal role-based staff landing page", () => {
    expect(authSource).toContain("getStaffLandingPage(result.staffRoles ?? [])");
  });

  it("shows enrolled employees a bilingual My Course entry", () => {
    expect(catalogSource).toContain("const employeeTrainingSection");
    expect(catalogSource).toContain('label: { en: "Employee Training", ar: "تدريب الموظفين" }');
    expect(catalogSource).toContain('label: { en: "My Course", ar: "دورتي التدريبية" }');
    expect(catalogSource).toContain('path: "/courses"');
    expect(accessSource).toContain("hasEmployeeTraining ? [employeeTrainingSection] : []");
    expect(dashboardLayoutSource).toContain("getVisibleAdminMenuSections");
  });

  it("provides desktop and mobile routes back to the staff workspace", () => {
    expect(clientLayoutSource).toContain("getStaffLandingPage(adminCheck.staffRoles ?? [])");
    expect(clientLayoutSource).toContain("staffWorkspacePath={staffWorkspacePath}");
    expect(clientNavigationSource).toContain("Staff workspace");
    expect(clientNavigationSource).toContain("مساحة عمل الموظفين");
  });
});
