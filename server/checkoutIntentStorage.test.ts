import { describe, expect, it } from "vitest";
import {
  readCheckoutIntentRecords,
  rememberCheckoutIntent,
  type IntentStorage,
} from "../frontend/src/lib/checkoutIntentStorage";
import { defaultCheckoutIntentKey } from "../shared/checkoutIntent";
function storage(): IntentStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
const hash = (value: number) => value.toString(16).padStart(64, "0");
describe("bounded opaque checkout intent storage", () => {
  it("retains at most twenty request references and never stores additional personal payload fields", () => {
    const cache = storage();
    for (let index = 1; index <= 25; index++)
      rememberCheckoutIntent([cache], 7, hash(index), {
        key: defaultCheckoutIntentKey(hash(index)),
        orderId: index,
        touchedAt: index,
        giftEmail: "PRIVATE-RECIPIENT",
        notes: "PRIVATE-NOTES",
      } as any);
    expect(Object.keys(readCheckoutIntentRecords([cache], 7))).toHaveLength(20);
    expect(readCheckoutIntentRecords([cache], 7)[hash(25)].orderId).toBe(25);
    expect([...cache.values.values()].join("")).not.toMatch(
      /PRIVATE-RECIPIENT|PRIVATE-NOTES/
    );
    expect(readCheckoutIntentRecords([cache], 8)).toEqual({});
  });
  it("preserves a new key through session storage when primary storage writes fail", () => {
    const primary = storage(),
      secondary = storage(),
      fingerprint = hash(1);
    rememberCheckoutIntent([primary], 7, fingerprint, {
      key: defaultCheckoutIntentKey(fingerprint),
      orderId: 1,
      touchedAt: 1,
    });
    primary.setItem = () => {
      throw new Error("Quota unavailable");
    };
    rememberCheckoutIntent([primary, secondary], 7, fingerprint, {
      key: "new:durable-second-intent",
      previousOrderId: 1,
      touchedAt: 2,
    });
    expect(
      readCheckoutIntentRecords([primary, secondary], 7)[fingerprint]
    ).toMatchObject({ key: "new:durable-second-intent", previousOrderId: 1 });
  });
  it("fails safely on blocked, malformed or oversized storage without inventing a new purchase key", () => {
    const blocked: IntentStorage = {
      getItem() {
        throw new Error("Blocked");
      },
      setItem() {
        throw new Error("Blocked");
      },
    };
    expect(readCheckoutIntentRecords([blocked], 7)).toEqual({});
    expect(() =>
      rememberCheckoutIntent([blocked], 7, hash(1), {
        key: defaultCheckoutIntentKey(hash(1)),
        touchedAt: 1,
      })
    ).not.toThrow();
    const invalid = storage();
    invalid.values.set("xflex:checkout-intents:v1:7", "x".repeat(32001));
    expect(readCheckoutIntentRecords([invalid], 7)).toEqual({});
    invalid.values.set(
      "xflex:checkout-intents:v1:7",
      '{"__proto__":{"key":"new:untrusted-reference"}}'
    );
    expect(readCheckoutIntentRecords([invalid], 7)).toEqual({});
  });
});
