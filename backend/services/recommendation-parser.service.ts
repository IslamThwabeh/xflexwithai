import { z } from "zod";

import { ENV } from "../_core/env";
import { invokeOpenAiChatCompletion } from "../_core/openai";

const DRAFT_MAX_LENGTH = 4000;
const SIDE_MAP: Record<string, "BUY" | "SELL"> = {
  buy: "BUY",
  شراء: "BUY",
  sell: "SELL",
  بيع: "SELL",
};

const aiParserSchema = z.object({
  symbol: z.string().nullable().optional(),
  side: z.string().nullable().optional(),
  entryPrice: z.string().nullable().optional(),
  stopLoss: z.string().nullable().optional(),
  takeProfit1: z.string().nullable().optional(),
  takeProfit2: z.string().nullable().optional(),
  takeProfit3: z.string().nullable().optional(),
  riskPercent: z.string().nullable().optional(),
});

export type RecommendationParsedFields = {
  symbol?: string;
  side?: "BUY" | "SELL";
  entryPrice?: string;
  stopLoss?: string;
  takeProfit1?: string;
  takeProfit2?: string;
  takeProfit3?: string;
  riskPercent?: string;
};

export type RecommendationParseResult = {
  fields: RecommendationParsedFields;
  parser: {
    source: "rule" | "hybrid" | "ai";
    confidence: number;
    usedAi: boolean;
    warnings: string[];
  };
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeNumeric = (value: string | null | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/,/g, ".");
};

const normalizeSide = (value: string | null | undefined): "BUY" | "SELL" | undefined => {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return SIDE_MAP[key];
};

const extractSymbol = (lines: string[]) => {
  for (const line of lines) {
    const symbolOnly = line.match(/^([A-Z]{3,10}(?:\/?[A-Z]{3,10})?)$/);
    if (symbolOnly?.[1]) {
      return symbolOnly[1].replace("/", "").toUpperCase();
    }

    const tagged = line.match(/\b(?:symbol|pair|asset|زوج|الأصل)\s*[:=-]?\s*([A-Z]{3,10}(?:\/?[A-Z]{3,10})?)\b/i);
    if (tagged?.[1]) {
      return tagged[1].replace("/", "").toUpperCase();
    }
  }

  const joined = lines.join("\n");
  const fallback = joined.match(/\b([A-Z]{3,10}(?:\/?[A-Z]{3,10})?)\b/);
  return fallback?.[1] ? fallback[1].replace("/", "").toUpperCase() : undefined;
};

const extractSideAndEntry = (lines: string[]) => {
  const joined = lines.join("\n");
  let sideCandidate: "BUY" | "SELL" | undefined;

  for (const line of lines) {
    const sideMatch = line.match(/\b(buy|sell|شراء|بيع)\b/i);
    if (!sideMatch) continue;

    const side = normalizeSide(sideMatch[1]);
    const afterSide = line.slice(sideMatch.index! + sideMatch[0].length);
    const entryCandidate = afterSide.match(/-?\d+(?:[.,]\d+)?/);

    if (side) {
      sideCandidate = side;
    }

    if (side && entryCandidate?.[0]) {
      return {
        side,
        entryPrice: normalizeNumeric(entryCandidate?.[0]),
      };
    }
  }

  const sideMatch = joined.match(/\b(buy|sell|شراء|بيع)\b/i);
  const entryLine = lines.find((line) => /\b(entry|price|دخول|سعر الدخول)\b/i.test(line));
  const entryFromLine = entryLine?.match(/-?\d+(?:[.,]\d+)?/);

  return {
    side: sideCandidate || normalizeSide(sideMatch?.[1]),
    entryPrice: normalizeNumeric(entryFromLine?.[0]),
  };
};

const extractLevel = (lines: string[], levelRegexes: RegExp[]) => {
  for (const line of lines) {
    for (const regex of levelRegexes) {
      const match = line.match(regex);
      if (match?.[1]) {
        return normalizeNumeric(match[1]);
      }
    }
  }

  return undefined;
};

const parseWithRules = (rawText: string): RecommendationParseResult => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const symbol = extractSymbol(lines);
  const sideAndEntry = extractSideAndEntry(lines);

  const stopLoss = extractLevel(lines, [
    /(?:\b(?:sl|stop\s*loss|stoploss)\b|وقف(?:\s*الخسارة)?)\s*[:=-]?\s*(-?\d+(?:[.,]\d+)?)/i,
  ]);
  const takeProfit1 = extractLevel(lines, [
    /(?:\b(?:tp\s*1|tp1|target\s*1)\b|(?:هدف|الهدف)\s*1)\s*[:=-]?\s*(-?\d+(?:[.,]\d+)?)/i,
  ]);
  const takeProfit2 = extractLevel(lines, [
    /(?:\b(?:tp\s*2|tp2|target\s*2)\b|(?:هدف|الهدف)\s*2)\s*[:=-]?\s*(-?\d+(?:[.,]\d+)?)/i,
  ]);
  const takeProfit3 = extractLevel(lines, [
    /(?:\b(?:tp\s*3|tp3|target\s*3)\b|(?:هدف|الهدف)\s*3)\s*[:=-]?\s*(-?\d+(?:[.,]\d+)?)/i,
  ]);
  const riskPercent = extractLevel(lines, [
    /(?:\b(?:risk|risk\s*%|risk\s*percent)\b|نسبة\s*المخاطرة|المخاطرة)\s*[:=-]?\s*(-?\d+(?:[.,]\d+)?%?)/i,
  ]);

  const fields: RecommendationParsedFields = {
    symbol,
    side: sideAndEntry.side,
    entryPrice: sideAndEntry.entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskPercent,
  };

  let confidence = 0;
  if (fields.symbol) confidence += 0.2;
  if (fields.side) confidence += 0.2;
  if (fields.entryPrice) confidence += 0.2;
  if (fields.stopLoss) confidence += 0.2;
  if (fields.takeProfit1) confidence += 0.2;
  if (fields.takeProfit2) confidence += 0.05;
  if (fields.takeProfit3) confidence += 0.05;

  return {
    fields,
    parser: {
      source: "rule",
      confidence: Math.min(1, confidence),
      usedAi: false,
      warnings: [],
    },
  };
};

