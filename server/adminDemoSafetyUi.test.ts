import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureCenterSource = readFileSync(
  new URL("../frontend/src/pages/AdminFeatureCenter.tsx", import.meta.url),
  "utf8",
);
const dashboardLayoutSource = readFileSync(
  new URL("../frontend/src/components/DashboardLayout.tsx", import.meta.url),
  "utf8",
);
const staffPerformanceSource = readFileSync(
  new URL("../frontend/src/pages/AdminStaffPerformance.tsx", import.meta.url),
  "utf8",
);
const communitySource = readFileSync(
  new URL("../frontend/src/pages/AdminCommunityModeration.tsx", import.meta.url),
  "utf8",
);

describe("admin demo safety polish", () => {
  it("uses correct Arabic singular and dual readiness copy", () => {
    expect(featureCenterSource).toContain('if (count === 1) return "متطلب واحد متبقٍ"');
    expect(featureCenterSource).toContain('if (count === 2) return "متطلبان متبقيان"');
    expect(featureCenterSource).toContain("arabicRemainingRequirements(missingItems)");
    expect(featureCenterSource).not.toContain("`${missingItems} متطلبات متبقية`");
  });

  it("provides comfortable mobile targets in the feature center and admin shell", () => {
    expect(featureCenterSource).toContain("min-h-11 w-full");
    expect(featureCenterSource).toContain("[&>button]:min-h-11");
    expect(featureCenterSource).toContain("min-h-11 min-w-11");
    expect(dashboardLayoutSource).toContain("h-11 w-11");
    expect(dashboardLayoutSource).toContain("min-h-11 min-w-11");
  });

  it("requires deliberate staff selection and makes missing performance roles actionable", () => {
    expect(staffPerformanceSource).not.toContain("setSelectedStaffId(staffQuery.data[0].id)");
    expect(staffPerformanceSource).toContain('roles?.includes("staff_performance_employee")');
    expect(staffPerformanceSource).toContain('<option value="">{labels.employeePlaceholder}</option>');
    expect(staffPerformanceSource).toContain("staffOptions.map");
    expect(staffPerformanceSource).toContain("enablePerformanceEmployee.mutate");
    expect(staffPerformanceSource).toContain('role: "staff_performance_employee"');
  });

  it("keeps live community account controls closed and unloaded during demos", () => {
    expect(communitySource).toContain("const [showLiveControls, setShowLiveControls] = useState(false)");
    expect(communitySource).toContain("enabled: showLiveControls");
    expect(communitySource).toContain("if (!showLiveControls)");
    expect(communitySource).toContain("Open live account controls");
    expect(communitySource).toContain("فتح أدوات الحسابات الفعلية");
  });
});
