import { describe, expect, it } from "vitest";
import { estimateOpenAiCostUsd, getOpenAiPricingModelKey } from "../backend/_core/openai";

describe("OpenAI usage pricing", () => {
  it("normalizes versioned model ids returned by OpenAI", () => {
    expect(getOpenAiPricingModelKey("gpt-4o-2024-08-06")).toBe("gpt-4o");
    expect(getOpenAiPricingModelKey("gpt-4o-mini-2024-07-18")).toBe("gpt-4o-mini");
  });

  it("estimates cost for versioned model ids", () => {
    expect(estimateOpenAiCostUsd("gpt-4o-2024-08-06", {
      prompt_tokens: 1_000,
      completion_tokens: 500,
    })).toBe(0.0125);

    expect(estimateOpenAiCostUsd("gpt-4o-mini-2024-07-18", {
      prompt_tokens: 10_000,
      completion_tokens: 2_000,
    })).toBe(0.0027);
  });

  it("leaves unknown models unpriced", () => {
    expect(estimateOpenAiCostUsd("unknown-model-2026-01-01", {
      prompt_tokens: 1_000,
      completion_tokens: 1_000,
    })).toBeNull();
  });
});
