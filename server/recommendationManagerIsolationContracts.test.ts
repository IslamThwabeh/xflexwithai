import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("recommendation manager isolation contracts", () => {
  const dbSource = () => fs.readFileSync(
    path.resolve(process.cwd(), "backend/db.ts"),
    "utf8",
  );

  it("explicitly excludes analyst-role users from recommendation delivery eligibility", () => {
    const source = dbSource();

    expect(source).toContain("eq(userRoles.role, 'analyst')");
    expect(source).toContain("recommendationManagerUserIds.has(row.userId)");
    expect(source).toContain("recommendationManagerUserIds.has(delivery.userId)");
    expect(source).toContain("reason = 'staff_account'");
  });

  it("keeps duplicate blocking role-driven instead of hardcoding employee identity", () => {
    const source = dbSource();

    expect(source).toContain("analyst_duplicate_guard");
    expect(source).toContain("findSimilarOpenRecommendationForAnalyst");
    expect(source).not.toMatch(/musaab/i);
    expect(source).not.toMatch(/anas/i);
  });
});
