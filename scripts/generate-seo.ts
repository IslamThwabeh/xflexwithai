import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SOCIAL_IMAGE,
  SEO_ROUTES,
  SITE_NAME,
  SITE_ORIGIN,
  buildPageStructuredData,
  localizedPath,
  type SeoLanguage,
} from "../shared/seo";
import { CURATED_ARTICLES } from "../shared/curatedArticles";

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
  const measurementId = process.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return "";
  return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(measurementId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${escapeHtml(measurementId)}', { anonymize_ip: true });
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
  return `<section aria-labelledby="published-articles">
    <h2 id="published-articles">${isArabic ? "المقالات المنشورة" : "Published articles"}</h2>
    <ul>${articles.map((article) => {
      const title = isArabic ? article.titleAr : article.titleEn;
      const excerpt = isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
      return `<li><a href="/${language}/articles/${escapeHtml(article.slug)}">${escapeHtml(title)}</a><p>${escapeHtml(excerpt)}</p></li>`;
    }).join("")}</ul>
  </section>`;
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
) {
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const alternateLanguage = language === "ar" ? "en" : "ar";
  const alternatePath = canonicalPath.replace(/^\/(ar|en)(?=\/|$)/, `/${alternateLanguage}`);
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
    <link rel="alternate" hreflang="${language}" href="${escapeHtml(canonical)}" />
    <link rel="alternate" hreflang="${alternateLanguage}" href="${escapeHtml(`${SITE_ORIGIN}${alternatePath}`)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${SITE_ORIGIN}${canonicalPath.replace(/^\/(ar|en)/, "/ar")}`)}" />
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

function sitemapUrl(loc: string, lastmod?: string, alternatePath?: string) {
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ""}${alternatePath
    ? `<xhtml:link rel="alternate" hreflang="ar" href="${SITE_ORIGIN}/ar${alternatePath}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en${alternatePath}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/ar${alternatePath}"/>`
    : ""}</url>`;
}

async function main() {
  const template = await fs.readFile(templatePath, "utf8");
  const articles = await fetchPublishedArticles();
  const generatedAt = new Date().toISOString();

  for (const route of SEO_ROUTES) {
    for (const language of languages) {
      const copy = route[language];
      const canonicalPath = localizedPath(route.path, language);
      const body = route.key === "articles" ? articleCollectionBody(language, articles) : "";
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
    for (const language of languages) {
      const isArabic = language === "ar";
      const title = (isArabic ? article.seoTitleAr : article.seoTitleEn)
        || (isArabic ? article.titleAr : article.titleEn);
      const description = (isArabic ? article.seoDescriptionAr : article.seoDescriptionEn)
        || (isArabic ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr)
        || "";
      const content = (isArabic ? article.contentAr || article.contentEn : article.contentEn || article.contentAr) || "";
      const canonicalPath = `/${language}/articles/${article.slug}`;
      const paragraphs = content.split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      const sources = article.sources
        ? `<section><h2>${isArabic ? "المصادر" : "Sources"}</h2><p>${escapeHtml(article.sources)}</p></section>`
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
        `<div>${paragraphs}</div>${sources}`,
        "article",
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

  const articleUrls = articles.flatMap((article) => languages.map((language) =>
    sitemapUrl(`${SITE_ORIGIN}/${language}/articles/${article.slug}`, article.updatedAt || article.publishedAt, `/articles/${article.slug}`),
  )).join("");
  await fs.writeFile(
    path.join(outputRoot, "sitemap-articles.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${articleUrls}</urlset>`,
  );
  await fs.writeFile(
    path.join(outputRoot, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_ORIGIN}/sitemap-ar.xml</loc></sitemap><sitemap><loc>${SITE_ORIGIN}/sitemap-en.xml</loc></sitemap><sitemap><loc>${SITE_ORIGIN}/sitemap-articles.xml</loc></sitemap></sitemapindex>`,
  );

  const robots = `User-agent: *\nAllow: /ar/\nAllow: /en/\nDisallow: /admin\nDisallow: /auth\nDisallow: /login\nDisallow: /register\nDisallow: /signup\nDisallow: /checkout\nDisallow: /courses\nDisallow: /profile\nDisallow: /orders\nDisallow: /support\nDisallow: /lexai\nDisallow: /recommendations\nDisallow: /api/\n\nUser-agent: OAI-SearchBot\nAllow: /ar/\nAllow: /en/\n\nUser-agent: ChatGPT-User\nAllow: /ar/\nAllow: /en/\n\nUser-agent: PerplexityBot\nAllow: /ar/\nAllow: /en/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  await fs.writeFile(path.join(outputRoot, "robots.txt"), robots);

  for (const language of languages) {
    const isArabic = language === "ar";
    const items = articles.map((article) => {
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
    articlePages: articles.length * languages.length,
    articleSlugs: articles.map((article) => article.slug),
  }, null, 2));

  console.log(`[seo] Generated ${SEO_ROUTES.length * languages.length} public pages and ${articles.length * languages.length} article pages.`);
}

await main();
