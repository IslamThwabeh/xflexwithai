import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build, stop } from "esbuild";
import { chromium } from "playwright";

// Isolated synthetic fixture: never opens the application or authenticates.
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const label = process.argv[2] || "current";
assert.match(label, /^[a-z0-9-]+$/);
const output = path.join(projectRoot, "output/playwright/content-security", label);
fs.mkdirSync(output, { recursive: true });
const bundlePath = path.join(output, "fixture.js");
let server;
let browser;
try {
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ["scripts/fixtures/content-security-entry.tsx"],
    outfile: bundlePath, bundle: true, platform: "browser", format: "iife",
    jsx: "automatic", target: "es2022", logLevel: "silent",
    loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const bundle = fs.readFileSync(bundlePath);
  const css = fs.readFileSync(path.join(output, "fixture.css"));
  server = createServer((req, res) => {
    if (req.url === "/fixture.js") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      return res.end(bundle);
    }
    if (req.url === "/fixture.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      return res.end(css);
    }
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end('<!doctype html><meta charset="utf-8"><title>Synthetic content check</title><link rel="stylesheet" href="/fixture.css"><style>body{font:16px Arial;margin:24px}section{margin-bottom:28px}svg{max-width:100%}</style><div id="root"></div><script>window.fixtureProbe=0</script><script src="/fixture.js"></script>');
    }
    res.writeHead(404);
    res.end("Synthetic fixture not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string" && address.address === "127.0.0.1");
  const origin = `http://127.0.0.1:${address.port}`;
  const hasChromium = fs.existsSync(chromium.executablePath());
  browser = await chromium.launch({ headless: true, ...(hasChromium ? {} : { channel: "msedge" }) });
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1100, height: 900 } });
  const blockedRequests = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    blockedRequests.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll("#diagrams svg[aria-roledescription]").length >= 3 && document.querySelector("#prose").textContent.includes("const score = 85;"), null, { timeout: 30_000 });
  fs.writeFileSync(path.join(output, "fixture.html"), await page.content());
  const observed = await page.evaluate(() => ({
    proseText: document.querySelector("#prose").textContent,
    heading: document.querySelector("#prose h2")?.textContent,
    strongCount: document.querySelectorAll('#prose strong, #prose b, #prose [data-streamdown="strong"]').length,
    listCount: document.querySelectorAll("#prose li").length,
    tableRows: document.querySelectorAll("#prose tr").length,
    code: document.querySelector('#prose pre, #prose [data-streamdown="code-block"]')?.textContent,
    link: document.querySelector("#prose a")?.getAttribute("href"),
    diagramCount: document.querySelectorAll("#diagrams svg[aria-roledescription]").length,
    diagramText: document.querySelector("#diagrams").textContent,
    markdownUnsafeElements: document.querySelectorAll('#markdown-safety script, #markdown-safety [onerror], #markdown-safety a[href^="javascript:"]').length,
    jobsText: document.querySelector("#jobs").textContent,
    jobsStrongCount: document.querySelectorAll("#jobs strong").length,
    jobsBreaks: document.querySelectorAll("#jobs br").length,
    jobsUnsafeElements: document.querySelectorAll("#jobs-safety img, #jobs-safety script, #jobs-safety svg").length,
    jobsEscapedText: document.querySelector("#jobs-safety").textContent,
    probe: window.fixtureProbe,
  }));
  const checks = [
    { name: "Bilingual headings", passed: observed.heading === "ملخص / Summary" },
    { name: "Bold emphasis", passed: observed.strongCount === 2 },
    { name: "Lists and tables", passed: observed.listCount === 2 && observed.tableRows === 2 },
    { name: "Code blocks", passed: observed.code?.includes("const score = 85;") === true },
    { name: "HTTPS links", passed: observed.link === "https://example.invalid/docs" },
    { name: "Flow, sequence and state diagrams", passed: observed.diagramCount >= 3 && observed.diagramText.includes("البداية") && observed.diagramText.includes("Approved") },
    { name: "Markdown rejects active markup and script links", passed: observed.markdownUnsafeElements === 0 },
    { name: "Screening formatting", passed: observed.jobsText.includes("التقييم / Screening") && observed.jobsText.includes("USD 123.45") && observed.jobsStrongCount >= 2 && observed.jobsBreaks === 4 },
    { name: "Screening markup is escaped text", passed: observed.jobsUnsafeElements === 0 && observed.jobsEscapedText.includes("<img") },
    { name: "No synthetic script execution", passed: observed.probe === 0 },
    { name: "No browser runtime errors", passed: pageErrors.length === 0 },
  ];
  await page.screenshot({ path: path.join(output, "fixture.png"), fullPage: true });
  const result = { checkedAtUtc: new Date().toISOString(), browser: await browser.version(), host: address.address, checks, observed, pageErrors, blockedRequests, productionRequests: 0 };
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).map(c => c.name), result: path.relative(projectRoot, path.join(output, "results.json")) }));
  if (checks.some(c => !c.passed)) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  stop();
}
