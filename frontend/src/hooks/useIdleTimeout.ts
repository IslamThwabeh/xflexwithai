import { useEffect, useRef, useCallback } from "react";

/**
 * Tracks user activity (mouse, keyboard, touch, scroll) and calls `onIdle`
 * after `timeoutMs` milliseconds of inactivity. Automatically resets the
 * timer on any activity event.
 *
 * Only active when `enabled` is true (i.e. user is authenticated).
 */
export function useIdleTimeout({
  timeoutMs,
  onIdle,
  warningMs = 0,
  onWarning,
  onActivity,
  enabled = true,
}: {
  timeoutMs: number;
  onIdle: () => void;
  warningMs?: number;
  onWarning?: () => void;
  onActivity?: () => void;
  enabled?: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onActivityRef = useRef(onActivity);
  onIdleRef.current = onIdle;
  onWarningRef.current = onWarning;
  onActivityRef.current = onActivity;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (warningMs > 0 && warningMs < timeoutMs) {
      warningTimerRef.current = setTimeout(() => {
        onWarningRef.current?.();
      }, timeoutMs - warningMs);
    }
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs, warningMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      return;
    }

    const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    // Start the timer immediately
    resetTimer();

    const handleActivity = () => {
      resetTimer();
      onActivityRef.current?.();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Also reset when tab becomes visible again (prevents instant logout
    // if the user switched tabs and came back within the window).
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleActivity();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, resetTimer]);
}
