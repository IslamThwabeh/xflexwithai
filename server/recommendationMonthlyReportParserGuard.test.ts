import { describe, expect, it } from "vitest";

import { extractRecommendationExplicitSignedPips } from "../backend/db";

describe("recommendation monthly-report explicit pips guard", () => {
  it("keeps realistic signed pips values", () => {
    expect(extractRecommendationExplicitSignedPips("+25 pips ✅")).toBe(25);
    expect(extractRecommendationExplicitSignedPips("Stopped -30 pips ❌")).toBe(-30);
    expect(extractRecommendationExplicitSignedPips("+12,5 points")).toBe(12.5);
  });

  it("accepts uncapped targets when the pips unit is explicit", () => {
    expect(extractRecommendationExplicitSignedPips("+250 نقاط ✅ هدف ثالث")).toBe(250);
    expect(extractRecommendationExplicitSignedPips("+300 pips ✅")).toBe(300);
    expect(extractRecommendationExplicitSignedPips("هدفنا 1250 points")).toBe(1250);
    expect(extractRecommendationExplicitSignedPips("الهدف الثالث 250 نقطة")).toBe(250);
    expect(extractRecommendationExplicitSignedPips("Stopped - 50 pips ❌")).toBe(-50);
  });

  it("still rejects price-like large signed values without a pips unit", () => {
    expect(extractRecommendationExplicitSignedPips("Move SL to +2414.50")).toBeNull();
    expect(extractRecommendationExplicitSignedPips("Sell zone -1935.20")).toBeNull();
  });

  it("returns null when no signed value exists", () => {
    expect(extractRecommendationExplicitSignedPips("TP1 hit ✅")).toBeNull();
  });
});
