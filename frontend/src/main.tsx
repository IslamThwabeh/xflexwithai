import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { ADMIN_LOGIN_URL, getLoginUrl } from "./const";
import { resolveTrpcUrl } from "./lib/apiBase";
import "./index.css";

const normalizeCurrentPathname = () => {
  if (typeof window === "undefined") return;

  const { pathname, search, hash } = window.location;
  const normalizedPathname = pathname.replace(/\/{2,}/g, "/");

  if (normalizedPathname === pathname) return;

  window.history.replaceState(window.history.state, "", `${normalizedPathname}${search}${hash}`);
};

normalizeCurrentPathname();

const localeFromPath = window.location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1];
if (localeFromPath === "ar" || localeFromPath === "en") {
  window.localStorage.setItem("language", localeFromPath);
}

const queryClient = new QueryClient();

const buildUnauthorizedRedirectUrl = () => {
  if (typeof window === "undefined") return null;

  const { pathname, search } = window.location;
  if (pathname.startsWith("/admin")) {
    return pathname === ADMIN_LOGIN_URL ? null : ADMIN_LOGIN_URL;
  }

  const loginUrl = getLoginUrl();
  if (pathname === loginUrl) return null;

  const next = `${pathname}${search}`;
  return `${loginUrl}?next=${encodeURIComponent(next)}`;
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  const redirectUrl = buildUnauthorizedRedirectUrl();
  if (!redirectUrl) return;

  window.location.href = redirectUrl;
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: resolveTrpcUrl(),
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

const rootElement = document.getElementById("root")!;
// SEO prerendered HTML is intentionally static and is replaced by the interactive app.
rootElement.replaceChildren();

createRoot(rootElement).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
