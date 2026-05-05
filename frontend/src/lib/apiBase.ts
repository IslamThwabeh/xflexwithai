const REMOTE_API_BASE_URL = "https://api.xflexacademy.com";

const isHostedFrontendHost = (host: string) => {
  const normalizedHost = host.toLowerCase();

  return (
    normalizedHost === "xflexacademy.com" ||
    normalizedHost.endsWith(".xflexacademy.com") ||
    normalizedHost === "xflexwithai.com" ||
    normalizedHost.endsWith(".xflexwithai.com") ||
    normalizedHost.endsWith(".xflexwithai.pages.dev") ||
    normalizedHost.endsWith(".xflexacademy.pages.dev")
  );
};

export const resolveApiBaseUrl = () => {
  const rawUrl = import.meta.env.VITE_API_URL?.trim();

  if (!rawUrl) {
    if (typeof window !== "undefined") {
      if (isHostedFrontendHost(window.location.hostname)) {
        return REMOTE_API_BASE_URL;
      }
    }
    return "";
  }

  const trimmed = rawUrl.replace(/\/$/, "");

  if (trimmed.endsWith("/api/trpc")) return trimmed.slice(0, -"/api/trpc".length);
  if (trimmed.endsWith("/trpc")) return trimmed.slice(0, -"/trpc".length);

  return trimmed;
};

export const resolveTrpcUrl = () => {
  const base = resolveApiBaseUrl();
  return base ? `${base}/api/trpc` : "/api/trpc";
};

export const withApiBase = (path: string) => {
  const base = resolveApiBaseUrl();
  if (!base) return path;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
};

export const apiFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? withApiBase(input) : input;
  return fetch(url, {
    ...(init ?? {}),
    credentials: "include",
  });
};
