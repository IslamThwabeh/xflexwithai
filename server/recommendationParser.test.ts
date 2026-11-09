import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../backend/_core/openai", () => ({ invokeOpenAiChatCompletion: vi.fn() }));
import { invokeOpenAiChatCompletion } from "../backend/_core/openai";
import { parseRecommendationDraft } from "../backend/services/recommendation-parser.service";
import { recommendationParserCorpus } from "./fixtures/recommendation-parser-corpus";

beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", ""); vi.mocked(invokeOpenAiChatCompletion).mockReset(); });
afterEach(() => vi.unstubAllEnvs());

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

describe("recommendation parser format regressions", () => {
  it.each(recommendationParserCorpus)("$id", async ({ text, expected }) => {
    const result = await parseRecommendationDraft(text);
    for (const field of ["symbol", "side", "entryPrice", "stopLoss", "takeProfit1", "takeProfit2", "takeProfit3", "riskPercent"] as const) {
      const actual = result.fields[field];
      if (["symbol", "side"].includes(field) || expected[field] === undefined) expect(actual, field).toBe(expected[field]);
      else expect(Number(actual?.replace(/%$/, "")), field).toBe(Number(expected[field]?.replace(/%$/, "")));
    }
    expect(invokeOpenAiChatCompletion).not.toHaveBeenCalled();
  });

  it("falls back for missing targets despite extracting the core fields", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.mocked(invokeOpenAiChatCompletion).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ takeProfit3: 2430 }) } }] } as any);
    const result = await parseRecommendationDraft("XAUUSD BUY 2400 SL 2390 TP1 2410 TP3 is 2430");
    expect(invokeOpenAiChatCompletion).toHaveBeenCalledOnce();
    expect(result.fields.takeProfit3).toBe("2430");
    expect(result.parser.source).toBe("hybrid");
  });

  it("identifies AI-only extraction by populated values, and accepts numeric JSON fields", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.mocked(invokeOpenAiChatCompletion).mockResolvedValue({ choices: [{ message: { content: '{"symbol":"XAUUSD","side":"BUY","entryPrice":2400}' } }] } as any);
    const result = await parseRecommendationDraft("صيغة غير معروفة");
    expect(result.parser.source).toBe("ai");
    expect(result.parser.confidence).toBeLessThan(0.9);
    expect(result.parser.warnings).toContain("Missing field: stopLoss");
  });

  it.each(["throw", "malformed", "empty"] as const)("keeps usable rule fields when AI is %s", async mode => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    if (mode === "throw") vi.mocked(invokeOpenAiChatCompletion).mockRejectedValue(new Error("provider unavailable"));
    else vi.mocked(invokeOpenAiChatCompletion).mockResolvedValue({ choices: [{ message: { content: mode === "empty" ? "{}" : "{invalid" } }] } as any);
    const result = await parseRecommendationDraft("XAUUSD BUY 2400");
    expect(result.fields).toMatchObject({ symbol: "XAUUSD", side: "BUY", entryPrice: "2400" });
    expect(result.parser.usedAi).toBe(true);
    expect(result.parser.warnings.length).toBeGreaterThan(0);
    expect(result.parser.confidence).toBeLessThan(0.9);
  });

  it.each(["Entry 2400-2405", "Entry 2400 Entry 2405", "Entry 2,400"])("does not collapse ambiguous prices: %s", async entry => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    vi.mocked(invokeOpenAiChatCompletion).mockResolvedValue({ choices: [{ message: { content: '{"entryPrice":"2400"}' } }] } as any);
    const result = await parseRecommendationDraft("XAUUSD BUY " + entry + " SL 2390 TP1 2410");
    expect(result.fields.entryPrice).toBeUndefined();
    expect(result.parser.warnings).toContain("Ambiguous field: entryPrice");
  });
});
