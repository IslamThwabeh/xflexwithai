import { ENV } from "./env";
import { invokeOpenAiChatCompletion, type OpenAiUsageContext } from "./openai";

export type LexaiLanguage = "ar" | "en";
export type LexaiFlow = "m15" | "h4" | "single" | "feedback" | "feedback_with_image";

const DEFAULT_MODEL = "gpt-4o";
const RESPONSE_CHAR_LIMIT = 1024;
const FORCED_LEXAI_LANGUAGE: LexaiLanguage = "ar";

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
    return "انت محلل فني محترف للعملات. اكتب الرد بالكامل باللغة العربية فقط دون أي جمل إنجليزية. يسمح فقط بالرموز الفنية القياسية مثل XAU/USD و M15 و H4. المطلوب تحليل فني تعليمي من الصورة وليس نصيحة استثمارية شخصية. لا تستخدم عبارات الرفض العامة مثل: لا أستطيع المساعدة. إذا كانت الصورة غير واضحة، اذكر ذلك باختصار ثم قدم أفضل تحليل ممكن مما يظهر. التزم بعدم تجاوز 1024 حرف. لا تضف عدد الاحرف في النهاية.";
  }

  return "You are a professional FX technical analyst. Keep responses under 1024 characters. Do not append character counts.";
};

const getStopLossRules = (language: LexaiLanguage) => {
  if (language === "ar") {
    return "\n**قواعد وقف الخسارة الالزامية:**\n- الحد الاقصى 50 نقطة للعملات\n- للذهب XAU/USD الحد الاقصى 5 نقاط فقط\n- اذا احتاج السوق اكثر من الحد الاقصى فلا تقدم توصية\n";
  }

  return "\n**Mandatory stop-loss rules:**\n- Max 50 pips for FX pairs\n- For XAU/USD, max 5 points only\n- If market needs more, do not issue a trade recommendation\n";
};

const getVisibleTimeframeRules = (language: LexaiLanguage) => {
  if (language === "ar") {
    return "\n**قراءة الإطار الزمني من الصورة:**\n- اقرأ الإطار الزمني الظاهر داخل الصورة أولاً ولا تفترض M15 تلقائياً.\n- أمثلة مهمة من TradingView العربي: 15د = M15، 1س أو 1 ساعة = H1، 4س أو 4 ساعة = H4، 1ي أو 1 يوم = D1.\n- أمثلة إنجليزية: 15m = M15، 1h أو H1 = H1، 4h أو H4 = H4، 1D أو D1 = D1.\n- إذا ظهر الإطار بوضوح في الصورة فاستخدمه في عنوان التحليل حتى لو اختلف عن الإطار المرسل من الواجهة.\n- إذا لم يظهر الإطار بوضوح، اذكر أن الإطار غير واضح من الصورة ولا تخترعه.\n";
  }

  return "\n**Visible timeframe reading:**\n- Read the timeframe visible inside the image first and do not assume M15 by default.\n- Arabic TradingView examples: 15د = M15, 1س or 1 ساعة = H1, 4س or 4 ساعة = H4, 1ي or 1 يوم = D1.\n- English examples: 15m = M15, 1h or H1 = H1, 4h or H4 = H4, 1D or D1 = D1.\n- If the image clearly shows a timeframe, use it in the analysis title even if it differs from the UI-provided timeframe.\n- If the timeframe is not visible, say it is unclear instead of inventing one.\n";
};

