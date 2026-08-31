import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GA_MEASUREMENT_ID,
  DEFAULT_SOCIAL_IMAGE,
  SEO_ROUTES,
  SITE_NAME,
  SITE_ORIGIN,
  buildPageStructuredData,
  localizedPath,
  type SeoLanguage,
} from "../shared/seo";
import {
  CURATED_ARTICLES,
  getArticleAvailableLanguages,
  isArticleAvailableInLanguage,
} from "../shared/curatedArticles";
import { renderArticleContentHtml, renderArticleSourcesHtml } from "../shared/articleContent";

const outputRoot = path.resolve(process.cwd(), "dist/public");
const templatePath = path.join(outputRoot, "index.html");
const languages: SeoLanguage[] = ["ar", "en"];

type PublicArticle = (typeof CURATED_ARTICLES)[number] & {
  isCurated?: boolean;
  seoTitleEn?: string | null;
  seoTitleAr?: string | null;
  seoDescriptionEn?: string | null;
  seoDescriptionAr?: string | null;
  socialImageUrl?: string | null;
  authorNameEn?: string | null;
  authorNameAr?: string | null;
  reviewerNameEn?: string | null;
  reviewerNameAr?: string | null;
  sources?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value: unknown) {
  return escapeHtml(value);
}

function absoluteUrl(value?: string | null) {
  if (!value) return DEFAULT_SOCIAL_IMAGE;
  return value.startsWith("http") ? value : `${SITE_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

async function fetchPublishedArticles(): Promise<PublicArticle[]> {
  const articles = [...CURATED_ARTICLES] as PublicArticle[];
  if (process.env.SEO_FETCH_DYNAMIC_ARTICLES === "false") return articles;

  const endpoint = process.env.SEO_ARTICLES_ENDPOINT
    || "https://api.xflexacademy.com/api/trpc/articles.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D";
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return articles;
    const payload = await response.json() as any;
    const remote = payload?.[0]?.result?.data?.json
      ?? payload?.result?.data?.json
      ?? payload?.result?.data
      ?? payload;
    if (!Array.isArray(remote)) return articles;
    const curatedSlugs = new Set(articles.map((article) => article.slug));
    for (const article of remote) {
      if (article?.slug && article?.isPublished !== false && !curatedSlugs.has(article.slug)) {
        articles.push(article);
      }
    }
  } catch {
    console.warn("[seo] Dynamic article fetch unavailable; generated curated article pages only.");
  }
  return articles;
}

function setMeta(html: string, selector: RegExp, replacement: string) {
  return selector.test(html) ? html.replace(selector, replacement) : html.replace("</head>", `  ${replacement}\n</head>`);
}

function analyticsMarkup() {
  const measurementId = process.env.VITE_GA_MEASUREMENT_ID?.trim() || DEFAULT_GA_MEASUREMENT_ID;
  if (!measurementId) return "";
  return `
    <script id="xflex-ga4-script" async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(measurementId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = window.gtag || gtag;
      gtag('js', new Date());
      gtag('config', '${escapeHtml(measurementId)}', {
        send_page_view: false,
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: window.location.origin + window.location.pathname,
        page_referrer: (() => {
          try {
            const referrer = new URL(document.referrer);
            return referrer.origin + referrer.pathname;
          } catch {
            return undefined;
          }
        })()
      });
      window.__xflexAnalyticsConfigured = true;
      window.__xflexAnalyticsMeasurementId = '${escapeHtml(measurementId)}';
    </script>`;
}

function verificationMarkup() {
  const tags = [
    ["google-site-verification", process.env.VITE_GOOGLE_SITE_VERIFICATION],
    ["msvalidate.01", process.env.VITE_BING_SITE_VERIFICATION],
  ];
  return tags
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([name, value]) => `<meta name="${name}" content="${escapeHtml(value)}" />`)
    .join("\n    ");
}

function prerenderShell(language: SeoLanguage, heading: string, summary: string, body = "") {
  const isArabic = language === "ar";
  return `<main id="seo-prerender" class="seo-prerender" data-language="${language}">
    <nav aria-label="${isArabic ? "التنقل الرئيسي" : "Primary navigation"}">
      <a href="/${language}">${isArabic ? "الرئيسية" : "Home"}</a>
      <a href="/${language}/articles">${isArabic ? "المقالات" : "Articles"}</a>
      <a href="/${language}/free-content">${isArabic ? "محتوى مجاني" : "Free content"}</a>
      <a href="/${language}/about">${isArabic ? "عن الأكاديمية" : "About"}</a>
      <a href="/${language}/contact">${isArabic ? "تواصل" : "Contact"}</a>
    </nav>
    <article>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(summary)}</p>
      ${body}
    </article>
    <footer>
      <a href="/${language}/editorial-policy">${isArabic ? "السياسة التحريرية" : "Editorial policy"}</a>
      <a href="/${language}/risk-disclosure">${isArabic ? "إفصاح المخاطر" : "Risk disclosure"}</a>
      <a href="/${language}/authors/xflex-editorial-team">${isArabic ? "فريق التحرير" : "Editorial team"}</a>
    </footer>
  </main>`;
}

function articleCollectionBody(language: SeoLanguage, articles: PublicArticle[]) {
  const isArabic = language === "ar";
  const localizedArticles = articles.filter((article) => isArticleAvailableInLanguage(article, language));
  return `<section aria-labelledby="published-articles">
    <h2 id="published-articles">${isArabic ? "المقالات المنشورة" : "Published articles"}</h2>
    <ul>${localizedArticles.map((article) => {
      const title = isArabic ? article.titleAr : article.titleEn;
      const excerpt = isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
      return `<li><a href="/${language}/articles/${escapeHtml(article.slug)}">${escapeHtml(title)}</a><p>${escapeHtml(excerpt)}</p></li>`;
    }).join("")}</ul>
  </section>`;
}

function homePrerenderBody(language: SeoLanguage) {
  const isArabic = language === "ar";
  if (isArabic) {
    return `<section aria-labelledby="arabic-trading-academy">
      <h2 id="arabic-trading-academy">اكاديمية تداول للمتداول العربي</h2>
      <p>تجمع XFlex بين مسار تعليمي منظم، تطبيق عملي، إدارة مخاطر، تحليل فني، ومتابعة تساعد الطالب على بناء خطة تداول واضحة بعيداً عن وعود الربح السريع.</p>
      <ul>
        <li><a href="/ar/packages/basic">الباقة الأساسية لتعليم التداول</a></li>
        <li><a href="/ar/packages/comprehensive">الباقة الشاملة مع LexAI والدعم العملي</a></li>
        <li><a href="/ar/free-content">محتوى تداول مجاني للمبتدئين</a></li>
        <li><a href="/ar/risk-disclosure">إفصاح مخاطر التداول وحدود المحتوى التعليمي</a></li>
      </ul>
    </section>`;
  }
  return `<section aria-labelledby="structured-trading-academy">
    <h2 id="structured-trading-academy">A structured trading academy for Arabic-speaking learners</h2>
    <p>XFlex combines organized education, practical support, risk management, technical analysis, and learning tools that help students build a clearer trading plan.</p>
    <ul>
      <li><a href="/en/packages/basic">Basic trading education package</a></li>
      <li><a href="/en/packages/comprehensive">Comprehensive package with LexAI and support</a></li>
      <li><a href="/en/free-content">Free trading education for beginners</a></li>
      <li><a href="/en/risk-disclosure">Trading risk disclosure and educational limits</a></li>
    </ul>
  </section>`;
}

function packagePrerenderBody(language: SeoLanguage, routeKey: string) {
  const isArabic = language === "ar";
  const isComprehensive = routeKey === "package-comprehensive";
  if (isArabic) {
    return `<section aria-labelledby="package-details">
      <h2 id="package-details">${isComprehensive ? "ماذا تشمل الباقة الشاملة؟" : "ماذا تشمل الباقة الأساسية؟"}</h2>
      <p>${isComprehensive
        ? "مسار اكاديمية تداول متكامل يجمع التعليم المنظم، الدعم العملي، أدوات LexAI، والمتابعة المناسبة للمتداول الجاد."
        : "مسار تأسيسي داخل اكاديمية تداول XFlex يركز على الأساسيات، إدارة رأس المال، التحليل الفني، وبناء خطة تداول عملية."}</p>
      <p>التداول عالي المخاطر، لذلك نربط كل مسار بتعليم واضح حول وقف الخسارة، حجم الصفقة، والانضباط النفسي بدلاً من تقديم وعود ربح.</p>
    </section>`;
  }
  return `<section aria-labelledby="package-details">
    <h2 id="package-details">${isComprehensive ? "What does the comprehensive package include?" : "What does the basic package include?"}</h2>
    <p>${isComprehensive
      ? "A complete XFlex path combining structured education, practical support, LexAI tools, and guided follow-up for serious learners."
      : "A foundation path focused on market basics, capital management, technical analysis, and building a practical trading plan."}</p>
    <p>Trading is high risk, so each path teaches stop-loss discipline, position sizing, and emotional control instead of profit promises.</p>
  </section>`;
}

/**
 * Keep the crawlable shell useful even before the React bundle hydrates. Bing's
 * thin-content signal is based on this HTML, so each public collection/info
 * route gets a short, factual explanation and a few relevant internal links.
 * Private routes and redirects are not generated here and remain intentionally
 * excluded from discovery.
 */
function staticRoutePrerenderBody(language: SeoLanguage, routeKey: string) {
  const isArabic = language === "ar";
  switch (routeKey) {
    case "about":
      return isArabic
        ? `<section><h2>منهج XFlex في تعليم التداول</h2><p>نبدأ بفهم السوق والتحليل وإدارة رأس المال، ثم نربط المعرفة بالتطبيق المنظم والمراجعة. الهدف هو مساعدة المتعلم على اتخاذ قرارات أوضح وبناء استقلاليته، لا تقديم وعود بنتائج مضمونة.</p><h2>مسارات التعلّم</h2><p>يمكنك البدء من <a href="/ar/packages/basic">الباقة الأساسية</a> أو مقارنة المسار مع <a href="/ar/packages/comprehensive">الباقة الشاملة</a>، ثم قراءة <a href="/ar/risk-disclosure">إفصاح المخاطر</a> قبل التسجيل.</p></section>`
        : `<section><h2>How XFlex approaches trading education</h2><p>We start with market understanding, analysis, and capital management, then connect learning to structured practice and review. The goal is clearer decisions and learner independence, not guaranteed results.</p><h2>Learning paths</h2><p>Begin with the <a href="/en/packages/basic">Basic package</a>, compare the <a href="/en/packages/comprehensive">Comprehensive package</a>, and read the <a href="/en/risk-disclosure">risk disclosure</a> before registering.</p></section>`;
    case "events":
      return isArabic
        ? `<section><h2>ما الذي تجده في الفعاليات؟</h2><p>تجمع الفعاليات التعليمية بين شرح المفاهيم، التحليل، إدارة المخاطر والأسئلة العملية. تختلف المواعيد والتسجيل حسب الحدث المنشور، لذلك راجع التفاصيل أو <a href="/ar/contact">تواصل مع الفريق</a> قبل الحضور.</p><h2>قبل المشاركة</h2><p>اطّلع على <a href="/ar/free-content">المحتوى المجاني</a> و<a href="/ar/risk-disclosure">إفصاح مخاطر التداول</a> لتعرف حدود التعليم وما تحتاجه من استعداد.</p></section>`
        : `<section><h2>What to expect from events</h2><p>Educational events combine concept explanations, analysis, risk management, and practical questions. Dates and registration vary by published event, so check the details or <a href="/en/contact">contact the team</a> before attending.</p><h2>Before you join</h2><p>Review the <a href="/en/free-content">free content</a> and <a href="/en/risk-disclosure">trading risk disclosure</a> so you understand the educational scope and preparation required.</p></section>`;
    case "free-content":
      return isArabic
        ? `<section><h2>ابدأ من الموارد المفتوحة</h2><p>تضم هذه الصفحة فيديوهات وأدلة قصيرة تساعدك على مراجعة أساسيات السوق، إدارة المخاطر والانضباط قبل اختيار برنامج مدفوع. استخدمها للتعلم والمقارنة، وليس كضمان لنتيجة مالية.</p><h2>خطوة تالية</h2><p>بعد بناء أساس أولي، اقرأ <a href="/ar/articles">المقالات التعليمية</a> أو قارن <a href="/ar/packages/basic">مسارات الباقات</a>، وتحقق دائماً من <a href="/ar/risk-disclosure">حدود المخاطر</a>.</p></section>`
        : `<section><h2>Start with open resources</h2><p>This page provides short videos and guides for reviewing market basics, risk management, and discipline before choosing a paid program. Use them for learning and comparison, not as a promise of financial results.</p><h2>Choose a next step</h2><p>After building a foundation, read the <a href="/en/articles">education articles</a> or compare the <a href="/en/packages/basic">package paths</a>, and always review the <a href="/en/risk-disclosure">risk limits</a>.</p></section>`;
    case "gifts":
      return isArabic
        ? `<section><h2>موارد عملية مجانية</h2><p>تجمع الهدايا روابط إلى مواد بداية مختارة، فيديوهات تعليمية ومقالات تساعدك على تنظيم الدراسة والممارسة. اختر المورد الذي يناسب مستواك ثم دوّن ما تعلمته في خطة واضحة.</p><h2>استخدمها بوعي</h2><p>الموارد التعليمية لا تلغي مخاطر السوق. ابدأ من <a href="/ar/free-content">المكتبة المجانية</a>، اقرأ <a href="/ar/articles">المقالات</a>، وراجع <a href="/ar/risk-disclosure">إفصاح المخاطر</a> قبل التداول.</p></section>`
        : `<section><h2>Practical free resources</h2><p>These gifts link to selected starter materials, educational videos, and articles that help organize study and practice. Choose a resource for your level and record what you learn in a clear plan.</p><h2>Use them with context</h2><p>Educational resources do not remove market risk. Start with the <a href="/en/free-content">free library</a>, read the <a href="/en/articles">articles</a>, and review the <a href="/en/risk-disclosure">risk disclosure</a> before trading.</p></section>`;
    case "contact":
      return isArabic
        ? `<section><h2>كيف يساعدك فريق XFlex؟</h2><p>يمكنك التواصل للاستفسار عن الباقات، التسجيل، الوصول إلى الحساب، الدعم أو المواعيد. أرسل تفاصيل السؤال العامة فقط، ولا ترسل كلمة المرور أو رموز التحقق أو بيانات البطاقة.</p><h2>قبل إرسال الطلب</h2><p>راجع <a href="/ar/faq">الأسئلة الشائعة</a> و<a href="/ar/refund-policy">سياسة الاشتراك والاسترجاع</a>، ثم استخدم القناة الرسمية المناسبة.</p></section>`
        : `<section><h2>How the XFlex team can help</h2><p>Contact us about packages, registration, account access, support, or appointments. Share only general question details; never send passwords, verification codes, or card information.</p><h2>Before contacting us</h2><p>Review the <a href="/en/faq">frequently asked questions</a> and <a href="/en/refund-policy">subscription and refund policy</a>, then use the appropriate official channel.</p></section>`;
    case "faq":
      return isArabic
        ? `<section><h2>أسئلة يطرحها المتعلمون</h2><ul><li><strong>هل الأرباح مضمونة؟</strong> لا؛ التداول ينطوي على مخاطر وقد تخسر رأس المال.</li><li><strong>هل المحتوى نصيحة مالية شخصية؟</strong> لا؛ هو تعليم عام لا يراعي وضع كل شخص.</li><li><strong>متى يبدأ الوصول؟</strong> يختلف حسب الباقة وشروط التسجيل الموضحة قبل الدفع.</li><li><strong>هل يمكن طلب استرجاع؟</strong> راجع السياسة المنشورة قبل الاشتراك.</li></ul><p>للتفاصيل، قارن <a href="/ar/packages/basic">الباقات</a> واقرأ <a href="/ar/risk-disclosure">إفصاح المخاطر</a> و<a href="/ar/refund-policy">سياسة الاسترجاع</a>.</p></section>`
        : `<section><h2>Questions learners often ask</h2><ul><li><strong>Are profits guaranteed?</strong> No. Trading carries risk and capital can be lost.</li><li><strong>Is this personalized financial advice?</strong> No. It is general education and does not assess every person's situation.</li><li><strong>When does access begin?</strong> It depends on the package and the registration terms shown before payment.</li><li><strong>Can I request a refund?</strong> Review the published policy before subscribing.</li></ul><p>For details, compare the <a href="/en/packages/basic">packages</a>, read the <a href="/en/risk-disclosure">risk disclosure</a>, and review the <a href="/en/refund-policy">refund policy</a>.</p></section>`;
    case "careers":
      return isArabic
        ? `<section><h2>العمل مع فريق XFlex</h2><p>تتطلب أدوار الأكاديمية وضوحاً ومسؤولية واهتماماً بجودة تجربة المتعلم. قد تشمل الفرص التعليم، الدعم، المحتوى، التقنية أو العمليات حسب الحاجة المنشورة.</p><h2>طريقة التقديم</h2><p>راجع الوظائف المتاحة وقدّم معلومات دقيقة عبر <a href="/ar/contact">القنوات الرسمية</a>. لا نطلب كلمات المرور أو رموز التحقق ضمن طلب التوظيف.</p></section>`
        : `<section><h2>Working with the XFlex team</h2><p>Academy roles value clarity, responsibility, and a strong learner experience. Opportunities may cover education, support, content, technology, or operations depending on the published need.</p><h2>How to apply</h2><p>Review available roles and provide accurate information through the <a href="/en/contact">official channels</a>. We do not request passwords or verification codes in an application.</p></section>`;
    case "terms":
    case "privacy":
    case "refund-policy":
      return isArabic
        ? `<section><h2>لماذا نطلب قراءة هذه الصفحة؟</h2><p>تشرح هذه الوثيقة القواعد التي تنظم استخدام المنصة والخدمات الرقمية، وما يتعلق بالبيانات أو الدفع أو الوصول بحسب نوع الصفحة. اقرأ النص الكامل قبل إنشاء الحساب أو الاشتراك.</p><p>يمكنك العودة إلى <a href="/ar/faq">الأسئلة الشائعة</a> أو <a href="/ar/contact">التواصل مع الفريق</a> إذا احتجت توضيحاً.</p></section>`
        : `<section><h2>Why this page matters</h2><p>This document explains the rules for using the platform and digital services, including data, payment, or access topics depending on the page. Read the full text before creating an account or subscribing.</p><p>Return to the <a href="/en/faq">FAQ</a> or <a href="/en/contact">contact the team</a> if you need clarification.</p></section>`;
    case "vip-bot-plan":
      return isArabic
        ? `<section><h2>نطاق الخطة التقنية</h2><p>تركز الخطة على جمع البيانات، اختبار الفرضيات، الضوابط التشغيلية، المراقبة وإدارة المخاطر قبل أي استخدام آلي. الأتمتة لا تجعل التداول آمناً ولا تضمن الربح.</p><h2>اقرأ قبل القرار</h2><p>راجع <a href="/ar/risk-disclosure">إفصاح المخاطر</a> و<a href="/ar/editorial-policy">السياسة التحريرية</a> لفهم حدود المعلومات المنشورة.</p></section>`
        : `<section><h2>Technical plan scope</h2><p>The plan focuses on data collection, hypothesis testing, operational safeguards, monitoring, and risk management before automation is used. Automation does not make trading safe or guarantee profit.</p><h2>Review before deciding</h2><p>Read the <a href="/en/risk-disclosure">risk disclosure</a> and <a href="/en/editorial-policy">editorial policy</a> to understand the limits of published information.</p></section>`;
    case "editorial-policy":
    case "risk-disclosure":
    case "author-editorial-team":
      return isArabic
        ? `<section><h2>الوضوح قبل الوعود</h2><p>نميز بين المعلومة التعليمية، الرأي التحليلي، والادعاء الذي يحتاج إلى مصدر أو مراجعة. نحدّث الصفحات عندما تتغير الحقائق ونوضح حدود المحتوى ومخاطر التداول.</p><p>ابدأ من <a href="/ar/articles">المقالات</a>، وتعرّف إلى <a href="/ar/authors/xflex-editorial-team">فريق التحرير</a>، واقرأ <a href="/ar/risk-disclosure">إفصاح المخاطر</a>.</p></section>`
        : `<section><h2>Clarity before promises</h2><p>We distinguish educational information, analytical opinion, and claims that need sourcing or review. Pages are updated when facts change, with clear limits on content and trading risk.</p><p>Start with the <a href="/en/articles">articles</a>, meet the <a href="/en/authors/xflex-editorial-team">editorial team</a>, and read the <a href="/en/risk-disclosure">risk disclosure</a>.</p></section>`;
    default:
      return "";
  }
}

