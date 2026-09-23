export type ProviderDeliveryStatus =
  | "deferred"
  | "delivered"
  | "bounced_soft"
  | "bounced_hard"
  | "rejected"
  | "complained";

const STATUS_PRECEDENCE: Record<ProviderDeliveryStatus, number> = {
  deferred: 10,
  bounced_soft: 20,
  delivered: 30,
  rejected: 40,
  bounced_hard: 40,
  complained: 50,
};

const TERMINAL_STATUSES = new Set<ProviderDeliveryStatus>([
  "delivered",
  "bounced_hard",
  "rejected",
  "complained",
]);

function timestampValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decides whether a provider event may replace the delivery-log projection.
 * Event history is retained separately even when an older or weaker event loses.
 */
export function shouldApplyProviderDeliveryEvent(input: {
  currentStatus: string;
  currentEventAt: string | null;
  nextStatus: ProviderDeliveryStatus;
  nextEventAt: string;
}) {
  const currentStatus = input.currentStatus as ProviderDeliveryStatus;
  const currentAt = timestampValue(input.currentEventAt);
  const nextAt = timestampValue(input.nextEventAt);

  if (currentAt != null && nextAt != null && nextAt < currentAt) return false;
  if (currentStatus === "complained") return false;
  if (TERMINAL_STATUSES.has(currentStatus)) {
    return input.nextStatus === "complained";
  }

  if (currentAt != null && nextAt != null && nextAt === currentAt) {
    return STATUS_PRECEDENCE[input.nextStatus] >= (STATUS_PRECEDENCE[currentStatus] ?? 0);
  }
  return true;
}

export function isFinalProviderDeliveryStatus(status: ProviderDeliveryStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function isProviderDeliveryFailure(status: ProviderDeliveryStatus) {
  return status === "deferred"
    || status === "bounced_soft"
    || status === "bounced_hard"
    || status === "rejected"
    || status === "complained";
}
