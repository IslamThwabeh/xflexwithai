import { useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IDLE_TIMEOUT_USER_MS, IDLE_TIMEOUT_STAFF_MS, IDLE_TIMEOUT_ADMIN_MS } from "../../../shared/const";
import { toast } from "sonner";
import { useRef } from "react";

/**
 * Invisible component that sits near the top of the React tree.
 *
 * When the user is authenticated it monitors mouse / keyboard activity
 * and auto-logs them out after 30 min (students) or 15 min (staff/admins)
 * of inactivity.
 */
export default function SessionGuard() {
  const { isAuthenticated, logout } = useAuth();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isAdmin = Boolean(adminCheck?.isAdmin);
  const isStaff = Boolean(adminCheck?.isStaff);
  const interactionMutation = trpc.auth.interaction.useMutation();
  const lastHeartbeatAtRef = useRef(0);
  const timeoutMs = isAdmin
    ? IDLE_TIMEOUT_ADMIN_MS
    : isStaff
      ? IDLE_TIMEOUT_STAFF_MS
      : IDLE_TIMEOUT_USER_MS;

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

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastHeartbeatAtRef.current < 60_000 || interactionMutation.isPending) return;
    lastHeartbeatAtRef.current = now;
    interactionMutation.mutate(undefined, {
      onError: () => {
        // Global auth handling redirects if the server has already expired the session.
      },
    });
  }, [interactionMutation]);

  const handleWarning = useCallback(() => {
    toast.warning(
      isAdmin
        ? "Your admin session will expire in 2 minutes due to inactivity."
        : "Your session will expire in 2 minutes due to inactivity.",
    );
  }, [isAdmin]);

  useIdleTimeout({
    timeoutMs,
    onIdle: handleIdle,
    warningMs: 2 * 60 * 1000,
    onWarning: handleWarning,
    onActivity: handleActivity,
    enabled: isAuthenticated,
  });

  // This component renders nothing
  return null;
}
