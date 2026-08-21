import { useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import {
  IDLE_TIMEOUT_USER_MS,
  IDLE_TIMEOUT_STAFF_MS,
  IDLE_TIMEOUT_ADMIN_MS,
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_HEARTBEAT_RETRY_MS,
  SESSION_IDLE_WARNING_MS,
} from "../../../shared/const";
import { toast } from "sonner";

/**
 * Invisible component that sits near the top of the React tree.
 *
 * When the user is authenticated it monitors mouse / keyboard activity
 * and auto-logs them out after 30 min (students) or 15 min (staff/admins)
 * of inactivity.
 */
export default function SessionGuard() {
  const { isAuthenticated, logout, user } = useAuth();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isAdmin = Boolean(adminCheck?.isAdmin);
  const isStaff = Boolean(adminCheck?.isStaff);
  const interactionMutation = trpc.auth.interaction.useMutation();
  const lastHeartbeatAttemptAtRef = useRef(0);
  const lastHeartbeatSucceededAtRef = useRef(0);
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
    if (interactionMutation.isPending) return;
    if (now - lastHeartbeatAttemptAtRef.current < SESSION_HEARTBEAT_RETRY_MS) return;
    if (now - lastHeartbeatSucceededAtRef.current < SESSION_HEARTBEAT_INTERVAL_MS) return;

    lastHeartbeatAttemptAtRef.current = now;
    interactionMutation.mutate(undefined, {
      onSuccess: (result) => {
        lastHeartbeatSucceededAtRef.current = Date.now();
        if (isStaff && "idleExpiresAt" in result) {
          console.info("[STAFF SESSION] Heartbeat accepted", {
            lastInteractionAt: result.lastInteractionAt,
            idleExpiresAt: result.idleExpiresAt,
            idleTimeoutMinutes: IDLE_TIMEOUT_STAFF_MS / 60_000,
          });
        }
      },
      onError: (error) => {
        console.warn("[SESSION] Interaction heartbeat failed", {
          role: isAdmin ? "admin" : isStaff ? "staff" : "user",
          code: error.data?.code,
          message: error.message,
        });
        // Global auth handling redirects if the server has already expired the session.
      },
    });
  }, [interactionMutation, isAdmin, isStaff]);

  const handleWarning = useCallback(() => {
    toast.warning(
      isStaff
        ? "Staff sessions use a 15-minute inactivity limit. 2 minutes remain; clicking or typing keeps you signed in."
        : isAdmin
          ? "Admin sessions use a 15-minute inactivity limit. 2 minutes remain; clicking or typing keeps you signed in."
          : "Your session will expire in 2 minutes due to inactivity.",
    );
  }, [isAdmin, isStaff]);

  useIdleTimeout({
    timeoutMs,
    onIdle: handleIdle,
    warningMs: SESSION_IDLE_WARNING_MS,
    onWarning: handleWarning,
    onActivity: handleActivity,
    enabled: isAuthenticated,
    activityStorageKey: user?.id ? `xflex:session-activity:${user.id}` : undefined,
  });

  // This component renders nothing
  return null;
}
