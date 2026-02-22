import { LOGIN_URL } from "@/const";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_URL } =
    options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const lastIdentityRef = useRef<string | null>(null);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // Prevent cross-account data leakage via cached queries (e.g., LexAI messages)
  // when switching between accounts without a full page reload (OTP flow).
  useEffect(() => {
    // Use `null` for unauthenticated so we can distinguish initial load/login/logout
    // from true cross-account switching.
    const identity = state.user
      ? `${state.user.id}:${state.user.email ?? ""}`
      : null;

    const prevIdentity = lastIdentityRef.current;
    lastIdentityRef.current = identity;

    // Only clear caches when switching BETWEEN two authenticated identities.
    // Do not clear on initial load (null -> user) or during logout/expiry (user -> null),
    // as that can cause a refetch loop and make pages appear to constantly reload.
    if (!prevIdentity || !identity) return;
    if (prevIdentity === identity) return;

    // Clear query + mutation caches so UI refetches for the new identity.
    // This is intentionally broad to avoid missing any user-scoped caches.
    queryClient.clear();

    // Ensure auth state is revalidated.
    utils.auth.me.invalidate().catch(() => {});
  }, [queryClient, state.user, utils.auth.me]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
