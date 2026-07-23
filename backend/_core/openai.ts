import * as db from "../db";
import { ENV } from "./env";
import { logger } from "./logger";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODERATION_API_URL = "https://api.openai.com/v1/moderations";

type OpenAiPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

// Estimated pricing only. Review periodically against the live OpenAI pricing page.
const OPENAI_PRICING_USD_PER_MILLION: Record<string, OpenAiPricing> = {
  "gpt-4o": {
    inputUsdPerMillion: 5,
    outputUsdPerMillion: 15,
  },
  "gpt-4o-mini": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  },
  "gpt-4-vision-preview": {
    inputUsdPerMillion: 10,
    outputUsdPerMillion: 30,
  },
};

export function getOpenAiPricingModelKey(model: string | null | undefined) {
  const normalizedModel = model?.trim();
  if (!normalizedModel) return null;
  if (OPENAI_PRICING_USD_PER_MILLION[normalizedModel]) return normalizedModel;

  return Object.keys(OPENAI_PRICING_USD_PER_MILLION)
    .sort((a, b) => b.length - a.length)
    .find((pricingModel) => normalizedModel.startsWith(`${pricingModel}-`)) ?? null;
}

type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type OpenAiChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: OpenAiUsage;
  [key: string]: unknown;
};

export type OpenAiUsageContext = {
  userId?: number | null;
  telegramUserId?: string | null;
  customerId?: string | null;
  endpoint?: string | null;
  featureName?: string | null;
  flowType?: string | null;
  flowId?: string | null;
  actionType?: string | null;
  requestMode?: "vision" | "text" | null;
  imageDetail?: "auto" | "low" | "high" | null;
  timeframe?: string | null;
  currencyPair?: string | null;
  metadata?: string | null;
};

export type OpenAiModerationResult = {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
  category_applied_input_types?: Record<string, string[]>;
};

export type OpenAiModerationResponse = {
  id?: string;
  model?: string;
  results?: OpenAiModerationResult[];
};

export function estimateOpenAiCostUsd(model: string | null | undefined, usage?: OpenAiUsage | null) {
  if (!model || !usage) return null;

  const pricingModel = getOpenAiPricingModelKey(model);
  if (!pricingModel) return null;

  const pricing = OPENAI_PRICING_USD_PER_MILLION[pricingModel];
  if (!pricing) return null;

  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) {
    return null;
  }

  const inputCost = (promptTokens * pricing.inputUsdPerMillion) / 1_000_000;
  const outputCost = (completionTokens * pricing.outputUsdPerMillion) / 1_000_000;
  return Number((inputCost + outputCost).toFixed(6));
}

async function recordUsageSafely(input: Parameters<typeof db.recordOpenAiUsageEvent>[0]) {
  try {
    await db.recordOpenAiUsageEvent(input);
  } catch (error) {
    logger.error("Failed to persist OpenAI usage event", {
      endpoint: input.endpoint,
      featureName: input.featureName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function invokeOpenAiChatCompletion<TResponse extends OpenAiChatCompletionResponse = OpenAiChatCompletionResponse>(params: {
  body: Record<string, unknown>;
  usage: OpenAiUsageContext;
}): Promise<TResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requestedModel = typeof params.body.model === "string" ? params.body.model : null;

  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify(params.body),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordUsageSafely({
      ...params.usage,
      model: requestedModel,
      success: false,
      errorMessage,
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const errorMessage = `OpenAI request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`;

    await recordUsageSafely({
      ...params.usage,
      model: requestedModel,
      success: false,
      errorMessage,
    });

    throw new Error(errorMessage);
  }

  const data = await response.json() as TResponse;
  const responseModel = typeof data.model === "string" ? data.model : requestedModel;
  const responseId = typeof data.id === "string" ? data.id : null;

  await recordUsageSafely({
    ...params.usage,
    model: responseModel,
    requestId: responseId,
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    totalTokens: data.usage?.total_tokens ?? null,
    estimatedCostUsd: estimateOpenAiCostUsd(responseModel, data.usage),
    success: true,
  });

  return data;
}

export async function invokeOpenAiModeration(params: {
  input: string;
  model?: string;
  usage: OpenAiUsageContext;
}): Promise<OpenAiModerationResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requestedModel = params.model ?? "omni-moderation-latest";
  let response: Response;
  try {
    response = await fetch(OPENAI_MODERATION_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: requestedModel,
        input: params.input,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordUsageSafely({
      ...params.usage,
      model: requestedModel,
      success: false,
      errorMessage,
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const errorMessage = `OpenAI moderation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`;
    await recordUsageSafely({
      ...params.usage,
      model: requestedModel,
      success: false,
      errorMessage,
    });
    throw new Error(errorMessage);
  }

  const data = await response.json() as OpenAiModerationResponse;
  await recordUsageSafely({
    ...params.usage,
    model: data.model ?? requestedModel,
    requestId: data.id ?? null,
    success: true,
  });
  return data;
}
