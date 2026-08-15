import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  "frontend/src/pages/AdminSeoOwnerIntake.tsx",
  "utf8"
);
const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const sidebarSource = readFileSync(
  "frontend/src/components/DashboardLayout.tsx",
  "utf8"
);

describe("SEO owner intake UI", () => {
  it("exposes the protected admin route and navigation entry", () => {
    expect(appSource).toContain('path={"/admin/seo-owner-intake"}');
    expect(appSource).toContain("<AdminSeoOwnerIntake />");
    expect(sidebarSource).toContain('path: "/admin/seo-owner-intake"');
  });

  it("autosaves answers and keeps submission explicit", () => {
    expect(pageSource).toContain("dirtyQuestionIdsRef");
    expect(pageSource).toContain(
      "setTimeout(() => void flushDirtyAnswers(), 900)"
    );
    expect(pageSource).toContain("seoOwnerIntake.save.useMutation");
    expect(pageSource).toContain("seoOwnerIntake.submit.useMutation");
    expect(pageSource).toContain("تم حفظ الإجابات تلقائياً");
  });
});
