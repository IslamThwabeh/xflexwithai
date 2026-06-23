import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { CURATED_ARTICLES } from "../shared/curatedArticles";
import { SEO_ROUTES, localizedPath, type SeoLanguage } from "../shared/seo";

const outputRoot = path.resolve(process.cwd(), "dist/public");
const languages: SeoLanguage[] = ["ar", "en"];

async function readPublicPath(publicPath: string) {
  return fs.readFile(path.join(outputRoot, publicPath.replace(/^\/+/, ""), "index.html"), "utf8");
}

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

const titles = new Set<string>();
for (const route of SEO_ROUTES) {
  for (const language of languages) {
    const publicPath = localizedPath(route.path, language);
    const html = await readPublicPath(publicPath);
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1];
    assert(title, `${publicPath} must have a title`);
    assert(!titles.has(title), `${publicPath} title must be unique`);
    titles.add(title);
    assert.equal(countMatches(html, /<h1\b/gi), 1, `${publicPath} must contain exactly one prerendered h1`);
    assert(html.includes(`<html lang="${language}"`), `${publicPath} must declare its language`);
    assert(html.includes(`rel="canonical" href="https://xflexacademy.com${publicPath}"`), `${publicPath} canonical mismatch`);
    assert(html.includes('hreflang="ar"'), `${publicPath} missing Arabic hreflang`);
    assert(html.includes('hreflang="en"'), `${publicPath} missing English hreflang`);
    assert(html.includes('hreflang="x-default"'), `${publicPath} missing x-default hreflang`);
    assert(html.includes('application/ld+json'), `${publicPath} missing structured data`);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      JSON.parse(match[1]);
    }
  }
}

for (const article of CURATED_ARTICLES) {
  for (const language of languages) {
    const publicPath = `/${language}/articles/${article.slug}`;
    const html = await readPublicPath(publicPath);
    assert.equal(countMatches(html, /<h1\b/gi), 1, `${publicPath} must contain exactly one h1`);
    assert(html.includes('"@type":"Article"'), `${publicPath} must contain Article schema`);
    assert(html.includes(article.slug), `${publicPath} must reference its slug`);
  }
}

const sitemap = await fs.readFile(path.join(outputRoot, "sitemap.xml"), "utf8");
assert(sitemap.includes("sitemap-ar.xml") && sitemap.includes("sitemap-en.xml") && sitemap.includes("sitemap-articles.xml"));
const articleSitemap = await fs.readFile(path.join(outputRoot, "sitemap-articles.xml"), "utf8");
for (const article of CURATED_ARTICLES) assert(articleSitemap.includes(article.slug));

const robots = await fs.readFile(path.join(outputRoot, "robots.txt"), "utf8");
assert(robots.includes("Disallow: /admin"));
assert(robots.includes("OAI-SearchBot"));
assert(robots.includes("Sitemap: https://xflexacademy.com/sitemap.xml"));

const notFound = await fs.readFile(path.join(outputRoot, "404.html"), "utf8");
assert(notFound.includes("noindex,nofollow"));
assert.equal(countMatches(notFound, /<h1\b/gi), 1);

const llms = await fs.readFile(path.join(outputRoot, "llms.txt"), "utf8");
assert(llms.includes("Trading is high risk"));

console.log(`[seo:test] Validated ${SEO_ROUTES.length * languages.length} static pages and ${CURATED_ARTICLES.length * languages.length} curated article pages.`);
