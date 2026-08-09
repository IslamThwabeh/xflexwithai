import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureCenterSource = readFileSync(
  new URL("../frontend/src/pages/AdminFeatureCenter.tsx", import.meta.url),
  "utf8"
);
const surveyWorkspaceSource = readFileSync(
  new URL("../frontend/src/pages/AdminStudentSurveys.tsx", import.meta.url),
  "utf8"
);
const pointsWorkspaceSource = readFileSync(
  new URL("../frontend/src/pages/AdminPoints.tsx", import.meta.url),
  "utf8"
);
const databaseSource = readFileSync(
  new URL("../backend/db.ts", import.meta.url),
  "utf8"
);

describe("admin feature readiness guidance", () => {
  it("gives every incomplete business prerequisite a direct admin action", () => {
    for (const href of [
      "/admin/roles?feature=staff-performance",
      "/admin/staff-performance",
      "/admin/roles?feature=student-surveys",
      "/admin/student-surveys?tab=builder",
      "/admin/roles?feature=points-rewards",
      "/admin/points?tab=rewards",
      "/admin/roles?feature=student-community",
      "/admin/community?setup=policy",
      "/admin/community?setup=automated-checks",
      "/admin/roles?feature=job-eligibility",
      "/admin/job-eligibility",
    ]) {
      expect(featureCenterSource).toContain(`href: "${href}"`);
    }
  });

  it("warns admins when a feature is enabled before setup is complete", () => {
    expect(featureCenterSource).toContain("view.enabled && missingItems > 0");
    expect(featureCenterSource).toContain("Enabled before setup is complete");
    expect(featureCenterSource).toContain("الميزة مفعّلة قبل اكتمال الإعداد");
  });

  it("opens the exact survey builder and rewards workspace from deep links", () => {
    expect(surveyWorkspaceSource).toContain(
      'const requestedTab = params.get("tab")'
    );
    expect(surveyWorkspaceSource).toContain('"builder"');
    expect(pointsWorkspaceSource).toContain(
      'const requestedTab = params.get("tab")'
    );
    expect(pointsWorkspaceSource).toContain('"rewards"');
  });

  it("measures enabled-rule coverage across active jobs", () => {
    expect(databaseSource).toContain("coveredActiveJobsRow");
    expect(databaseSource).toContain(
      ".innerJoin(jobs, eq(studentJobEligibilityRules.jobId, jobs.id))"
    );
    expect(databaseSource).toContain(
      "eq(studentJobEligibilityRules.isEnabled, true)"
    );
    expect(databaseSource).toContain("eq(jobs.isActive, true)");
    expect(featureCenterSource).toContain(
      "module.coveredActiveJobs === module.activeJobs"
    );
  });
});
