import { describe, expect, it } from "vitest";

import { extractRecommendationExplicitSignedPips } from "../backend/db";

describe("recommendation monthly-report explicit pips guard", () => {
  it("keeps realistic signed pips values", () => {
    expect(extractRecommendationExplicitSignedPips("+25 pips ✅")).toBe(25);
    expect(extractRecommendationExplicitSignedPips("Stopped -30 pips ❌")).toBe(-30);
    expect(extractRecommendationExplicitSignedPips("+12,5 points")).toBe(12.5);
  });

  it("rejects price-like large signed values", () => {
    expect(extractRecommendationExplicitSignedPips("Move SL to +2414.50")).toBeNull();
    expect(extractRecommendationExplicitSignedPips("Sell zone -1935.20")).toBeNull();
  });

  it("returns null when no signed value exists", () => {
    expect(extractRecommendationExplicitSignedPips("TP1 hit ✅")).toBeNull();
  });
});
