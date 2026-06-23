const LEGACY_PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/events",
  "/articles",
  "/free-content",
  "/gifts",
  "/contact",
  "/faq",
  "/careers",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/editorial-policy",
  "/risk-disclosure",
  "/authors/xflex-editorial-team",
  "/packages/basic",
  "/packages/comprehensive",
]);

const PRIVATE_PREFIXES = [
  "/admin",
  "/auth",
  "/login",
  "/register",
  "/signup",
  "/unsubscribe",
  "/dashboard",
  "/courses",
  "/documents",
  "/profile",
  "/activate-key",
  "/course/",
  "/lexai",
  "/recommendations",
  "/support",
  "/quiz",
  "/checkout/",
  "/orders",
  "/subscriptions",
  "/my-packages",
  "/brokers",
  "/broker-onboarding",
  "/upgrade",
  "/notifications",
  "/my-points",
  "/calculators",
];

const LOCALIZED_PRIVATE_PATH = /^\/(ar|en)\/(?:auth|login|register|signup)(?:\/|$)/;

function withNoIndex(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function redirectTo(url, pathname) {
  const target = new URL(url);
  target.protocol = "https:";
  target.hostname = "xflexacademy.com";
  target.port = "";
  target.pathname = pathname;
  return Response.redirect(target.toString(), 301);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (url.hostname === "www.xflexacademy.com" || forwardedProtocol === "http") {
    return redirectTo(url, url.pathname);
  }

  if (url.pathname.startsWith("/api") || url.pathname.includes(".")) {
    return context.next();
  }

  if (LEGACY_PUBLIC_PATHS.has(url.pathname)) {
    const destination = url.pathname === "/" ? "/ar" : `/ar${url.pathname}`;
    return redirectTo(url, destination);
  }

  if (url.pathname.startsWith("/articles/")) {
    return redirectTo(url, `/ar${url.pathname}`);
  }

  if (url.pathname === "/business-owner/vip-trading-bot-plan" || url.pathname === "/vip-trading-bot-plan") {
    return redirectTo(url, "/ar/project/vip-bot-plan");
  }

  if (
    LOCALIZED_PRIVATE_PATH.test(url.pathname)
    || PRIVATE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix))
  ) {
    const shellRequest = new Request(`${url.origin}/app-shell/`, request);
    return withNoIndex(await context.env.ASSETS.fetch(shellRequest));
  }

  if (/^\/(ar|en)(?:\/|$)/.test(url.pathname)) {
    const cleanPath = url.pathname.replace(/\/+$/, "");
    // Ask Pages Assets for the canonical directory URL. Requesting index.html
    // causes Pages to redirect back to the directory URL, which creates a loop
    // when this middleware receives the redirected request again.
    const assetRequest = new Request(`${url.origin}${cleanPath}/`, request);
    const response = await context.env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return response;

    const notFound = await context.env.ASSETS.fetch(new Request(`${url.origin}/404/`, request));
    return new Response(notFound.body, {
      status: 404,
      headers: { ...Object.fromEntries(notFound.headers), "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const notFound = await context.env.ASSETS.fetch(new Request(`${url.origin}/404/`, request));
  return new Response(notFound.body, {
    status: 404,
    headers: { ...Object.fromEntries(notFound.headers), "X-Robots-Tag": "noindex, nofollow" },
  });
}
