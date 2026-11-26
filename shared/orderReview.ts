export const OUTSTANDING_ORDER_STATUSES = [
  "pending",
  "awaiting_confirmation",
] as const;
export const ORDER_REVIEW_FILTERS = [
  "outstanding",
  "pending",
  "awaiting_confirmation",
  "paid",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderReviewFilter = (typeof ORDER_REVIEW_FILTERS)[number];
export const OUTSTANDING_ORDERS_PATH = "/admin/orders?status=outstanding";

export function getOrderReviewFilter(
  search: string
): OrderReviewFilter | undefined {
  const params = new URLSearchParams(search);
  // A source-record link must remain findable regardless of its current status.
  const id = params.get("orderId");
  if (
    id &&
    /^\d+$/.test(id) &&
    Number.isSafeInteger(Number(id)) &&
    Number(id) > 0
  )
    return undefined;
  const value = params.get("status");
  return ORDER_REVIEW_FILTERS.find(filter => filter === value);
}

export function orderReviewPath(filter?: OrderReviewFilter) {
  return filter ? `/admin/orders?status=${filter}` : "/admin/orders";
}

/** SQLite's unzoned timestamps are stored UTC; preserve explicit offsets. */
export function orderReviewDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(
    /[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`
  );
  return Number.isFinite(date.getTime()) ? date : null;
}

export function orderAgeDays(
  value: string | null | undefined,
  now = new Date()
): number | null {
  const created = orderReviewDate(value);
  return created
    ? Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000))
    : null;
}
