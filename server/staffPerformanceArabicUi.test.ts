import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../frontend/src/pages/AdminStaffPerformance.tsx", import.meta.url),
  "utf8",
);

describe("staff performance bilingual admin flow", () => {
  it("lets the admin deliberately select any staff member, including Arabic names", () => {
    expect(source).toContain("staffOptions.map");
    expect(source).not.toContain("performanceEmployees.map");
    expect(source).toContain('employeePlaceholder: "اختر أي موظف"');
    expect(source).toContain("staff.name || staff.email");
  });

  it("makes the missing employee role actionable from the performance page", () => {
    expect(source).toContain("enablePerformanceEmployee.mutate");
    expect(source).toContain('role: "staff_performance_employee"');
    expect(source).toContain("تفعيل الموظف لإدارة الأداء");
    expect(source).toContain("/admin/roles?feature=staff-performance");
  });

  it("uses automatic text direction and explicitly supports Arabic and English task content", () => {
    expect(source.match(/dir="auto"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(source).toContain("يمكن كتابة الخطة والأهداف والمهام والنتائج بالعربية أو الإنجليزية أو بكليهما");
  });
});