const getExpectedTimeframeRules = (language: LexaiLanguage, expectedTimeframe: string) => {
  if (language === "ar") {
    return `${getVisibleTimeframeRules(language)}\n- هذا المسار مخصص لفريم ${expectedTimeframe}. إذا كانت الصورة تعرض فريماً مختلفاً بوضوح، اذكر ذلك باختصار واستخدم الفريم الظاهر في الصورة داخل العنوان.\n`;
  }

  return `${getVisibleTimeframeRules(language)}\n- This path is intended for ${expectedTimeframe}. If the image clearly shows a different timeframe, mention that briefly and use the visible timeframe in the title.\n`;
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
      return `قيّم تحليل المستخدم بدقة وبالعربية فقط.\n\nتحليل المستخدم:\n${userAnalysis ?? ""}\n\nاكتب الرد بهذا الشكل الإجباري:\n### 📝 تقييم التحليل\n\n**✅ نقاط القوة:**\n- ...\n\n**⚠️ نقاط التحسين:**\n- ...\n\n**💡 توصيات عملية:**\n- ...\n\n- اجعل التوصيات قابلة للتنفيذ ومباشرة.\n- لا تتجاوز 1024 حرف.${stopLoss}`;
    }

    if (flow === "h4") {
      return `أنت محلل فني محترف للعملات. هذا التحليل النهائي المدمج بين M15 و H4.${getExpectedTimeframeRules(language, "H4")}\n\nتحليل M15 السابق:\n${previousAnalysis ?? ""}\n\nمهم جدًا: اكتب الرد بالعربية فقط وبهذا القالب الإجباري نفسه: \n### 📈 التحليل الشامل (اكتب هنا فريم الصورة العليا مثل H4 إذا كان ظاهراً)\n\n**🎯 الاتجاه العام وهيكل السوق:**\n...\n\n**📊 مستويات فيبوناتشي الحرجة:**\n...\n\n**🛡️ الدعم والمقاومة الرئيسية:**\nالدعم: ...\nالمقاومة: ...\n\n**💧 تحليل SMC وICT:**\n- **مناطق السيولة (Liquidity):** ...\n- **أوامر التجميع (Order Blocks):** ...\n- **مناطق الطلب والعرض:** ...\n\n**💼 التوصيات الاستراتيجية:**\n- **نقاط الدخول الاستراتيجية:** ...\n- **أهداف جني الأرباح:** ...\n\n### 🟡 إعدادات وقف الخسارة للذهب (XAU/USD):\n- الحد الأقصى المطلق: 5 نقاط.\n- إذا تجاوز السوق 5 نقاط، لا تقدم توصية.\n\nسطر ختامي للمراقبة وإدارة المخاطر.\n\nشروط إلزامية:\n- أعطِ أرقامًا واضحة للدخول/الهدف/الوقف.\n- لا تخرج عن القالب.\n- لا تتجاوز 1024 حرف.${stopLoss}`;
    }

    if (flow === "single") {
      return `حلل الرسم البياني كتحليل فريم واحد واكتب بالعربية فقط.${getVisibleTimeframeRules(language)}\nالإطار المرسل من الواجهة للتوجيه فقط وليس بديلاً عن قراءة الصورة: ${timeframe ?? "غير محدد"}.\n\nاستخدم هذا القالب:\n### 📈 تحليل فريم واحد (اكتب هنا الإطار المقروء من الصورة مثل M15 أو H1 أو H4 أو D1)\n\n**🎯 الاتجاه العام وهيكل السوق:**\n...\n\n**🛡️ الدعم والمقاومة الرئيسية:**\nالدعم: ...\nالمقاومة: ...\n\n**💼 التوصية:**\n- دخول: ...\n- وقف خسارة: ...\n- هدف: ...\n\nسطر ختامي لإدارة المخاطر.\n\nتنبيه جودة: لا توصِ بالشراء مباشرة أسفل مقاومة واضحة أو البيع مباشرة فوق دعم واضح إلا مع ذكر شرط تأكيد مثل كسر وإغلاق أو إعادة اختبار.\n\nالتزم بحد 1024 حرف.${stopLoss}`;
    }

    return `حلل الرسم البياني للإطار ${timeframe ?? "M15"} بالعربية فقط.${getExpectedTimeframeRules(language, timeframe ?? "M15")}\n\nاكتب بصيغة منظمة تشمل: الاتجاه العام، الدعم/المقاومة، الدخول، الوقف، الهدف، وخلاصة إدارة المخاطر.\n\nتنبيه جودة: لا توصِ بالشراء مباشرة أسفل مقاومة واضحة أو البيع مباشرة فوق دعم واضح إلا مع ذكر شرط تأكيد مثل كسر وإغلاق أو إعادة اختبار.\n\nالتزم بحد 1024 حرف.${stopLoss}`;
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
  usage?: OpenAiUsageContext;
};

const looksLikeRefusal = (text: string) => {
  const value = text.toLowerCase();
  return (
    value.includes("i'm sorry") ||
    value.includes("i am sorry") ||
    value.includes("can't assist") ||
    value.includes("cannot assist") ||
    value.includes("لا أستطيع المساعدة") ||
    value.includes("لا يمكنني المساعدة")
  );
};

export async function analyzeLexai(params: AnalyzeParams) {
  ensureOpenAiKey();
  const forcedLanguage = FORCED_LEXAI_LANGUAGE;

  const prompt = getAnalysisPrompt(params.flow, {
    language: forcedLanguage,
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

  const usageContext: OpenAiUsageContext = {
    ...params.usage,
    requestMode: params.imageUrl ? "vision" : (params.usage?.requestMode ?? "text"),
    imageDetail: params.imageUrl ? "low" : (params.usage?.imageDetail ?? null),
    timeframe: params.timeframe ?? params.usage?.timeframe ?? null,
  };

  const requestAnalysis = async (extraInstruction?: string) => {
    return await invokeOpenAiChatCompletion<{
      id: string;
      choices: Array<{ message: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>({
      usage: usageContext,
      body: {
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: getSystemPrompt(forcedLanguage),
          },
          {
            role: "user",
            content: extraInstruction
              ? [
                  ...content,
                  {
                    type: "text",
                    text: extraInstruction,
                  },
                ]
              : content,
          },
        ],
        max_tokens: 700,
        temperature: 0.7,
      },
    });
  };

  let data = await requestAnalysis();
  let text = data.choices?.[0]?.message?.content ?? "";

  if (looksLikeRefusal(text)) {
    data = await requestAnalysis("لا تستخدم أي اعتذار أو رفض عام. نفذ التحليل الفني المطلوب مباشرة وبالعربية وضمن القالب المطلوب.");
    text = data.choices?.[0]?.message?.content ?? "";
  }

  return {
    id: data.id,
    model: data.model ?? DEFAULT_MODEL,
    usage: data.usage,
    text: trimToLimit(text.trim()),
  };
}
