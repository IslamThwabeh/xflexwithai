import { describe, expect, it } from "vitest";
import { protectRecommendationAuthors } from "../backend/services/recommendation-privacy.service";

describe("recommendation author privacy", () => {
  it("preserves own-post permissions while concealing other account identifiers", () => {
    const own = { userId: 10, authorName: "Me", authorEmail: "me@example.com", isAnalyst: true,
      closedByUserId: -1, deliveryDiagnosticsJson: "private" };
    const other = { ...own, userId: 20, authorName: "Other" };
    const result = protectRecommendationAuthors([own, other], 10, false);
    expect(result.map((row) => row.userId)).toEqual([10, 0]);
    expect(result.every((row) => row.authorName === "XFlex" && row.authorEmail === null
      && row.closedByUserId === null && row.deliveryDiagnosticsJson === null)).toBe(true);
    expect(own.authorEmail).toBe("me@example.com");
    expect(protectRecommendationAuthors([own, other], 10, true)).toEqual([own, other]);
  });
});
