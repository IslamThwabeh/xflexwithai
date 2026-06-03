import { describe, expect, it } from "vitest";

import { buildRecommendationMessageEmail } from "../backend/_core/recommendationEmails";

describe("recommendation message email template", () => {
  it("does not include the copy-friendly block in the email body", () => {
    const email = buildRecommendationMessageEmail({
      language: "en",
      type: "recommendation",
      recommendation: {
        symbol: "XAUUSD",
        side: "SELL",
        entryPrice: "4443",
        stopLoss: "4448",
        takeProfit1: "4438",
        takeProfit2: "4433",
        takeProfit3: "4428",
        content: "SELL NOW 4443\nSL: 4448\nTP1: 4438\nTP2: 4433\nTP3: 4428",
      },
    });

    expect(email.text).not.toContain("Copy-friendly lines");
    expect(email.text).not.toContain("Quick numbers");
    expect(email.html).not.toContain("Copy-friendly lines");
    expect(email.html).not.toContain("Quick numbers");
  });
});