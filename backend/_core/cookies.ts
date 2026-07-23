import type { CookieOptions } from "express";
import { COOKIE_MAX_AGE_USER, COOKIE_MAX_AGE_ADMIN } from "../../shared/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

type CookieRequest = {
  headers: Headers | Record<string, string | string[] | undefined>;
  protocol?: string;
  url?: string;
  hostname?: string;
};

type SessionCookieOptions = Pick<
  CookieOptions,
  "domain" | "httpOnly" | "maxAge" | "path" | "sameSite" | "secure"
>;

function getHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(value)) return value.join(",");
  return value;
}

function isSecureRequest(req: CookieRequest) {
  if (req.protocol === "https") return true;

  if (req.url) {
    try {
      // Worker requests contain an absolute URL, while Express uses a relative
      // path such as /api/trpc/auth.adminLogin.
      const url = new URL(req.url, "http://localhost");
      if (url.protocol === "https:") return true;
    } catch {
      // Fall through to the forwarded-proto check for malformed request URLs.
    }
  }

  const forwardedProto = getHeader(req.headers, "x-forwarded-proto");
  if (!forwardedProto) return false;

  const protoList = forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function getOriginHost(req: CookieRequest) {
  const origin = getHeader(req.headers, "origin");
  if (!origin) return undefined;

  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isCrossSiteCookieRequest(input: {
  originHost?: string;
  hostname?: string;
  domain?: string;
}) {
  const { originHost, hostname, domain } = input;
  if (!originHost) return false;

  if (domain) {
    return originHost !== domain && !originHost.endsWith(`.${domain}`);
  }

  if (hostname) {
    return originHost !== hostname;
  }

  return false;
}

export function getSessionCookieOptions(
  req: CookieRequest,
  role: "admin" | "user" = "user"
): SessionCookieOptions {
  const secure = isSecureRequest(req);

  // Derive the hostname from the request (Worker uses req.url, Express uses req.hostname).
  let hostname: string | undefined;
  if (req.hostname) {
    hostname = req.hostname;
  } else if (req.url) {
    try {
      hostname = new URL(req.url).hostname;
    } catch {
      // malformed URL – leave undefined
    }
  }

  // For production domains, set the cookie on the apex so it's shared across subdomains
  // (e.g., xflexacademy.com ↔ api.xflexacademy.com).
  let domain: string | undefined;
  if (hostname) {
    if (
      hostname === "xflexacademy.com" ||
      hostname.endsWith(".xflexacademy.com")
    ) {
      domain = "xflexacademy.com";
    } else if (
      hostname === "xflexwithai.com" ||
      hostname.endsWith(".xflexwithai.com")
    ) {
      domain = "xflexwithai.com";
    }
    // For localhost / 127.0.0.1 / IPs, leave domain undefined (browser default).
  }

  const maxAge = role === "admin" ? COOKIE_MAX_AGE_ADMIN : COOKIE_MAX_AGE_USER;
  const originHost = getOriginHost(req);
  const sameSite: CookieOptions["sameSite"] =
    secure && isCrossSiteCookieRequest({ originHost, hostname, domain }) ? "none" : "lax";

  return {
    domain,
    httpOnly: true,
    maxAge,
    path: "/",
    // Hosted previews use a cross-site frontend origin, so they need SameSite=None for API auth.
    sameSite,
    secure,
  };
}

/**
 * The shared cookie options use seconds because Cloudflare's cookie serializer
 * expects Max-Age in seconds. Express instead expects maxAge in milliseconds.
 */
export function toExpressCookieOptions(
  options: SessionCookieOptions,
): SessionCookieOptions {
  return {
    ...options,
    maxAge: typeof options.maxAge === "number"
      ? options.maxAge * 1000
      : options.maxAge,
  };
}
