import { isCheckoutIntentKey } from "../../../shared/checkoutIntent";

export type CheckoutIntentRecord = {
  key: string;
  orderId?: number;
  previousOrderId?: number;
  submitted?: boolean;
  touchedAt: number;
};
export type IntentStorage = Pick<Storage, "getItem" | "setItem">;
const LIMIT = 20;
const validId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const bucket = (userId: number) => `xflex:checkout-intents:v1:${userId}`;

export function readCheckoutIntentRecords(
  stores: IntentStorage[],
  userId: number
) {
  const records: Record<string, CheckoutIntentRecord> = {};
  if (!Number.isSafeInteger(userId) || userId <= 0) return records;
  for (const storage of stores) {
    try {
      const value = storage.getItem(bucket(userId));
      if (!value || value.length > 32000) continue;
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        continue;
      for (const [hash, entry] of Object.entries(parsed)) {
        const item = entry as Partial<CheckoutIntentRecord> | null;
        if (
          !/^[a-f0-9]{64}$/.test(hash) ||
          !item ||
          typeof item.key !== "string" ||
          !isCheckoutIntentKey(item.key) ||
          !Number.isFinite(item.touchedAt) ||
          Number(item.touchedAt) < 0
        )
          continue;
        const clean: CheckoutIntentRecord = {
          key: item.key,
          touchedAt: Math.min(Number(item.touchedAt), Date.now()),
          ...(typeof item.submitted === "boolean"
            ? { submitted: item.submitted }
            : {}),
          ...(validId(item.orderId) ? { orderId: item.orderId } : {}),
          ...(validId(item.previousOrderId)
            ? { previousOrderId: item.previousOrderId }
            : {}),
        };
        if (!records[hash] || clean.touchedAt >= records[hash].touchedAt)
          records[hash] = clean;
      }
    } catch {
      /* Storage is optional; deterministic default keys still protect retries. */
    }
  }
  return Object.fromEntries(
    Object.entries(records)
      .sort((a, b) => b[1].touchedAt - a[1].touchedAt)
      .slice(0, LIMIT)
  );
}

export function rememberCheckoutIntent(
  stores: IntentStorage[],
  userId: number,
  hash: string,
  entry: CheckoutIntentRecord
) {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !/^[a-f0-9]{64}$/.test(hash) ||
    !isCheckoutIntentKey(entry.key)
  )
    return;
  const clean: CheckoutIntentRecord = {
    key: entry.key,
    touchedAt: Date.now(),
    ...(typeof entry.submitted === "boolean"
      ? { submitted: entry.submitted }
      : {}),
    ...(validId(entry.orderId) ? { orderId: entry.orderId } : {}),
    ...(validId(entry.previousOrderId)
      ? { previousOrderId: entry.previousOrderId }
      : {}),
  };
  const old = readCheckoutIntentRecords(stores, userId);
  const records = Object.fromEntries(
    [
      [hash, clean] as const,
      ...Object.entries(old).filter(([key]) => key !== hash),
    ]
      .sort((a, b) => b[1].touchedAt - a[1].touchedAt)
      .slice(0, LIMIT)
  );
  for (const storage of stores) {
    try {
      storage.setItem(bucket(userId), JSON.stringify(records));
    } catch {
      /* Try the other storage and retain the active key in memory. */
    }
  }
}

export function checkoutIntentStores() {
  const result: IntentStorage[] = [];
  try {
    result.push(window.localStorage);
  } catch {
    /* Restricted browser storage. */
  }
  try {
    result.push(window.sessionStorage);
  } catch {
    /* Restricted browser storage. */
  }
  return result;
}
