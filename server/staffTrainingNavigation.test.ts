import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardLayoutSource = readFileSync(
  new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url),
  "utf8",
);
const clientLayoutSource = readFileSync(
  new URL("../frontend/src/components/ClientLayout.tsx", import.meta.url),
  "utf8",
);
const authSource = readFileSync(
  new URL("../frontend/src/pages/Auth.tsx", import.meta.url),
  "utf8",
);

describe("staff course-training navigation", () => {
  it("keeps the normal role-based staff landing page", () => {
    expect(authSource).toContain("getStaffLandingPage(result.staffRoles ?? [])");
  });

  it("shows enrolled employees a bilingual My Course entry", () => {
    expect(dashboardLayoutSource).toContain("const employeeTrainingSection");
    expect(dashboardLayoutSource).toContain('label: { en: "Employee Training", ar: "تدريب الموظفين" }');
    expect(dashboardLayoutSource).toContain('label: { en: "My Course", ar: "دورتي التدريبية" }');
    expect(dashboardLayoutSource).toContain('path: "/courses"');
    expect(dashboardLayoutSource).toContain("hasEmployeeTraining ? [employeeTrainingSection] : []");
  });

  it("provides desktop and mobile routes back to the staff workspace", () => {
    expect(clientLayoutSource).toContain("getStaffLandingPage(adminCheck.staffRoles ?? [])");
    expect(clientLayoutSource).toContain("Return to staff workspace");
    expect(clientLayoutSource).toContain("العودة إلى مساحة عمل الموظفين");
  });
});
