export type PublicArticleTheme = "emerald" | "teal" | "amber";

export type CuratedArticle = {
  id: number;
  slug: string;
  titleEn: string;
  titleAr: string;
  excerptEn: string;
  excerptAr: string;
  contentEn: string;
  contentAr: string;
  subjectEn: string;
  subjectAr: string;
  thumbnailUrl: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  authorId: number | null;
  isPublished: boolean;
  isCurated: true;
  readingTimeMinutes: number;
  theme: PublicArticleTheme;
};

const publishedBase = "2026-04-09T08:00:00.000Z";

export const CURATED_ARTICLES: CuratedArticle[] = [
  {
    id: -101,
    slug: "trading-mafia-palestine-arab-world",
    titleEn: "Trading Mafia in Palestine and the Arab World",
    titleAr: "مافيا التداول في فلسطين والعالم العربي",
    excerptEn:
      "How beginner traders get sold fast-track dreams through fabricated results, status marketing, and unverifiable win rates.",
    excerptAr:
      "كيف يتم بيع حلم الربح السريع للمتداول المبتدئ عبر نتائج مفبركة وتسويق للمظاهر ونِسب نجاح لا يمكن التحقق منها؟",
    contentEn:
      "Across Palestine and the Arab world, a large part of trading marketing is built on spectacle before substance. The beginner sees screenshots, luxury branding, and aggressive urgency long before he sees a real methodology.\n\nWhat often stays hidden is the business model behind that noise: sell the course, sell the private channel, or push the broker referral before proving that the process itself is repeatable. When the attention economy becomes the product, education usually becomes secondary.\n\nThat is why many new traders confuse confidence with competence. A loud promise, a rented lifestyle, and selective winning trades can create the illusion of mastery even when the underlying process is weak, inconsistent, or intentionally incomplete.\n\nSerious trading education sounds slower. It talks about probabilities, position size, journaling, and emotional control. It explains what happens during losing streaks, not only what happens when the market behaves perfectly.\n\nBefore trusting any trading source, ask harder questions: How are results tracked? Are drawdowns shown clearly? Is there a conflict of interest with a broker or affiliate model? If those answers stay vague, that vagueness is part of the risk.\n\nA strong mentor makes the trader more independent over time. A bad actor makes the trader more dependent, more rushed, and more afraid to question what he is being sold.",
    contentAr:
      "في فلسطين والعالم العربي، جزء كبير من تسويق التداول يقوم على المظهر قبل الجوهر. المتداول المبتدئ يرى لقطات أرباح وهوية فاخرة وإحساساً بالاستعجال قبل أن يرى منهجية حقيقية يمكن قياسها.\n\nالذي يبقى مخفياً غالباً هو نموذج الربح خلف هذا الضجيج: بيع الدورة، أو بيع القناة الخاصة، أو دفعك إلى رابط وسيط قبل إثبات أن الطريقة نفسها قابلة للتكرار. عندما تصبح الإثارة هي المنتج، يتراجع التعليم إلى الخلف.\n\nلهذا يخلط كثير من المبتدئين بين الثقة والقدرة. الوعد العالي، ونمط الحياة المستأجر، وإظهار الصفقات الرابحة فقط يمكن أن يصنع صورة زائفة عن الاحتراف حتى لو كانت الآلية نفسها ضعيفة أو متقطعة أو ناقصة عمداً.\n\nالتعليم الجاد في التداول يبدو أهدأ وأبطأ. يتحدث عن الاحتمالات، وحجم العقد، وتوثيق الصفقات، والانضباط النفسي. ويشرح لك ما يحدث في فترات الخسارة، لا فقط في اللحظات التي يتعاون فيها السوق مع المتداول.\n\nقبل أن تثق بأي مصدر في التداول، اسأل أسئلة أصعب: كيف يتم توثيق النتائج؟ هل يتم عرض التراجعات بوضوح؟ وهل توجد مصلحة مع وسيط أو برنامج إحالة؟ إذا بقيت الإجابات ضبابية، فهذه الضبابية نفسها جزء من الخطر.\n\nالمدرب القوي يجعلك مع الوقت أكثر استقلالاً. أما من يبيع الوهم، فيجعل المتداول أكثر اعتماداً عليه، وأكثر استعجالاً، وأكثر تردداً في طرح الأسئلة الصعبة.",
    subjectEn: "Deceptive Promises",
    subjectAr: "كشف الوعود الوهمية",
    thumbnailUrl: "/article-covers/trading-mafia.png",
    publishedAt: "2026-04-11T08:30:00.000Z",
    createdAt: publishedBase,
    updatedAt: publishedBase,
    authorId: null,
    isPublished: true,
    isCurated: true,
    readingTimeMinutes: 4,
    theme: "emerald",
  },
  {
    id: -102,
    slug: "what-sits-behind-trading-profits",
    titleEn: "What Sits Behind Trading Profits",
    titleAr: "ما وراء أرباح التداول",
    excerptEn:
      "Screenshots of profit do not tell you about risk, capital, failed attempts, or the discipline required to survive the next trade.",
    excerptAr:
      "لقطات الأرباح لا تخبرك عن المخاطرة أو رأس المال أو المحاولات الفاشلة أو مقدار الانضباط المطلوب للاستمرار في الصفقة التالية.",
    contentEn:
      "Profit screenshots are attractive because they compress a difficult profession into one easy number. They make trading look instant, obvious, and emotionally clean.\n\nBut a single profitable trade says almost nothing on its own. It does not show account size, risk per position, the number of previous losses, the drawdown endured before recovery, or the stress required to hold the trade to its target.\n\nThis is why sustainable profitability usually looks boring from the outside. It comes from clear criteria, controlled risk, and the ability to repeat the same behavior even when the market becomes noisy or emotional.\n\nSerious traders evaluate distributions, not isolated outcomes. They ask what happens across twenty or fifty trades, whether the strategy survives changing conditions, and how much psychological pressure the process creates.\n\nBefore admiring the result, inspect the structure behind it. Was the stop loss defined before entry? Was the trade taken because it matched a plan or because it felt exciting? Was the reward worth the risk being carried?\n\nProfit is not the real goal if it destroys discipline. The real goal is a process that can keep producing acceptable outcomes without breaking the trader financially or mentally.",
    contentAr:
      "لقطات الأرباح جذابة لأنها تختصر مهنة صعبة في رقم واحد سهل. تجعل التداول يبدو سريعاً وواضحاً ونظيفاً من الناحية النفسية.\n\nلكن صفقة رابحة واحدة لا تقول شيئاً تقريباً إذا وقفت وحدها. فهي لا توضح حجم الحساب، ولا نسبة المخاطرة، ولا عدد الخسائر السابقة، ولا حجم التراجع الذي سبق التعافي، ولا الضغط النفسي المطلوب للصمود حتى الهدف.\n\nلهذا تبدو الربحية المستدامة مملة من الخارج. فهي تأتي من معايير واضحة، ومخاطرة منضبطة، وقدرة على تكرار السلوك نفسه حتى عندما يصبح السوق فوضوياً أو عاطفياً.\n\nالمتداول الجاد لا يقيم النتيجة المنفردة، بل يقيم التوزيع الكامل للنتائج. يسأل: ماذا يحدث بعد عشرين أو خمسين صفقة؟ هل تبقى الاستراتيجية صالحة عندما تتغير ظروف السوق؟ وما الثمن النفسي الذي تفرضه؟\n\nقبل أن تنبهر بالنتيجة، افحص الهيكل الذي صنعها. هل كان وقف الخسارة محدداً قبل الدخول؟ هل تم فتح الصفقة لأنها تطابق خطة واضحة أم لأنها بدت مثيرة؟ وهل كان العائد يستحق حجم المخاطرة؟\n\nالربح ليس الهدف الحقيقي إذا كان يدمّر الانضباط. الهدف الحقيقي هو بناء عملية يمكنها أن تنتج نتائج مقبولة باستمرار من دون أن تكسر المتداول مالياً أو نفسياً.",
    subjectEn: "Profit Reality",
    subjectAr: "قراءة واقعية للأرباح",
    thumbnailUrl: "/article-covers/beyond-profits.png",
    publishedAt: "2026-04-10T08:30:00.000Z",
    createdAt: publishedBase,
    updatedAt: publishedBase,
    authorId: null,
    isPublished: true,
    isCurated: true,
    readingTimeMinutes: 4,
    theme: "teal",
  },
  {
    id: -103,
    slug: "when-free-signal-channels-become-a-trap",
    titleEn: "When Free Signal Channels Become a Trap",
    titleAr: "قنوات التوصيات المجانية لما تكون فخاً لا خدمة",
    excerptEn:
      "Some free channels are useful, but others monetize you through broker funnels, emotional urgency, and unmanaged entries.",
    excerptAr:
      "ليست كل قناة مجانية سيئة، لكن بعض القنوات تربح منك عبر الإحالات للوسطاء والاستعجال العاطفي والدخول بلا إدارة حقيقية للمخاطرة.",
    contentEn:
      "Not every free signal channel is malicious. Some are honest communities that share ideas, context, and educational value. The problem is that free access is often only the front door to another business model.\n\nIn many cases, the real revenue comes from broker referrals, VIP upgrades, or keeping the audience hyperactive regardless of market quality. The channel profits when the user stays emotionally engaged, not when the user becomes independent.\n\nThe warning signs are easy to miss: too many trades, no invalidation levels, vague stop losses, constant urgency, and a feed full of wins without transparent post-trade review.\n\nA healthy signal service should tell you why the setup exists, when it is wrong, how much risk it assumes, and when staying out of the market is the better decision. Silence on these points is not a small flaw. It is the central risk.\n\nIf a channel makes you trade more, think less, and depend completely on alerts, it is weakening your edge rather than building it.\n\nUse free channels as case studies, not as a substitute for your own trading plan. The goal is to become harder to manipulate, not easier to direct.",
    contentAr:
      "ليست كل قناة توصيات مجانية خبيثة. بعض القنوات صادق فعلاً ويقدم أفكاراً وسياقاً وتعليماً مفيداً. المشكلة أن كلمة مجاني تكون أحياناً مجرد باب دخول لنموذج ربح آخر.\n\nفي حالات كثيرة، يأتي الربح الحقيقي من إحالات الوسطاء، أو من ترقيات VIP، أو من إبقاء المتابع في حالة حركة مستمرة بغض النظر عن جودة السوق. القناة تربح عندما تبقى متفاعلاً عاطفياً، لا عندما تصبح مستقلاً في قرارك.\n\nعلامات الخطر سهلة لكنها تمر بسرعة: عدد كبير من الصفقات، غياب مستويات الإبطال، وقف خسارة ضبابي، لهجة مستعجلة، وقناة مليئة بالنتائج الإيجابية من دون مراجعة واضحة بعد انتهاء الصفقة.\n\nالخدمة الصحية للتوصيات يجب أن تشرح لماذا توجد الفرصة، ومتى تصبح خاطئة، وكم من المخاطرة تتحمل، ومتى يكون عدم الدخول هو القرار الأفضل. الصمت عن هذه الأسئلة ليس تفصيلاً صغيراً، بل هو أصل المشكلة.\n\nإذا كانت القناة تجعلك تتداول أكثر وتفكر أقل وتعتمد بالكامل على التنبيه، فهي تضعف ميزتك بدلاً من أن تبنيها.\n\nتعامل مع القنوات المجانية كدراسة حالة، لا كبديل عن خطتك الخاصة. الهدف أن تصبح أصعب في التلاعب، لا أسهل في التوجيه.",
    subjectEn: "Signal Channel Risk",
    subjectAr: "مخاطر قنوات التوصيات",
    thumbnailUrl: "/article-covers/signal-trap.png",
    publishedAt: "2026-04-09T08:30:00.000Z",
    createdAt: publishedBase,
    updatedAt: publishedBase,
    authorId: null,
    isPublished: true,
    isCurated: true,
    readingTimeMinutes: 3,
    theme: "amber",
  },
];

export function getCuratedArticleBySlug(slug: string) {
  return CURATED_ARTICLES.find((article) => article.slug === slug) ?? null;
}

export function estimateReadingTimeMinutes(content?: string | null) {
  const wordCount = (content ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(wordCount / 170));
}