import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../frontend/src/pages/AdminSubscribersReport.tsx", import.meta.url),
  "utf8",
);
const dbSource = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");

describe("subscribers report ILS revenue contract", () => {
  it("uses canonical gross, refund, and net ILS fields in UI and CSV", () => {
    expect(source).toContain("grossSpentIls");
    expect(source).toContain("refundedIls");
    expect(source).toContain("totalSpentIls");
    expect(source).toContain("Gross Spent (ILS)");
    expect(source).toContain("Net Spent (ILS)");
    expect(source).toContain("₪{(s.totalSpentIls || 0).toFixed(0)}");
    expect(source).not.toContain("Total Spent ($)");
    expect(source).not.toMatch(/s\.totalSpent\b/);
  });

  it("derives subscriber and revenue reports through canonical key pricing", () => {
    const subscribersReport = dbSource.slice(
      dbSource.indexOf("export async function getSubscribersReport"),
      dbSource.indexOf("export async function getRevenueReport"),
    );
    const revenueReport = dbSource.slice(dbSource.indexOf("export async function getRevenueReport"));
    expect(subscribersReport).toContain("getPackageKeyPriceIls");
    expect(revenueReport).toContain("getPackageKeyPriceIls");
  });
});
