import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  currentFinancialMonth,
  scopedReceiptTotals,
  emptyFinancialTotals,
} from "../shared/financialReport";
import { buildFinancialManagementCsv } from "../shared/financialReportCsv";
describe("finance report presentation contract", () => {
  it("uses UTC month-to-date and never operational keys as the home cash source", () => {
    expect(
      currentFinancialMonth(new Date("2026-11-30T23:00:00-03:00"))
    ).toEqual({ from: "2026-12-01", to: "2026-12-01", grouping: "month" });
    const source = readFileSync("backend/db.ts", "utf8")
      .split("export async function getDashboardStats()")[1]
      .split("// Registration Key Management")[0];
    expect(source).not.toMatch(
      /grossRevenueIls|totalRevenueIls|revenueKeys|getPackageKeyPriceIls/
    );
    expect(source).toContain("['pending', 'awaiting_confirmation']");
  });
  it("exports identical selected-scope and all-service totals with a disclosed calculation basis", () => {
    const totals = {
      ...emptyFinancialTotals(),
      newSalesMinor: 2180000,
      renewalsMinor: 152500,
      upgradesMinor: 205000,
      copierMinor: 1300000,
      confirmedIncomeMinor: 3837500,
      academyReceiptsMinor: 2537500,
      recordedReceiptsMinor: 4007500,
      receiptCorrectionsMinor: -170000,
      netRevenueMinor: 3837500,
      operatingProfitLossMinor: 3837500,
      ledgerMovementMinor: 3837500,
    };
    const input = {
      from: "2026-11-01",
      to: "2026-11-25",
      grouping: "month" as const,
      periods: [{ period: "2026-11", ...totals }],
      totals,
      categories: [],
      scope: "academy" as const,
    };
    const csv = buildFinancialManagementCsv(input);
    expect(csv).toContain('"Receipt view","academy"');
    expect(csv).toContain('"Timezone","UTC"');
    expect(csv).toContain('"13000.00"');
    expect(csv).toContain('"40075.00","-1700.00"');
    expect(csv).toContain('"25375.00","0.00","25375.00"');
    expect(scopedReceiptTotals(totals, "all").net).toBe(3837500);
  });
});
