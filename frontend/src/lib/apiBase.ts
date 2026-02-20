export const resolveApiBaseUrl = () => {
  const rawUrl = import.meta.env.VITE_API_URL?.trim();

  if (!rawUrl) {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "xflexwithai.com" || host.endsWith(".xflexwithai.com")) {
        return "https://api.xflexwithai.com";
      }
    }
    return "";
  }

  const trimmed = rawUrl.replace(/\/$/, "");

  if (trimmed.endsWith("/api/trpc")) return trimmed.slice(0, -"/api/trpc".length);
  if (trimmed.endsWith("/trpc")) return trimmed.slice(0, -"/trpc".length);

  return trimmed;
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