function routeHtml(
  template: string,
  language: SeoLanguage,
  title: string,
  description: string,
  canonicalPath: string,
  heading: string,
  summary: string,
  schemas: Record<string, unknown>[],
  image = DEFAULT_SOCIAL_IMAGE,
  body = "",
  pageType: "website" | "article" = "website",
  availableLanguages: SeoLanguage[] = languages,
) {
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const localizedPathFor = (targetLanguage: SeoLanguage) =>
    canonicalPath.replace(/^\/(ar|en)(?=\/|$)/, `/${targetLanguage}`);
  const hreflangLinks = availableLanguages.map((targetLanguage) =>
    `<link rel="alternate" hreflang="${targetLanguage}" href="${escapeHtml(`${SITE_ORIGIN}${localizedPathFor(targetLanguage)}`)}" />`,
  ).join("\n    ");
  const defaultLanguage = availableLanguages.includes("ar") ? "ar" : availableLanguages[0] ?? language;
  let html = template.replace(
    /<html\b[^>]*>/i,
    `<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}" class="notranslate" translate="no">`,
  );
  html = setMeta(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = setMeta(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${pageType}" />`);
  html = setMeta(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = setMeta(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = setMeta(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
  html = setMeta(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  html = setMeta(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = setMeta(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = setMeta(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  html = setMeta(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  html = html.replace("</head>", `
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <meta property="og:locale" content="${language === "ar" ? "ar_AR" : "en_US"}" />
    ${hreflangLinks}
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${SITE_ORIGIN}${localizedPathFor(defaultLanguage)}`)}" />
    ${verificationMarkup()}
    ${schemas.map((schema) => `<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`).join("\n    ")}
    ${analyticsMarkup()}
    <style>
      .seo-prerender{max-width:72rem;margin:auto;padding:2rem;font-family:Arial,sans-serif;line-height:1.75;color:#0f172a}
      .seo-prerender nav,.seo-prerender footer{display:flex;flex-wrap:wrap;gap:1rem}
      .seo-prerender article{max-width:52rem;margin:4rem auto}.seo-prerender h1{font-size:2.4rem;line-height:1.2}
      .seo-prerender h2{margin-top:2rem}.seo-prerender li{margin:1.5rem 0}.seo-prerender a{color:#047857}
    </style>
  </head>`);
  return html.replace('<div id="root"></div>', `<div id="root">${prerenderShell(language, heading, summary, body)}</div>`);
}

async function writeRoute(routePath: string, html: string) {
  const relative = routePath.replace(/^\/+/, "");
  const directory = path.join(outputRoot, relative);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html, "utf8");
}

function articleSchema(article: PublicArticle, language: SeoLanguage) {
  const isArabic = language === "ar";
  const title = isArabic ? article.titleAr : article.titleEn;
  const description = isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
  const url = `${SITE_ORIGIN}/${language}/articles/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: absoluteUrl(article.socialImageUrl || article.thumbnailUrl),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    inLanguage: language,
    mainEntityOfPage: url,
    author: {
      "@type": "Organization",
      name: (isArabic ? article.authorNameAr : article.authorNameEn) || "XFlex Editorial Team",
      url: `${SITE_ORIGIN}/${language}/authors/xflex-editorial-team`,
    },
    reviewedBy: article.reviewerNameAr || article.reviewerNameEn
      ? { "@type": "Person", name: isArabic ? article.reviewerNameAr : article.reviewerNameEn }
      : undefined,
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

function sitemapUrl(
  loc: string,
  lastmod?: string,
  alternatePath?: string,
  availableLanguages: SeoLanguage[] = languages,
) {
  const alternateLinks = alternatePath === undefined
    ? ""
    : availableLanguages.map((language) =>
      `<xhtml:link rel="alternate" hreflang="${language}" href="${SITE_ORIGIN}/${language}${alternatePath}"/>`,
    ).join("");
  const defaultLanguage = availableLanguages.includes("ar") ? "ar" : availableLanguages[0];
  const defaultLink = alternatePath !== undefined && defaultLanguage
    ? `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/${defaultLanguage}${alternatePath}"/>`
    : "";
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ""}${alternatePath !== undefined
    ? `${alternateLinks}${defaultLink}`
    : ""}</url>`;
}

async function main() {
  const template = await fs.readFile(templatePath, "utf8");
  const articles = await fetchPublishedArticles();
  const generatedAt = new Date().toISOString();

  // Internal Pages Functions targets. Directory URLs avoid Cloudflare's
  // automatic `index.html` canonical redirects while keeping these files
  // unreachable through the public route allowlist.
  await fs.mkdir(path.join(outputRoot, "app-shell"), { recursive: true });
  await fs.writeFile(path.join(outputRoot, "app-shell", "index.html"), template, "utf8");

  for (const route of SEO_ROUTES) {
    for (const language of languages) {
      const copy = route[language];
      const canonicalPath = localizedPath(route.path, language);
      const body = route.key === "articles"
        ? articleCollectionBody(language, articles)
        : route.key === "home"
          ? homePrerenderBody(language)
          : route.key === "package-basic" || route.key === "package-comprehensive"
            ? packagePrerenderBody(language, route.key)
            : staticRoutePrerenderBody(language, route.key);
      const html = routeHtml(
        template,
        language,
        copy.title,
        copy.description,
        canonicalPath,
        copy.heading,
        copy.summary,
        buildPageStructuredData(route.key, language),
        route.image || DEFAULT_SOCIAL_IMAGE,
        body,
      );
      await writeRoute(canonicalPath, html);
    }
  }

  for (const article of articles) {
    const availableLanguages = getArticleAvailableLanguages(article);
    for (const language of availableLanguages) {
      const isArabic = language === "ar";
      const title = (isArabic ? article.seoTitleAr : article.seoTitleEn)
        || (isArabic ? article.titleAr : article.titleEn);
      const description = (isArabic ? article.seoDescriptionAr : article.seoDescriptionEn)
        || (isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr)
        || "";
      const content = (isArabic ? article.contentAr || article.contentEn : article.contentEn || article.contentAr) || "";
      const canonicalPath = `/${language}/articles/${article.slug}`;
      const articleBody = renderArticleContentHtml(content);
      const sources = article.sources
        ? `<section><h2>${isArabic ? "المصادر" : "Sources"}</h2><ul>${renderArticleSourcesHtml(article.sources)}</ul></section>`
        : "";
      const html = routeHtml(
        template,
        language,
        `${title} | XFlex`,
        description,
        canonicalPath,
        title,
        description,
        [articleSchema(article, language)],
        absoluteUrl(article.socialImageUrl || article.thumbnailUrl),
        `<div>${articleBody}</div>${sources}`,
        "article",
        availableLanguages,
      );
      await writeRoute(canonicalPath, html);
    }
  }

  const staticLastmod = generatedAt.slice(0, 10);
  for (const language of languages) {
    const urls = SEO_ROUTES.map((route) =>
      sitemapUrl(`${SITE_ORIGIN}${localizedPath(route.path, language)}`, route.updatedAt || staticLastmod, route.path),
    ).join("");
    await fs.writeFile(
      path.join(outputRoot, `sitemap-${language}.xml`),
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    );
  }

  const articleUrls = articles.flatMap((article) => {
    const availableLanguages = getArticleAvailableLanguages(article);
    return availableLanguages.map((language) =>
      sitemapUrl(
        `${SITE_ORIGIN}/${language}/articles/${article.slug}`,
        article.updatedAt || article.publishedAt,
        `/articles/${article.slug}`,
        availableLanguages,
      ),
    );
  }).join("");
  await fs.writeFile(
    path.join(outputRoot, "sitemap-articles.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${articleUrls}</urlset>`,
  );
  await fs.writeFile(
    path.join(outputRoot, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_ORIGIN}/sitemap-ar.xml</loc></sitemap><sitemap><loc>${SITE_ORIGIN}/sitemap-en.xml</loc></sitemap><sitemap><loc>${SITE_ORIGIN}/sitemap-articles.xml</loc></sitemap></sitemapindex>`,
  );

  const robots = `User-agent: *\nAllow: /ar/\nAllow: /en/\nDisallow: /admin\nDisallow: /auth\nDisallow: /login\nDisallow: /register\nDisallow: /signup\nDisallow: /checkout\nDisallow: /courses\nDisallow: /profile\nDisallow: /orders\nDisallow: /support\nDisallow: /community\nDisallow: /lexai\nDisallow: /recommendations\nDisallow: /api/\n\nUser-agent: OAI-SearchBot\nAllow: /ar/\nAllow: /en/\n\nUser-agent: ChatGPT-User\nAllow: /ar/\nAllow: /en/\n\nUser-agent: PerplexityBot\nAllow: /ar/\nAllow: /en/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  await fs.writeFile(path.join(outputRoot, "robots.txt"), robots);

  for (const language of languages) {
    const isArabic = language === "ar";
    const items = articles.filter((article) => isArticleAvailableInLanguage(article, language)).map((article) => {
      const title = isArabic ? article.titleAr : article.titleEn;
      const description = isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
      return `<item><title>${escapeXml(title)}</title><link>${SITE_ORIGIN}/${language}/articles/${escapeXml(article.slug)}</link><guid>${SITE_ORIGIN}/${language}/articles/${escapeXml(article.slug)}</guid><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate><description>${escapeXml(description)}</description></item>`;
    }).join("");
    const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME} ${isArabic ? "مقالات" : "Articles"}</title><link>${SITE_ORIGIN}/${language}/articles</link><description>${isArabic ? "مقالات تعليم التداول وإدارة المخاطر" : "Trading education and risk management articles"}</description><language>${language}</language>${items}</channel></rss>`;
    await fs.writeFile(path.join(outputRoot, `feed-${language}.xml`), feed);
  }
  await fs.copyFile(path.join(outputRoot, "feed-ar.xml"), path.join(outputRoot, "feed.xml"));

  await fs.writeFile(path.join(outputRoot, "llms.txt"), `# ${SITE_NAME}

> Arabic-first trading education platform offering structured courses, practical support, risk-management education, and analytical tools.

## Primary public resources
- Arabic home: ${SITE_ORIGIN}/ar
- English home: ${SITE_ORIGIN}/en
- Arabic articles: ${SITE_ORIGIN}/ar/articles
- English articles: ${SITE_ORIGIN}/en/articles
- Free education: ${SITE_ORIGIN}/ar/free-content
- Editorial policy: ${SITE_ORIGIN}/ar/editorial-policy
- Trading risk disclosure: ${SITE_ORIGIN}/ar/risk-disclosure
- Editorial team: ${SITE_ORIGIN}/ar/authors/xflex-editorial-team

## Important limits
- Trading is high risk and can result in loss of capital.
- XFlex content is educational and is not personalized financial advice.
- No course, signal, AI tool, or strategy can guarantee profit.
`);

  const notFound = routeHtml(
    template,
    "ar",
    "الصفحة غير موجودة | XFlex",
    "تعذر العثور على الصفحة المطلوبة.",
    "/404",
    "الصفحة غير موجودة",
    "تحقق من الرابط أو ارجع إلى الصفحة الرئيسية.",
    [],
  )
    .replace("index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1", "noindex,nofollow")
    .replace('<link rel="canonical" href="https://xflexacademy.com/404" />', "");
  await fs.mkdir(path.join(outputRoot, "404"), { recursive: true });
  await fs.writeFile(path.join(outputRoot, "404", "index.html"), notFound);
  await fs.writeFile(path.join(outputRoot, "404.html"), notFound);

  await fs.writeFile(path.join(outputRoot, "_redirects"), [
    "/ /ar 301",
    "/about /ar/about 301",
    "/events /ar/events 301",
    "/articles /ar/articles 301",
    "/free-content /ar/free-content 301",
    "/gifts /ar/gifts 301",
    "/contact /ar/contact 301",
    "/faq /ar/faq 301",
    "/careers /ar/careers 301",
    "/terms /ar/terms 301",
    "/privacy /ar/privacy 301",
    "/refund-policy /ar/refund-policy 301",
    "/packages/basic /ar/packages/basic 301",
    "/packages/comprehensive /ar/packages/comprehensive 301",
    "/business-owner/vip-trading-bot-plan /ar/project/vip-bot-plan 301",
  ].join("\n"));

  await fs.writeFile(path.join(outputRoot, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/admin/*
  X-Robots-Tag: noindex, nofollow

/auth
  X-Robots-Tag: noindex, nofollow

/checkout/*
  X-Robots-Tag: noindex, nofollow
`);

  await fs.writeFile(path.join(outputRoot, "seo-manifest.json"), JSON.stringify({
    generatedAt,
    staticPages: SEO_ROUTES.length * languages.length,
    articlePages: articles.reduce((total, article) => total + getArticleAvailableLanguages(article).length, 0),
    articleSlugs: articles.map((article) => article.slug),
  }, null, 2));

  const generatedArticlePageCount = articles.reduce(
    (total, article) => total + getArticleAvailableLanguages(article).length,
    0,
  );
  console.log(`[seo] Generated ${SEO_ROUTES.length * languages.length} public pages and ${generatedArticlePageCount} article pages.`);
}

await main();
