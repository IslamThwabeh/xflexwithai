import type { CookieOptions } from "express";

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
    const url = new URL(req.url);
    if (url.protocol === "https:") return true;
  }

  const forwardedProto = getHeader(req.headers, "x-forwarded-proto");
  if (!forwardedProto) return false;

  const protoList = forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: CookieRequest
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
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
      domain = ".xflexacademy.com";
    } else if (
      hostname === "xflexwithai.com" ||
      hostname.endsWith(".xflexwithai.com")
    ) {
      domain = ".xflexwithai.com";
    }
    // For localhost / 127.0.0.1 / IPs, leave domain undefined (browser default).
  }

  return {
    domain,
    httpOnly: true,
    path: "/",
    // "lax" is fine for same-site (eTLD+1) subdomains; use "none" only for true cross-site.
    sameSite: "lax",
    secure,
  };
}
