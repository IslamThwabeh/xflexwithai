import fs from "node:fs/promises";
import path from "node:path";
import { INDEXNOW_KEY, SITE_ORIGIN } from "../shared/seo";

const outputRoot = path.resolve(process.cwd(), "dist/public");
const sitemapFiles = ["sitemap-ar.xml", "sitemap-en.xml", "sitemap-articles.xml"];

async function sitemapUrls() {
  const urls = new Set<string>();
  for (const filename of sitemapFiles) {
    const xml = await fs.readFile(path.join(outputRoot, filename), "utf8");
    for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
      const url = match[1]?.trim();
      if (url?.startsWith(`${SITE_ORIGIN}/`)) urls.add(url);
    }
  }
  return [...urls];
}

const urlList = await sitemapUrls();
if (urlList.length === 0) throw new Error("No public URLs found in the generated sitemaps.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE_ORIGIN).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList,
  }),
});

if (!response.ok && response.status !== 202) {
  throw new Error(`IndexNow submission failed with HTTP ${response.status}: ${await response.text()}`);
}

console.log(`[seo:indexnow] Submitted ${urlList.length} public URLs (HTTP ${response.status}).`);
