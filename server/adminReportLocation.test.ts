import { describe, expect, it } from "vitest";
import {
  getOrderReviewFilter,
  orderReviewPath,
  OUTSTANDING_ORDERS_PATH,
  orderReviewDate,
  orderAgeDays,
} from "../shared/orderReview";
import {
  financialReportPath,
  isFinancialDate,
  readFinancialReportLocation,
} from "../shared/financialReportLocation";

const defaults = {
  from: "2026-11-01",
  to: "2026-11-25",
  grouping: "month" as const,
};
describe("shareable applied report locations", () => {
  it("interprets stored unzoned order dates as UTC and preserves explicit offsets", () => {
    expect(orderReviewDate("2026-11-25 12:00:00")?.toISOString()).toBe(
      "2026-11-25T12:00:00.000Z"
    );
    expect(orderReviewDate("2026-11-25T14:00:00+02:00")?.toISOString()).toBe(
      "2026-11-25T12:00:00.000Z"
    );
    expect(
      orderAgeDays("2026-11-24 12:00:00", new Date("2026-11-25T13:00:00Z"))
    ).toBe(1);
    expect(
      orderAgeDays("2026-12-01 12:00:00", new Date("2026-11-25T13:00:00Z"))
    ).toBe(0);
    expect(orderReviewDate("not-a-date")).toBeNull();
    expect(orderAgeDays(null)).toBeNull();
  });
  it("round trips the complete finance selection without unrelated query parameters", () => {
    const selected = {
      from: "2025-01-01",
      to: "2025-12-31",
      grouping: "year" as const,
      scope: "copier" as const,
    };
    const path = financialReportPath(selected);
    expect(readFinancialReportLocation(path.split("?")[1], defaults)).toEqual(
      selected
    );
    expect(
      readFinancialReportLocation("?scope=academy&customer=private", defaults)
    ).toEqual({ ...defaults, scope: "academy" });
  });
  it.each([
    "2026-02-29",
    "2026-11-31",
    "11/25/2026",
    "2026-1-01",
    "",
    "<script>",
  ])("rejects invalid calendar date %s", value => {
    expect(isFinancialDate(value)).toBe(false);
  });
  it("accepts a leap day and uses safe defaults for unknown or reversed selections", () => {
    expect(isFinancialDate("2024-02-29")).toBe(true);
    expect(
      readFinancialReportLocation(
        "from=2026-12-01&to=2026-01-01&grouping=all&scope=other",
        defaults
      )
    ).toEqual({ ...defaults, scope: "all" });
    expect(
      readFinancialReportLocation("from=2026-02-30&to=2026-11-24", defaults)
    ).toEqual({ ...defaults, to: "2026-11-24", scope: "all" });
  });
  it("restores each order queue while record links remain independent of current status", () => {
    expect(orderReviewPath("outstanding")).toBe(OUTSTANDING_ORDERS_PATH);
    for (const filter of [
      "outstanding",
      "pending",
      "awaiting_confirmation",
      "paid",
      "completed",
      "cancelled",
      "refunded",
    ] as const)
      expect(getOrderReviewFilter(orderReviewPath(filter).split("?")[1])).toBe(
        filter
      );
    expect(
      getOrderReviewFilter("status=outstanding&orderId=203")
    ).toBeUndefined();
    expect(
      getOrderReviewFilter("status=outstanding&orderId=9007199254740992")
    ).toBe("outstanding");
    expect(getOrderReviewFilter("status=unknown")).toBeUndefined();
    expect(orderReviewPath()).toBe("/admin/orders");
  });
});
