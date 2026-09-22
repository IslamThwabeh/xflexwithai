export const PRIORITY_DELAY_THRESHOLD_MINUTES = 5;
export const BULK_RECOVERY_HEALTHY_MINUTES = 10;

export type BulkDeliveryControlState = {
  mode: "automatic" | "manual_paused";
  isPaused: boolean;
  reason: string | null;
  pausedAt: string | null;
  healthySince: string | null;
  lastEvaluatedAt: string | null;
  updatedAt: string;
  updatedByAdminId: number | null;
};

export type BulkDeliveryControlAction =
  | "none"
  | "automatic_paused"
  | "automatic_recovery_started"
  | "automatic_recovery_cancelled"
  | "automatic_resumed";

export function decideAutomaticBulkDeliveryState(input: {
  state: BulkDeliveryControlState;
  hasPriorityDelay: boolean;
  now: Date;
  recoveryHealthyMinutes?: number;
}): { action: BulkDeliveryControlAction; next: BulkDeliveryControlState } {
  const nowIso = input.now.toISOString();
  const state = input.state;
  if (state.mode === "manual_paused") {
    return { action: "none", next: state };
  }

  if (input.hasPriorityDelay) {
    if (state.isPaused && !state.healthySince) return { action: "none", next: state };
    return {
      action: state.isPaused ? "automatic_recovery_cancelled" : "automatic_paused",
      next: {
        ...state,
        isPaused: true,
        reason: "priority_delivery_delayed",
        pausedAt: state.pausedAt ?? nowIso,
        healthySince: null,
        lastEvaluatedAt: nowIso,
        updatedAt: nowIso,
        updatedByAdminId: null,
      },
    };
  }

  if (!state.isPaused) return { action: "none", next: state };
  if (!state.healthySince) {
    return {
      action: "automatic_recovery_started",
      next: { ...state, healthySince: nowIso, lastEvaluatedAt: nowIso, updatedAt: nowIso },
    };
  }

  const recoveryMs = Math.max(1, input.recoveryHealthyMinutes ?? BULK_RECOVERY_HEALTHY_MINUTES) * 60_000;
  const healthySinceMs = new Date(state.healthySince).getTime();
  if (!Number.isFinite(healthySinceMs) || input.now.getTime() - healthySinceMs < recoveryMs) {
    return { action: "none", next: state };
  }

  return {
    action: "automatic_resumed",
    next: {
      ...state,
      isPaused: false,
      reason: null,
      pausedAt: null,
      healthySince: null,
      lastEvaluatedAt: nowIso,
      updatedAt: nowIso,
      updatedByAdminId: null,
    },
  };
}
