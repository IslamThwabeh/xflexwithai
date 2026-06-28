export const SITE_ORIGIN = "https://xflexacademy.com";
export const SITE_NAME = "XFlex Trading Academy";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/xflex-logo-2026-transparent.png`;

export type SeoLanguage = "ar" | "en";
export type SeoPageType =
  | "home"
  | "about"
  | "collection"
  | "service"
  | "course"
  | "article"
  | "contact"
  | "faq"
  | "legal"
  | "profile";

export type SeoRouteKey =
  | "home"
  | "about"
  | "events"
  | "articles"
  | "free-content"
  | "gifts"
  | "contact"
  | "faq"
  | "careers"
  | "terms"
  | "privacy"
  | "refund-policy"
  | "package-basic"
  | "package-comprehensive"
  | "vip-bot-plan"
  | "editorial-policy"
  | "risk-disclosure"
  | "author-editorial-team";

type LocalizedCopy = {
  title: string;
  description: string;
  heading: string;
  summary: string;
};

export type SeoRouteDefinition = {
  key: SeoRouteKey;
  path: string;
  type: SeoPageType;
  image?: string;
  updatedAt?: string;
  ar: LocalizedCopy;
  en: LocalizedCopy;
};

export const SEO_ROUTES: SeoRouteDefinition[] = [
  {
    key: "home",
    path: "",
    type: "home",
    ar: {
      title: "اكاديمية تداول XFlex | تعليم تداول عربي منظم ودعم عملي",
      description: "اكاديمية تداول عربية لتعلّم التداول خطوة بخطوة مع إدارة المخاطر، التحليل الفني، الدعم العملي وأدوات LexAI.",
      heading: "اكاديمية تداول عربية تبني قرارك لا اعتمادك",
      summary: "مسار عربي عملي لتعلّم أساسيات التداول والتحليل الفني وإدارة رأس المال والانضباط النفسي، مع دعم وأدوات تساعدك أثناء التعلّم.",
    },
    en: {
      title: "XFlex Trading Academy | Structured Trading Education",
      description: "Learn trading step by step with risk management, technical analysis, practical support, and LexAI tools.",
      heading: "Structured trading education built around better decisions",
      summary: "A practical learning path covering trading foundations, technical analysis, capital protection, psychology, and supported practice.",
    },
  },
  {
    key: "about",
    path: "/about",
    type: "about",
    ar: {
      title: "عن أكاديمية XFlex للتداول | منهجنا وقيمنا",
      description: "تعرف إلى منهج XFlex في تعليم التداول، قيم الأكاديمية، وطريقة بناء متداول أكثر استقلالاً وانضباطاً.",
      heading: "عن أكاديمية XFlex للتداول",
      summary: "نقدّم تعليماً منظماً يركز على الفهم وإدارة المخاطر والاستقلالية، بعيداً عن وعود الربح السريع.",
    },
    en: {
      title: "About XFlex Trading Academy | Our Method and Values",
      description: "Learn how XFlex approaches trading education, risk awareness, practical support, and student independence.",
      heading: "About XFlex Trading Academy",
      summary: "We teach a structured, risk-aware process designed to make students more informed and independent over time.",
    },
  },
  {
    key: "events",
    path: "/events",
    type: "collection",
    ar: {
      title: "فعاليات وورش التداول | أكاديمية XFlex",
      description: "تابع فعاليات وورش أكاديمية XFlex التعليمية حول التداول، التحليل وإدارة المخاطر.",
      heading: "فعاليات وورش أكاديمية XFlex",
      summary: "جلسات وفعاليات تعليمية تساعد المتداول على تحويل المعرفة إلى ممارسة منظمة.",
    },
    en: {
      title: "Trading Events and Workshops | XFlex Academy",
      description: "Explore XFlex educational events and workshops about trading, analysis, and risk management.",
      heading: "XFlex trading events and workshops",
      summary: "Educational sessions that help traders turn concepts into a more structured practice.",
    },
  },
  {
    key: "articles",
    path: "/articles",
    type: "collection",
    ar: {
      title: "مقالات تعليم التداول وإدارة المخاطر | XFlex",
      description: "مقالات عربية وإنجليزية عن التداول، إدارة المخاطر، علم النفس، التوصيات والوعود المضللة.",
      heading: "مقالات تعليم التداول وإدارة المخاطر",
      summary: "قراءات واضحة تساعدك على فهم السوق والمخاطر ونماذج العمل التي تقف خلف كثير من خدمات التداول.",
    },
    en: {
      title: "Trading Education and Risk Management Articles | XFlex",
      description: "Read practical articles about trading, risk, psychology, signals, and deceptive financial promises.",
      heading: "Trading education and risk management articles",
      summary: "Clear, practical reads about markets, risk, trading behavior, and the business models behind trading services.",
    },
  },
  {
    key: "free-content",
    path: "/free-content",
    type: "collection",
    ar: {
      title: "محتوى تداول مجاني | فيديوهات وأدلة XFlex",
      description: "ابدأ بمحتوى تداول مجاني من XFlex يشمل فيديوهات وأدلة عملية للمبتدئين.",
      heading: "محتوى تداول مجاني للمبتدئين",
      summary: "مواد مفتوحة تساعدك على اختبار أسلوبنا وبناء أساس أوضح قبل شراء أي برنامج.",
    },
    en: {
      title: "Free Trading Education | XFlex Videos and Guides",
      description: "Start with free XFlex trading videos and practical beginner guides.",
      heading: "Free trading education for beginners",
      summary: "Open resources that help you evaluate our teaching approach and build stronger foundations.",
    },
  },
  {
    key: "gifts",
    path: "/gifts",
    type: "collection",
    ar: {
      title: "هدايا وموارد مجانية للمتداول | XFlex",
      description: "اكتشف هدايا وموارد XFlex التعليمية المجانية للمتداولين.",
      heading: "هدايا وموارد تعليمية مجانية",
      summary: "موارد مختارة تساعدك على تنظيم التعلّم والممارسة وإدارة المخاطر.",
    },
    en: {
      title: "Free Trading Resources and Gifts | XFlex",
      description: "Discover free XFlex educational resources and trading learning gifts.",
      heading: "Free educational resources for traders",
      summary: "Selected resources designed to support structured learning, practice, and risk awareness.",
    },
  },
  {
    key: "contact",
    path: "/contact",
    type: "contact",
    ar: {
      title: "تواصل مع أكاديمية XFlex للتداول",
      description: "تواصل مع فريق XFlex للاستفسار عن الباقات، التسجيل، الوصول أو الدعم.",
      heading: "تواصل مع فريق XFlex",
      summary: "نجيب عن أسئلة الباقات والتسجيل والوصول والدعم من خلال القنوات الرسمية للأكاديمية.",
    },
    en: {
      title: "Contact XFlex Trading Academy",
      description: "Contact XFlex about packages, registration, access, or support.",
      heading: "Contact the XFlex team",
      summary: "Reach our official team for package, registration, access, and support questions.",
    },
  },
  {
    key: "faq",
    path: "/faq",
    type: "faq",
    ar: {
      title: "الأسئلة الشائعة عن أكاديمية XFlex والتداول",
      description: "إجابات واضحة عن باقات XFlex، طبيعة التعليم، الدعم، المخاطر وما لا تضمنه الأكاديمية.",
      heading: "الأسئلة الشائعة عن XFlex",
      summary: "إجابات مباشرة توضح ما نقدمه، طريقة الوصول، طبيعة المخاطر، وما لا يمكن لأي جهة مسؤولة أن تضمنه في التداول.",
    },
    en: {
      title: "XFlex Trading Academy Frequently Asked Questions",
      description: "Clear answers about XFlex packages, education, support, trading risk, and what the academy does not promise.",
      heading: "Frequently asked questions about XFlex",
      summary: "Direct answers about access, services, risk, and the limits of responsible trading education.",
    },
  },
  {
    key: "careers",
    path: "/careers",
    type: "collection",
    ar: {
      title: "الوظائف والانضمام إلى فريق XFlex",
      description: "استعرض فرص العمل المتاحة لدى أكاديمية XFlex وقدّم طلبك عبر القنوات الرسمية.",
      heading: "انضم إلى فريق XFlex",
      summary: "فرص مهنية للأشخاص الذين يشاركوننا قيمة الوضوح والمسؤولية وجودة خدمة المتعلّمين.",
    },
    en: {
      title: "Careers at XFlex Trading Academy",
      description: "Explore open roles at XFlex Trading Academy and apply through official channels.",
      heading: "Join the XFlex team",
      summary: "Career opportunities for people who value clarity, responsibility, and excellent learner support.",
    },
  },
  {
    key: "terms",
    path: "/terms",
    type: "legal",
    ar: {
      title: "شروط وأحكام أكاديمية XFlex",
      description: "اقرأ شروط استخدام خدمات أكاديمية XFlex، حدود المسؤولية وإخلاء مسؤولية التداول.",
      heading: "الشروط والأحكام",
      summary: "الشروط المنظمة لاستخدام المنصة والخدمات التعليمية وأدوات الذكاء الاصطناعي.",
    },
    en: {
      title: "XFlex Trading Academy Terms and Conditions",
      description: "Read the terms governing XFlex services, liability limitations, and trading disclaimers.",
      heading: "Terms and conditions",
      summary: "Terms governing the platform, educational services, and artificial-intelligence tools.",
    },
  },
  {
    key: "privacy",
    path: "/privacy",
    type: "legal",
    ar: {
      title: "سياسة الخصوصية | أكاديمية XFlex",
      description: "تعرف إلى البيانات التي تجمعها XFlex وكيف تستخدمها وتحميها وحقوقك المتعلقة بها.",
      heading: "سياسة الخصوصية",
      summary: "شرح للبيانات التي نجمعها، أغراض استخدامها، وسائل حمايتها وحقوق المستخدم.",
    },
    en: {
      title: "Privacy Policy | XFlex Trading Academy",
      description: "Learn what data XFlex collects, how it is used and protected, and your privacy rights.",
      heading: "Privacy policy",
      summary: "Details about collected data, processing purposes, protection measures, and user rights.",
    },
  },
  {
    key: "refund-policy",
    path: "/refund-policy",
    type: "legal",
    ar: {
      title: "سياسة الاشتراك والاسترجاع | XFlex",
      description: "اقرأ سياسة الاشتراك والاسترجاع والحالات الاستثنائية لدى أكاديمية XFlex.",
      heading: "سياسة الاشتراك والاسترجاع",
      summary: "القواعد المتعلقة بالاشتراكات والمدفوعات وطلبات الاسترجاع والحالات الاستثنائية.",
    },
    en: {
      title: "Subscription and Refund Policy | XFlex",
      description: "Read the XFlex subscription, refund, and exceptional-case policy.",
      heading: "Subscription and refund policy",
      summary: "Rules covering subscriptions, payments, refund requests, and exceptional cases.",
    },
  },
  {
    key: "package-basic",
    path: "/packages/basic",
    type: "course",
    ar: {
      title: "الباقة الأساسية لتعليم التداول | XFlex",
      description: "ابدأ مسار XFlex الأساسي لتعلّم التداول والتحليل وإدارة رأس المال بطريقة منظمة.",
      heading: "الباقة الأساسية لتعليم التداول",
      summary: "مسار تأسيسي منظم يركز على فهم السوق والتحليل وإدارة المخاطر وبناء خطة تداول.",
    },
    en: {
      title: "Basic Trading Education Package | XFlex",
      description: "Start the XFlex foundational path for trading, analysis, capital management, and planning.",
      heading: "Basic trading education package",
      summary: "A structured foundation covering markets, analysis, risk management, and trading-plan development.",
    },
  },
  {
    key: "package-comprehensive",
    path: "/packages/comprehensive",
    type: "course",
    ar: {
      title: "الباقة الشاملة لتعليم التداول وLexAI | XFlex",
      description: "مسار XFlex الشامل مع التعليم المنظم، الدعم، أدوات LexAI وخدمات المتابعة.",
      heading: "الباقة الشاملة لتعليم التداول",
      summary: "برنامج متكامل يجمع المسار التعليمي مع أدوات مساعدة ومتابعة عملية وفق شروط الباقة.",
    },
    en: {
      title: "Comprehensive Trading Education and LexAI Package | XFlex",
      description: "Explore the comprehensive XFlex path with structured education, support, and LexAI tools.",
      heading: "Comprehensive trading education package",
      summary: "An integrated program combining the learning path with practical support and eligible tools.",
    },
  },
  {
    key: "vip-bot-plan",
    path: "/project/vip-bot-plan",
    type: "service",
    ar: {
      title: "خطة تطوير بوت التداول VIP | XFlex",
      description: "خطة تقنية لبناء نظام تداول آلي منظم يركز على البيانات، الضوابط وإدارة المخاطر.",
      heading: "خطة تطوير بوت التداول VIP",
      summary: "تصور تقني لنظام آلي يعتمد على البيانات المنظمة والرقابة وإدارة المخاطر، لا على وعود الأرباح.",
    },
    en: {
      title: "VIP Trading Bot Development Plan | XFlex",
      description: "A technical plan for a controlled, data-driven automated trading system focused on risk management.",
      heading: "VIP trading bot development plan",
      summary: "A technical architecture based on structured data, operational controls, and risk management—not profit promises.",
    },
  },
  {
    key: "editorial-policy",
    path: "/editorial-policy",
    type: "legal",
    ar: {
      title: "السياسة التحريرية والتحقق من المحتوى | XFlex",
      description: "تعرف إلى معايير كتابة ومراجعة وتحديث وتصحيح المحتوى التعليمي والمالي لدى XFlex.",
      heading: "السياسة التحريرية والتحقق من المحتوى",
      summary: "نوضح كيف نكتب ونراجع ونحدّث المحتوى، وكيف نفصل التعليم عن الوعود المالية أو المصالح غير المعلنة.",
    },
    en: {
      title: "Editorial and Fact-Checking Policy | XFlex",
      description: "Learn how XFlex writes, reviews, updates, sources, and corrects educational financial content.",
      heading: "Editorial and fact-checking policy",
      summary: "Our standards for writing, review, sourcing, updates, corrections, and separating education from financial promises.",
    },
  },
  {
    key: "risk-disclosure",
    path: "/risk-disclosure",
    type: "legal",
    ar: {
      title: "إفصاح مخاطر التداول | أكاديمية XFlex",
      description: "إفصاح واضح عن مخاطر التداول والخسارة وحدود المحتوى التعليمي وأدوات التحليل.",
      heading: "إفصاح مخاطر التداول",
      summary: "التداول عالي المخاطر وقد يؤدي إلى خسارة رأس المال. المحتوى والأدوات تعليمية ولا تمثل ضماناً أو نصيحة مالية شخصية.",
    },
    en: {
      title: "Trading Risk Disclosure | XFlex Academy",
      description: "A clear disclosure of trading losses, educational-content limits, and analytical-tool risks.",
      heading: "Trading risk disclosure",
      summary: "Trading is high risk and can result in capital loss. Educational content and tools are not guarantees or personalized financial advice.",
    },
  },
  {
    key: "author-editorial-team",
    path: "/authors/xflex-editorial-team",
    type: "profile",
    ar: {
      title: "فريق XFlex التحريري | المؤلفون والمراجعون",
      description: "تعرف إلى مسؤوليات فريق XFlex التحريري في كتابة ومراجعة وتحديث محتوى تعليم التداول.",
      heading: "فريق XFlex التحريري",
      summary: "الفريق المسؤول عن إعداد المحتوى التعليمي، مراجعته لغوياً ومنهجياً، وتحديث الإفصاحات والمصادر.",
    },
    en: {
      title: "XFlex Editorial Team | Authors and Reviewers",
      description: "Meet the team responsible for writing, reviewing, and maintaining XFlex trading education content.",
      heading: "XFlex editorial team",
      summary: "The team responsible for educational writing, methodological review, disclosures, sourcing, and content maintenance.",
    },
  },
];

export function localizedPath(path: string, language: SeoLanguage) {
  return `/${language}${path}`.replace(/\/+$/, "") || `/${language}`;
}

export function getSeoRoute(key: SeoRouteKey) {
  const route = SEO_ROUTES.find((item) => item.key === key);
  if (!route) throw new Error(`Unknown SEO route: ${key}`);
  return route;
}

export function getSeoCopy(key: SeoRouteKey, language: SeoLanguage) {
  const route = getSeoRoute(key);
  return { route, copy: route[language] };
}

export function buildPageStructuredData(key: SeoRouteKey, language: SeoLanguage) {
  const { route, copy } = getSeoCopy(key, language);
  const url = `${SITE_ORIGIN}${localizedPath(route.path, language)}`;
  const organization = {
    "@type": "EducationalOrganization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    alternateName: [
      "XFlex Academy",
      "XFlex",
      "اكاديمية XFlex للتداول",
      "اكاديمية تداول XFlex",
      "أكاديمية تداول XFlex",
    ],
    url: SITE_ORIGIN,
    logo: DEFAULT_SOCIAL_IMAGE,
    email: "support@xflexacademy.com",
    sameAs: [
      "https://www.instagram.com/xflex.academy",
      "https://www.facebook.com/share/1Aj9HNNwsv/",
      "https://wa.me/972597596030",
    ],
    areaServed: [
      { "@type": "Country", name: "Palestine" },
      { "@type": "Place", name: "Arab world" },
    ],
    knowsAbout: [
      language === "ar" ? "تعليم التداول" : "Trading education",
      language === "ar" ? "إدارة المخاطر" : "Risk management",
      language === "ar" ? "التحليل الفني" : "Technical analysis",
      language === "ar" ? "علم نفس التداول" : "Trading psychology",
      language === "ar" ? "الفوركس والذهب" : "Forex and gold trading",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ramallah",
      addressCountry: "PS",
    },
  };
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      ...organization,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: copy.title,
      description: copy.description,
      inLanguage: language,
      isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      about: { "@id": `${SITE_ORIGIN}/#organization` },
    },
  ];

  if (route.type === "home") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: SITE_NAME,
      inLanguage: ["ar", "en"],
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    });
  }

  if (route.type === "course") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Course",
      name: copy.heading,
      description: copy.description,
      url,
      inLanguage: language,
      provider: { "@id": `${SITE_ORIGIN}/#organization` },
      educationalLevel: language === "ar" ? "مبتدئ إلى متقدم" : "Beginner to advanced",
      teaches: language === "ar"
        ? ["أساسيات التداول", "إدارة المخاطر", "التحليل الفني", "خطة التداول"]
        : ["Trading fundamentals", "Risk management", "Technical analysis", "Trading plan"],
    });
  }

  if (route.type === "faq") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: language === "ar"
        ? [
            {
              "@type": "Question",
              name: "هل تضمن أكاديمية XFlex الأرباح؟",
              acceptedAnswer: { "@type": "Answer", text: "لا. التداول عالي المخاطر ولا يمكن ضمان الأرباح أو منع الخسارة." },
            },
            {
              "@type": "Question",
              name: "هل المحتوى نصيحة مالية شخصية؟",
              acceptedAnswer: { "@type": "Answer", text: "لا. المحتوى تعليمي عام ولا يراعي الوضع المالي الفردي لكل مستخدم." },
            },
          ]
        : [
            {
              "@type": "Question",
              name: "Does XFlex guarantee trading profits?",
              acceptedAnswer: { "@type": "Answer", text: "No. Trading is high risk and profits or protection from loss cannot be guaranteed." },
            },
            {
              "@type": "Question",
              name: "Is the content personalized financial advice?",
              acceptedAnswer: { "@type": "Answer", text: "No. The content is general education and does not account for each user's financial circumstances." },
            },
          ],
    });
  }

  if (route.path) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: language === "ar" ? "الرئيسية" : "Home",
          item: `${SITE_ORIGIN}/${language}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.heading,
          item: url,
        },
      ],
    });
  }

  return schemas;
}
