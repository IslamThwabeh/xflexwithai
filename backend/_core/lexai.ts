import { ENV } from "./env";

export type LexaiLanguage = "ar" | "en";
export type LexaiFlow = "m15" | "h4" | "single" | "feedback" | "feedback_with_image";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o";
const RESPONSE_CHAR_LIMIT = 1024;

const ensureOpenAiKey = () => {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const trimToLimit = (value: string) => {
  if (value.length <= RESPONSE_CHAR_LIMIT) return value;
  return value.slice(0, RESPONSE_CHAR_LIMIT - 3) + "...";
};

const getSystemPrompt = (language: LexaiLanguage) => {
  if (language === "ar") {
    return "انت محلل فني محترف للعملات. التزم بعدم تجاوز 1024 حرف. لا تضف عدد الاحرف في النهاية.";
  }

  return "You are a professional FX technical analyst. Keep responses under 1024 characters. Do not append character counts.";
};

const getStopLossRules = (language: LexaiLanguage) => {
  if (language === "ar") {
    return "\n**قواعد وقف الخسارة الالزامية:**\n- الحد الاقصى 50 نقطة للعملات\n- للذهب XAU/USD الحد الاقصى 5 نقاط فقط\n- اذا احتاج السوق اكثر من الحد الاقصى فلا تقدم توصية\n";
  }

  return "\n**Mandatory stop-loss rules:**\n- Max 50 pips for FX pairs\n- For XAU/USD, max 5 points only\n- If market needs more, do not issue a trade recommendation\n";
};

const getAnalysisPrompt = (flow: LexaiFlow, opts: {
  language: LexaiLanguage;
  timeframe?: string;
  previousAnalysis?: string;
  userAnalysis?: string;
}) => {
  const { language, timeframe, previousAnalysis, userAnalysis } = opts;
  const stopLoss = getStopLossRules(language);

  if (language === "ar") {
    if (flow === "feedback" || flow === "feedback_with_image") {
      return `قيم تحليل المستخدم بدقة وقدم ملاحظات واضحة:\n\nتحليل المستخدم:\n${userAnalysis ?? ""}\n\nالمطلوب:\n- نقاط القوة\n- نقاط التحسين\n- توصيات عملية مختصرة${stopLoss}\nالتزم بحد 1024 حرف.`;
    }

    if (flow === "h4") {
      return `انت محلل فني محترف. هذا تحليل الأطار الثاني H4.\n\nالتحليل السابق (M15):\n${previousAnalysis ?? ""}\n\nالمطلوب:\n- دمج التحليلين\n- تحديد الدعم والمقاومة\n- توصية واضحة مع نقاط دخول وخروج${stopLoss}\nالتزم بحد 1024 حرف.`;
    }

    if (flow === "single") {
      return `حلل هذا الرسم البياني للاطار ${timeframe ?? "M15"}.\n\nالمطلوب:\n- الاتجاه العام\n- الدعم والمقاومة\n- توصية واضحة مع نقاط دخول وخروج${stopLoss}\nالتزم بحد 1024 حرف.`;
    }

    return `حلل الرسم البياني للاطار ${timeframe ?? "M15"}.\n\nالمطلوب:\n- الاتجاه العام\n- الدعم والمقاومة\n- توصية واضحة مع نقاط دخول وخروج${stopLoss}\nالتزم بحد 1024 حرف.`;
  }

  if (flow === "feedback" || flow === "feedback_with_image") {
    return `Review the user's analysis and give clear feedback.\n\nUser analysis:\n${userAnalysis ?? ""}\n\nInclude strengths, improvements, and concise recommendations.${stopLoss}\nKeep under 1024 characters.`;
  }

  if (flow === "h4") {
    return `This is the H4 timeframe analysis.\n\nPrevious M15 analysis:\n${previousAnalysis ?? ""}\n\nProvide merged insights, support/resistance, and a clear trade recommendation.${stopLoss}\nKeep under 1024 characters.`;
  }

  if (flow === "single") {
    return `Analyze the chart for timeframe ${timeframe ?? "M15"}.\n\nInclude trend, support/resistance, and a clear trade recommendation.${stopLoss}\nKeep under 1024 characters.`;
  }

  return `Analyze the chart for timeframe ${timeframe ?? "M15"}.\n\nInclude trend, support/resistance, and a clear trade recommendation.${stopLoss}\nKeep under 1024 characters.`;
};

type AnalyzeParams = {
  flow: LexaiFlow;
  language: LexaiLanguage;
  timeframe?: string;
  imageUrl?: string;
  previousAnalysis?: string;
  userAnalysis?: string;
};

export async function analyzeLexai(params: AnalyzeParams) {
  ensureOpenAiKey();

  const prompt = getAnalysisPrompt(params.flow, {
    language: params.language,
    timeframe: params.timeframe,
    previousAnalysis: params.previousAnalysis,
    userAnalysis: params.userAnalysis,
  });

  const content: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string; detail?: "low" | "high" } }> = [
    { type: "text", text: prompt },
  ];

  if (params.imageUrl) {
    content.push({
      type: "image_url",
      image_url: {
        url: params.imageUrl,
        detail: "low",
      },
    });
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: getSystemPrompt(params.language) },
        { role: "user", content },
      ],
      max_tokens: 700,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const data = await response.json() as {
    id: string;
    choices: Array<{ message: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    id: data.id,
    model: data.model ?? DEFAULT_MODEL,
    usage: data.usage,
    text: trimToLimit(text.trim()),
  };
}
