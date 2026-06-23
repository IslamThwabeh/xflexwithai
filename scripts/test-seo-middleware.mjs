import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";

function contextFor(url, assetHandler) {
  return {
    request: new Request(url),
    env: { ASSETS: { fetch: assetHandler } },
    next: () => new Response("next", { status: 200 }),
  };
}

const legacy = await onRequest(contextFor("https://xflexacademy.com/about", async () => new Response("unused")));
assert.equal(legacy.status, 301);
assert.equal(legacy.headers.get("location"), "https://xflexacademy.com/ar/about");

const www = await onRequest(contextFor("https://www.xflexacademy.com/en/articles", async () => new Response("unused")));
assert.equal(www.status, 301);
assert.equal(www.headers.get("location"), "https://xflexacademy.com/en/articles");

const privateRoute = await onRequest(contextFor("https://xflexacademy.com/admin/dashboard", async () =>
  new Response("<html>app</html>", { status: 200, headers: { "content-type": "text/html" } }),
));
assert.equal(privateRoute.status, 200);
assert.equal(privateRoute.headers.get("x-robots-tag"), "noindex, nofollow");
assert.equal(privateRoute.headers.get("cache-control"), "private, no-store");

const localized = await onRequest(contextFor("https://xflexacademy.com/ar/about", async (request) => {
  assert.equal(new URL(request.url).pathname, "/ar/about/index.html");
  return new Response("<html>about</html>", { status: 200 });
}));
assert.equal(localized.status, 200);

const missing = await onRequest(contextFor("https://xflexacademy.com/ar/not-real", async (request) => {
  const pathname = new URL(request.url).pathname;
  return pathname === "/404.html"
    ? new Response("<html>missing</html>", { status: 200, headers: { "content-type": "text/html" } })
    : new Response("missing", { status: 404 });
}));
assert.equal(missing.status, 404);
assert.equal(missing.headers.get("x-robots-tag"), "noindex, nofollow");

console.log("[seo:middleware] Validated canonical redirects, private noindex responses, prerender routing, and true 404 responses.");
