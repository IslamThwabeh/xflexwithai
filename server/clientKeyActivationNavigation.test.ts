import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");
const clientLayoutSource = readFileSync(
  new URL("../frontend/src/components/ClientLayout.tsx", import.meta.url),
  "utf8",
);
const packagesSource = readFileSync(
  new URL("../frontend/src/pages/StudentPackages.tsx", import.meta.url),
  "utf8",
);

describe("client key activation navigation", () => {
  it("keeps activation and renewal directly available in the signed-in client menu", () => {
    expect(clientLayoutSource).toContain('href: "/activate-key"');
    expect(clientLayoutSource).toContain('"تفعيل / تجديد مفتاح"');
    expect(clientLayoutSource).toContain('"Activate / Renew Key"');
  });

  it("shows renewal state from the latest truly expired service history", () => {
    expect(dbSource).toContain("getLatestExpiredRecommendationSubscription(userId)");
    expect(dbSource).toContain("getLatestExpiredLexaiSubscription(userId)");
    expect(dbSource).toContain("lte(recommendationSubscriptions.endDate, nowIso)");
    expect(dbSource).toContain("lte(lexaiSubscriptions.endDate, nowIso)");
    expect(packagesSource).toContain("hasExpiredTimedAccess");
    expect(packagesSource).toContain("أدخل مفتاح التجديد");
  });
});
