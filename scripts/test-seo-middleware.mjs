import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";

function contextFor(url, assetHandler, env = {}) {
  return {
    request: new Request(url),
    env: { ASSETS: { fetch: assetHandler }, ...env },
    next: () => new Response("next", { status: 200 }),
  };
}

const legacy = await onRequest(contextFor("https://xflexacademy.com/about", async () => new Response("unused")));
assert.equal(legacy.status, 301);
assert.equal(legacy.headers.get("location"), "https://xflexacademy.com/ar/about");

const www = await onRequest(contextFor("https://www.xflexacademy.com/en/articles", async () => new Response("unused")));
assert.equal(www.status, 301);
assert.equal(www.headers.get("location"), "https://xflexacademy.com/en/articles");

const privateRoute = await onRequest(contextFor("https://xflexacademy.com/admin/dashboard", async (request) => {
  assert.equal(new URL(request.url).pathname, "/app-shell/");
  return new Response("<html>app</html>", { status: 200, headers: { "content-type": "text/html" } });
}));
assert.equal(privateRoute.status, 200);
assert.equal(privateRoute.headers.get("x-robots-tag"), "noindex, nofollow");
assert.equal(privateRoute.headers.get("cache-control"), "private, no-store");

const communityRoute = await onRequest(contextFor("https://xflexacademy.com/community?postId=42", async (request) => {
  assert.equal(new URL(request.url).pathname, "/app-shell/");
  return new Response("<html>community app</html>", { status: 200, headers: { "content-type": "text/html" } });
}));
assert.equal(communityRoute.status, 200);
assert.equal(communityRoute.headers.get("x-robots-tag"), "noindex, nofollow");
assert.equal(communityRoute.headers.get("cache-control"), "private, no-store");

for (const pathname of ["/surveys", "/job-opportunities"]) {
  const studentFeatureRoute = await onRequest(contextFor(`https://xflexacademy.com${pathname}`, async (request) => {
    assert.equal(new URL(request.url).pathname, "/app-shell/");
    return new Response("<html>student feature app</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }));
  assert.equal(studentFeatureRoute.status, 200);
  assert.equal(studentFeatureRoute.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(studentFeatureRoute.headers.get("cache-control"), "private, no-store");
}

const localizedAuth = await onRequest(contextFor("https://xflexacademy.com/ar/auth", async (request) => {
  assert.equal(new URL(request.url).pathname, "/app-shell/");
  return new Response("<html>auth app</html>", { status: 200, headers: { "content-type": "text/html" } });
}));
assert.equal(localizedAuth.status, 200);
assert.equal(localizedAuth.headers.get("x-robots-tag"), "noindex, nofollow");

const localized = await onRequest(contextFor("https://xflexacademy.com/ar/about", async (request) => {
  assert.equal(new URL(request.url).pathname, "/ar/about/");
  return new Response("<html>about</html>", { status: 200 });
}));
assert.equal(localized.status, 200);

const localizedRoot = await onRequest(contextFor("https://xflexacademy.com/ar/", async (request) => {
  assert.equal(new URL(request.url).pathname, "/ar/");
  return new Response("<html>arabic home</html>", { status: 200 });
}));
assert.equal(localizedRoot.status, 200);
assert.equal(localizedRoot.headers.get("location"), null);

const disabledLivePackage = await onRequest(contextFor("https://xflexacademy.com/ar/packages/live-package", async (request) => {
  assert.equal(new URL(request.url).pathname, "/404/");
  return new Response("<html>missing</html>", { status: 200 });
}));
assert.equal(disabledLivePackage.status, 404);
assert.equal(disabledLivePackage.headers.get("x-robots-tag"), "noindex, nofollow");

const enabledLivePackage = await onRequest(contextFor("https://xflexacademy.com/en/packages/live-package", async (request) => {
  assert.equal(new URL(request.url).pathname, "/app-shell/");
  return new Response("<html>live preview</html>", { status: 200 });
}, { PACKAGE_LIVE_DEPLOYMENT_ENABLED: "true" }));
assert.equal(enabledLivePackage.status, 200);
assert.equal(enabledLivePackage.headers.get("x-robots-tag"), "noindex, nofollow");

const missing = await onRequest(contextFor("https://xflexacademy.com/ar/not-real", async (request) => {
  const pathname = new URL(request.url).pathname;
  return pathname === "/404/"
    ? new Response("<html>missing</html>", { status: 200, headers: { "content-type": "text/html" } })
    : new Response("missing", { status: 404 });
}));
assert.equal(missing.status, 404);
assert.equal(missing.headers.get("x-robots-tag"), "noindex, nofollow");

console.log("[seo:middleware] Validated canonical redirects, private noindex responses, prerender routing, and true 404 responses.");
