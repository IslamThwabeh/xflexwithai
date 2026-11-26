import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  canonicalCheckoutRequest,
  hashCheckoutRequest,
  defaultCheckoutIntentKey,
  type CheckoutFlow,
  type CheckoutIntentPayload,
} from "@shared/checkoutIntent";
import {
  checkoutIntentStores,
  readCheckoutIntentRecords,
  rememberCheckoutIntent,
  type CheckoutIntentRecord,
} from "./checkoutIntentStorage";

type Prepared = {
  userId: number;
  signature: string;
  hash: string;
  entry: CheckoutIntentRecord;
  hadRecord: boolean;
};
export function useCheckoutIntent(
  flow: CheckoutFlow,
  payload: CheckoutIntentPayload,
  enabled = true
) {
  const { user, loading, error: authError } = useAuth();
  const userId = user?.id ?? 0;
  const signature =
    enabled && userId > 0
      ? canonicalCheckoutRequest(userId, flow, payload)
      : "";
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failure, setFailure] = useState<{
    signature: string;
    message: string;
  } | null>(null);
  const submissions = useRef(
    new Map<string, { userId: number; hash: string }>()
  );
  useEffect(() => {
    submissions.current.clear();
  }, [userId]);
  useEffect(() => {
    let active = true;
    if (!enabled || userId <= 0) {
      setPrepared(null);
      return;
    }
    // The canonical signature is the complete semantic dependency; fresh form
    // object identities and retry timestamps must not create another intent.
    void hashCheckoutRequest(userId, flow, payload)
      .then(hash => {
        if (!active) return;
        const cached = readCheckoutIntentRecords(
          checkoutIntentStores(),
          userId
        )[hash];
        setPrepared({
          userId,
          signature,
          hash,
          hadRecord: !!cached,
          entry: cached ?? {
            key: defaultCheckoutIntentKey(hash),
            touchedAt: Date.now(),
          },
        });
        setFailure(null);
      })
      .catch(() => {
        if (active) setFailure({ signature, message: "prepare_failed" });
      });
    return () => {
      active = false;
    };
  }, [userId, flow, signature, enabled]);
  const current =
    prepared?.userId === userId && prepared.signature === signature
      ? prepared
      : null;
  const error =
    enabled && userId < 0
      ? "customer_account_required"
      : failure?.signature === signature
        ? failure.message
        : null;
  const ready = !!current && enabled && !loading && !authError && !error;
  const beginSubmission = () => {
    if (!ready || !current) return null;
    const entry = { ...current.entry, submitted: true, touchedAt: Date.now() };
    const latest = readCheckoutIntentRecords(checkoutIntentStores(), userId)[
      current.hash
    ];
    if (!latest || latest.key === entry.key)
      rememberCheckoutIntent(
        checkoutIntentStores(),
        userId,
        current.hash,
        entry
      );
    submissions.current.set(entry.key, { userId, hash: current.hash });
    while (submissions.current.size > 20)
      submissions.current.delete(submissions.current.keys().next().value!);
    setPrepared({ ...current, entry, hadRecord: true });
    return entry.key;
  };
  const recordOrder = (orderId: number, key?: string) => {
    if (!key || !Number.isSafeInteger(orderId) || orderId <= 0) return;
    const submission = submissions.current.get(key);
    if (!submission || submission.userId !== userId) return;
    const cached = readCheckoutIntentRecords(checkoutIntentStores(), userId)[
      submission.hash
    ];
    const entry = {
      ...cached,
      key,
      orderId,
      submitted: true,
      touchedAt: Date.now(),
    };
    // An older in-flight response must not replace a newer deliberate intent.
    if (!cached || cached.key === key)
      rememberCheckoutIntent(
        checkoutIntentStores(),
        userId,
        submission.hash,
        entry
      );
    setPrepared(value =>
      value?.userId === userId &&
      value.hash === submission.hash &&
      value.entry.key === key
        ? { ...value, entry, hadRecord: true }
        : value
    );
  };
  const startAnother = () => {
    if (!ready || !current) return false;
    try {
      const entry: CheckoutIntentRecord = {
        key: `new:${crypto.randomUUID()}`,
        previousOrderId: current.entry.orderId ?? current.entry.previousOrderId,
        submitted: false,
        touchedAt: Date.now(),
      };
      rememberCheckoutIntent(
        checkoutIntentStores(),
        userId,
        current.hash,
        entry
      );
      setPrepared({ ...current, entry, hadRecord: true });
      return true;
    } catch {
      setFailure({ signature, message: "prepare_failed" });
      return false;
    }
  };
  return {
    ready,
    error,
    beginSubmission,
    recordOrder,
    startAnother,
    contextKey: current?.hash ?? "",
    hasRecord: current?.hadRecord ?? false,
    activeOrderId: current?.entry.orderId,
    priorOrderId: current?.entry.orderId ?? current?.entry.previousOrderId,
    freshChoice:
      !!current?.entry.key.startsWith("new:") &&
      current.entry.submitted !== true &&
      !current.entry.orderId,
  };
}
export type CheckoutIntentState = ReturnType<typeof useCheckoutIntent>;
