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
  enabled = true,
}: {
  timeoutMs: number;
  onIdle: () => void;
  enabled?: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
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

    const handleActivity = () => resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Also reset when tab becomes visible again (prevents instant logout
    // if the user switched tabs and came back within the window).
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, resetTimer]);
}
