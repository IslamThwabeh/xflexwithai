import { describe, expect, it } from "vitest";
import { parseRecommendationDraft } from "../backend/services/recommendation-parser.service";

describe("recommendation draft parser", () => {
  it("extracts main trade fields with TP3 from an Arabic-style draft", async () => {
    const rawText = [
      "XAUUSD BUY",
      "Entry 2412.50",
      "SL 2404.00",
      "TP1 2418.00",
      "TP2 2422.00",
      "هدف3 2427.00",
      "Risk 1%",
    ].join("\n");

    const result = await parseRecommendationDraft(rawText);

    expect(result.fields.symbol).toBe("XAUUSD");
    expect(result.fields.side).toBe("BUY");
    expect(result.fields.entryPrice).toBe("2412.50");
    expect(result.fields.stopLoss).toBe("2404.00");
    expect(result.fields.takeProfit1).toBe("2418.00");
    expect(result.fields.takeProfit2).toBe("2422.00");
    expect(result.fields.takeProfit3).toBe("2427.00");
    expect(result.fields.riskPercent).toBe("1%");
    expect(result.parser.source).toBe("rule");
  });

  it("extracts fields from a compact single-line draft and reports parser metadata", async () => {
    const rawText = "EURUSD SELL - Entry 1.0830 / SL 1.0870 / TP1 1.0790 / TP2 1.0760";

    const result = await parseRecommendationDraft(rawText);

    expect(result.fields.symbol).toBe("EURUSD");
    expect(result.fields.side).toBe("SELL");
    expect(result.fields.entryPrice).toBe("1.0830");
    expect(result.fields.stopLoss).toBe("1.0870");
    expect(result.fields.takeProfit1).toBe("1.0790");
    expect(result.fields.takeProfit2).toBe("1.0760");
    expect(result.parser.confidence).toBeGreaterThan(0);
    expect(["rule", "hybrid", "ai"]).toContain(result.parser.source);
  });
});
