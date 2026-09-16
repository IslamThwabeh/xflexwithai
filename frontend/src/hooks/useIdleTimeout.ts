import { useEffect, useRef, useCallback } from "react";

export const USER_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointermove",
  "mousemove",
  "pointerdown",
  "mousedown",
  "keydown",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "touchstart",
  "scroll",
  "click",
];

export const FRESH_LOGIN_ACTIVITY_KEY = "xflex:fresh-login-activity";

export function markFreshLoginActivity(at: number = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FRESH_LOGIN_ACTIVITY_KEY, String(at));
  } catch {
    // Storage may be unavailable in private/restricted browser modes.
  }
}

export function getInitialActivityAt(
  now: number,
  sharedActivityAt: number | null,
  freshLoginActivityAt: number | null,
): number {
  return freshLoginActivityAt ?? sharedActivityAt ?? now;
}

export function getRemainingIdleDelay(
  lastActivityAt: number,
  now: number,
  timeoutMs: number,
): number {
  return Math.max(0, timeoutMs - Math.max(0, now - lastActivityAt));
}

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
  activityStorageKey,
}: {
  timeoutMs: number;
  onIdle: () => void;
  warningMs?: number;
  onWarning?: () => void;
  onActivity?: () => void;
  enabled?: boolean;
  activityStorageKey?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Seeded by the initialization effect from explicit login, persisted genuine
  // activity, or the current time only when neither exists.
  const lastActivityAtRef = useRef(0);
  const lastBroadcastAtRef = useRef(0);
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onActivityRef = useRef(onActivity);
  onIdleRef.current = onIdle;
  onWarningRef.current = onWarning;
  onActivityRef.current = onActivity;

  const readSharedActivityAt = useCallback(() => {
    if (!activityStorageKey || typeof window === "undefined") return null;
    try {
      const value = Number(window.localStorage.getItem(activityStorageKey));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }, [activityStorageKey]);

  const consumeFreshLoginActivityAt = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const value = Number(window.sessionStorage.getItem(FRESH_LOGIN_ACTIVITY_KEY));
      window.sessionStorage.removeItem(FRESH_LOGIN_ACTIVITY_KEY);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }, []);

  const resetTimer = useCallback((activityAt: number = Date.now()) => {
    lastActivityAtRef.current = Math.max(lastActivityAtRef.current, activityAt);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    const now = Date.now();
    const remainingMs = getRemainingIdleDelay(lastActivityAtRef.current, now, timeoutMs);
    const warningDelayMs = remainingMs - warningMs;
    if (warningMs > 0 && warningMs < timeoutMs && warningDelayMs > 0) {
      warningTimerRef.current = setTimeout(() => {
        onWarningRef.current?.();
      }, warningDelayMs);
    } else if (warningMs > 0 && remainingMs > 0 && remainingMs <= warningMs) {
      onWarningRef.current?.();
    }
    timerRef.current = setTimeout(() => {
      const sharedActivityAt = readSharedActivityAt();
      if (sharedActivityAt && sharedActivityAt > lastActivityAtRef.current) {
        resetTimer(sharedActivityAt);
        return;
      }
      onIdleRef.current();
    }, remainingMs);
  }, [readSharedActivityAt, timeoutMs, warningMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      return;
    }

    // A reload or restored tab is not user activity. Preserve the last genuine
    // interaction across reloads, while an explicit successful login starts a
    // fresh idle window.
    const sharedActivityAt = readSharedActivityAt();
    const freshLoginActivityAt = consumeFreshLoginActivityAt();
    const initialActivityAt = getInitialActivityAt(
      Date.now(),
      sharedActivityAt,
      freshLoginActivityAt,
    );
    resetTimer(initialActivityAt);
    if (activityStorageKey && (freshLoginActivityAt || !sharedActivityAt)) {
      lastBroadcastAtRef.current = initialActivityAt;
      try {
        window.localStorage.setItem(activityStorageKey, String(initialActivityAt));
      } catch {
        // Storage may be unavailable in private/restricted browser modes.
      }
    }

    const handleActivity = (event?: Event) => {
      if (event && "isTrusted" in event && !event.isTrusted) return;
      const now = Date.now();
      resetTimer(now);
      if (activityStorageKey && now - lastBroadcastAtRef.current >= 1_000) {
        lastBroadcastAtRef.current = now;
        try {
          window.localStorage.setItem(activityStorageKey, String(now));
        } catch {
          // Storage may be unavailable in private/restricted browser modes.
        }
      }
      onActivityRef.current?.();
    };

    const handleSharedActivity = (event: StorageEvent) => {
      if (!activityStorageKey || event.key !== activityStorageKey || !event.newValue) return;
      const activityAt = Number(event.newValue);
      if (Number.isFinite(activityAt) && activityAt > lastActivityAtRef.current) {
        // Another tab recorded a real interaction. Keep this tab's local idle
        // timer aligned without generating a duplicate server heartbeat.
        resetTimer(activityAt);
      }
    };

    for (const event of USER_ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    window.addEventListener("storage", handleSharedActivity);

    // Restoring a tab is not user activity. Recalculate from the last genuine
    // local/shared interaction; an already-expired session logs out immediately.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const latestSharedActivityAt = readSharedActivityAt();
      resetTimer(latestSharedActivityAt ?? lastActivityAtRef.current);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      for (const event of USER_ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      window.removeEventListener("storage", handleSharedActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activityStorageKey, consumeFreshLoginActivityAt, enabled, readSharedActivityAt, resetTimer, timeoutMs]);
}