const parseWithAi = async (rawText: string): Promise<RecommendationParsedFields | null> => {
  if (!ENV.openaiApiKey) return null;

  const response = await invokeOpenAiChatCompletion<{
    id: string;
    choices: Array<{ message: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>({
    usage: {
      endpoint: "recommendations.parseDraft",
      featureName: "recommendations",
      flowType: "recommendation_channel",
      flowId: "recommendation-draft-parse",
      actionType: "parse_recommendation_draft",
      requestMode: "text",
      metadata: JSON.stringify({ length: rawText.length }),
    },
    body: {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract trading recommendation fields from user text. Return JSON only with keys: symbol, side, entryPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3, riskPercent. Use null when missing. side must be BUY or SELL when present.",
        },
        {
          role: "user",
          content: rawText,
        },
      ],
    },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  const parsed = aiParserSchema.safeParse(JSON.parse(content));
  if (!parsed.success) return null;

  const value = parsed.data;
  return {
    symbol: value.symbol ? normalizeWhitespace(value.symbol).replace("/", "").toUpperCase() : undefined,
    side: normalizeSide(value.side),
    entryPrice: normalizeNumeric(value.entryPrice ?? undefined),
    stopLoss: normalizeNumeric(value.stopLoss ?? undefined),
    takeProfit1: normalizeNumeric(value.takeProfit1 ?? undefined),
    takeProfit2: normalizeNumeric(value.takeProfit2 ?? undefined),
    takeProfit3: normalizeNumeric(value.takeProfit3 ?? undefined),
    riskPercent: normalizeNumeric(value.riskPercent ?? undefined),
  };
};

const mergeFields = (primary: RecommendationParsedFields, fallback: RecommendationParsedFields) => ({
  symbol: primary.symbol || fallback.symbol,
  side: primary.side || fallback.side,
  entryPrice: primary.entryPrice || fallback.entryPrice,
  stopLoss: primary.stopLoss || fallback.stopLoss,
  takeProfit1: primary.takeProfit1 || fallback.takeProfit1,
  takeProfit2: primary.takeProfit2 || fallback.takeProfit2,
  takeProfit3: primary.takeProfit3 || fallback.takeProfit3,
  riskPercent: primary.riskPercent || fallback.riskPercent,
});

const hasStrongRuleParse = (result: RecommendationParseResult) => {
  const { fields } = result;
  return result.parser.confidence >= 0.75 && !!fields.symbol && !!fields.side && (!!fields.entryPrice || !!fields.stopLoss || !!fields.takeProfit1);
};

export async function parseRecommendationDraft(rawText: string): Promise<RecommendationParseResult> {
  const normalizedText = rawText.trim().slice(0, DRAFT_MAX_LENGTH);
  const ruleResult = parseWithRules(normalizedText);

  if (hasStrongRuleParse(ruleResult)) {
    return ruleResult;
  }

  const warnings = [...ruleResult.parser.warnings];
  if (!ENV.openaiApiKey) {
    warnings.push("AI fallback is unavailable because OPENAI_API_KEY is missing.");
    return {
      ...ruleResult,
      parser: {
        ...ruleResult.parser,
        warnings,
      },
    };
  }

  try {
    const aiFields = await parseWithAi(normalizedText);
    if (!aiFields) {
      warnings.push("AI fallback could not extract additional fields.");
      return {
        ...ruleResult,
        parser: {
          ...ruleResult.parser,
          warnings,
        },
      };
    }

    const merged = mergeFields(ruleResult.fields, aiFields);
    const source: "hybrid" | "ai" = Object.keys(ruleResult.fields).length ? "hybrid" : "ai";

    return {
      fields: merged,
      parser: {
        source,
        confidence: Math.max(ruleResult.parser.confidence, 0.9),
        usedAi: true,
        warnings,
      },
    };
  } catch {
    warnings.push("AI fallback failed; using rule-based extraction only.");
    return {
      ...ruleResult,
      parser: {
        ...ruleResult.parser,
        warnings,
      },
    };
  }
}
