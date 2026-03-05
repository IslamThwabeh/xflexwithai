import { useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IDLE_TIMEOUT_USER_MS, IDLE_TIMEOUT_ADMIN_MS } from "../../../shared/const";

/**
 * Invisible component that sits near the top of the React tree.
 *
 * When the user is authenticated it monitors mouse / keyboard activity
 * and auto-logs them out after 30 min (users) or 15 min (admins) of
 * inactivity.
 */
export default function SessionGuard() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isAdmin = Boolean(adminCheck?.isAdmin);
  const timeoutMs = isAdmin ? IDLE_TIMEOUT_ADMIN_MS : IDLE_TIMEOUT_USER_MS;

  const handleIdle = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Swallow — the cookie may already be expired server-side
    }
    // Navigate to the appropriate auth page with a reason query param
    const dest = isAdmin ? "/admin?reason=idle" : "/auth?reason=idle";
    window.location.href = dest;
  }, [logout, isAdmin]);

  useIdleTimeout({
    timeoutMs,
    onIdle: handleIdle,
    enabled: isAuthenticated,
  });

  // This component renders nothing
  return null;
}
