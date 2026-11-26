import { beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import {
  checkoutIntentDatabase,
  checkoutMigration,
} from "./fixtures/checkoutIntentDatabase";
import {
  createOrderForCheckoutIntent,
  findCheckoutIntent,
  bindCheckoutIntentToOrder,
  CHECKOUT_INTENT_LOOKUP_SQL,
  type CheckoutOrderPlan,
} from "../backend/services/checkout-intent.service";
import { getCheckoutInvoiceAmounts } from "../shared/checkoutPricing";
let database: D1Database;
const now = "2026-11-26T10:00:00.000Z";
function plan(key = "checkout:shared-intent", userId = 7): CheckoutOrderPlan {
  const { grossSubtotalMinor, grossDiscountMinor, formatVersion, ...invoice } =
    getCheckoutInvoiceAmounts(10000, 1000);
  return {
    intent: { userId, key, requestHash: "a".repeat(64), flow: "package" },
    order: {
      userId,
      status: "pending",
      ...invoice,
      currency: "ILS",
      paymentMethod: "bank_transfer",
      isGift: true,
      giftEmail: "gift@example.test",
      giftMessage: "Original gift",
      notes: "Original request",
      isUpgrade: false,
      transactionPurpose: "new_sale",
      termsAcceptedAt: now,
      termsAcceptedVersion: "terms-v1",
      termsAcceptedIpAddress: "PRIVATE-IP",
      termsAcceptedUserAgent: "PRIVATE-UA",
      createdAt: now,
      updatedAt: now,
    },
    item: {
      itemType: "package",
      packageId: 1,
      courseId: null,
      priceAtPurchase: 10000,
      currency: "ILS",
      transactionPurpose: "new_sale",
    },
    pricing: {
      grossSubtotalMinor,
      grossDiscountMinor,
      formatVersion,
      createdAt: now,
    },
    coupon: {
      id: 1,
      discountType: "percentage",
      discountValue: 10,
      maxUses: 10,
      minOrderAmount: null,
      validFrom: null,
      validUntil: null,
      packageId: null,
    },
  };
}
async function count(table: string) {
  return Number(
    (await database.prepare(`SELECT count(*) AS total FROM ${table}`).first())
      ?.total
  );
}
async function used() {
  return Number(
    (
      await database
        .prepare("SELECT used_count FROM coupons WHERE id=1")
        .first()
    )?.used_count
  );
}
function servicePlan(flow: "upgrade" | "renewal" | "copier") {
  const request = plan("checkout:service-" + flow);
  delete request.coupon;
  delete request.pricing;
  request.intent.flow = flow;
  const { grossSubtotalMinor, grossDiscountMinor, formatVersion, ...invoice } =
    getCheckoutInvoiceAmounts(flow === "copier" ? 100000 : 10000, 0);
  const purpose = flow === "copier" ? "copier_subscription" : flow;
  request.order = {
    ...request.order,
    ...invoice,
    isGift: false,
    giftEmail: null,
    giftMessage: null,
    isUpgrade: flow === "upgrade",
    transactionPurpose: purpose,
  };
  request.item = {
    itemType: flow === "copier" ? "service" : "package",
    packageId: flow === "copier" ? null : 1,
    courseId: null,
    priceAtPurchase: invoice.totalAmount,
    currency: "ILS",
    transactionPurpose: purpose,
  };
  if (flow === "renewal")
    request.renewal = {
      userId: 7,
      packageId: 1,
      entitlementDays: 30,
      amountIlsMinor: invoice.totalAmount,
      recommendationsCurrentEndAt: "2026-12-01",
      lexaiCurrentEndAt: "2026-12-01",
      recommendationsProjectedEndAt: "2026-12-31",
      lexaiProjectedEndAt: "2026-12-31",
      createdAt: now,
    };
  if (flow === "copier")
    request.copier = {
      userId: 7,
      status: "pending_payment",
      serviceKey: "trade_copier",
      amountIlsMinor: invoice.totalAmount,
      accessDays: 365,
      createdByType: "user",
      createdById: 7,
      createdAt: now,
      updatedAt: now,
    };
  return request;
}

describe("durable checkout creation transaction", () => {
  beforeEach(async () => {
    database = await checkoutIntentDatabase();
  });
  it.each(["upgrade", "renewal", "copier"] as const)(
    "creates and retries one complete %s request without cash/access changes",
    async flow => {
      const request = servicePlan(flow),
        first = await createOrderForCheckoutIntent(database, request);
      await expect(
        createOrderForCheckoutIntent(database, request)
      ).resolves.toEqual({ orderId: first.orderId, created: false });
      expect(await count("orders")).toBe(1);
      expect(await count("orderItems")).toBe(1);
      expect(await count("order_renewal_details")).toBe(
        flow === "renewal" ? 1 : 0
      );
      expect(await count("trade_copier_subscriptions")).toBe(
        flow === "copier" ? 1 : 0
      );
      for (const table of [
        "financial_ledger_entries",
        "order_payment_confirmations",
        "registrationKeys",
        "live_package_entitlements",
      ])
        expect(await count(table)).toBe(0);
    }
  );
  it.each([
    ["renewal", "order_renewal_details"],
    ["copier", "trade_copier_subscriptions"],
  ] as const)(
    "rolls back the order/intent if required %s detail fails",
    async (flow, table) => {
      await database.exec(
        `CREATE TRIGGER reject_service BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'service detail failed'); END`
      );
      await expect(
        createOrderForCheckoutIntent(database, servicePlan(flow))
      ).rejects.toThrow("service detail failed");
      for (const name of ["orders", "orderItems", "checkout_intents", table])
        expect(await count(name)).toBe(0);
    }
  );
  it("rejects inconsistent item ownership/classification before persisting a claim", async () => {
    const request = plan();
    request.item.currency = "USD";
    await expect(
      createOrderForCheckoutIntent(database, request)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await count("checkout_intents")).toBe(0);
    expect(await count("orders")).toBe(0);
  });
  it("persists one complete order and coupon use under same-key concurrency", async () => {
    const request = plan();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        createOrderForCheckoutIntent(database, request)
      )
    );
    expect(new Set(results.map(result => result.orderId)).size).toBe(1);
    expect(results.filter(result => result.created)).toHaveLength(1);
    for (const table of [
      "checkout_intents",
      "orders",
      "orderItems",
      "order_pricing_snapshots",
    ])
      expect(await count(table)).toBe(1);
    expect(await used()).toBe(1);
    expect(
      await database
        .prepare(
          "SELECT subtotal-discountAmount+vatAmount AS components,totalAmount,termsAcceptedAt,termsAcceptedIpAddress,giftEmail FROM orders"
        )
        .first()
    ).toEqual({
      components: 9000,
      totalAmount: 9000,
      termsAcceptedAt: now,
      termsAcceptedIpAddress: "PRIVATE-IP",
      giftEmail: "gift@example.test",
    });
    for (const table of [
      "financial_ledger_entries",
      "order_payment_confirmations",
      "registrationKeys",
      "live_package_entitlements",
    ])
      expect(await count(table)).toBe(0);
  });
  it("returns the original intent after completion without consuming another coupon or altering legal proof", async () => {
    const request = plan(),
      first = await createOrderForCheckoutIntent(database, request);
    await database
      .prepare("UPDATE orders SET status='completed' WHERE id=?")
      .bind(first.orderId)
      .run();
    request.order.termsAcceptedAt = "2027-01-01T00:00:00Z";
    request.order.termsAcceptedIpAddress = "A different retry device";
    await expect(
      createOrderForCheckoutIntent(database, request)
    ).resolves.toEqual({ orderId: first.orderId, created: false });
    expect(await used()).toBe(1);
    expect(
      (await database.prepare("SELECT termsAcceptedAt FROM orders").first())
        ?.termsAcceptedAt
    ).toBe(now);
  });
  it("isolates the same key by customer and rejects a mismatched payload before new writes", async () => {
    const first = plan();
    await createOrderForCheckoutIntent(database, first);
    await expect(
      createOrderForCheckoutIntent(database, {
        ...first,
        intent: { ...first.intent, requestHash: "b".repeat(64) },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createOrderForCheckoutIntent(database, plan(first.intent.key, 8))
    ).resolves.toMatchObject({ created: true });
    expect(await count("orders")).toBe(2);
    expect(await used()).toBe(2);
  });
  it("permits a deliberate new intent and preserves both distinct purchases", async () => {
    const first = await createOrderForCheckoutIntent(database, plan());
    const second = await createOrderForCheckoutIntent(
      database,
      plan("new:explicit-purchase")
    );
    expect(second.orderId).not.toBe(first.orderId);
    expect(await count("orders")).toBe(2);
    expect(await used()).toBe(2);
  });
  it.each(["orders", "orderItems", "order_pricing_snapshots"])(
    "rolls the full claim/order/details back if %s fails",
    async table => {
      await database.exec(
        `CREATE TRIGGER reject_fixture BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'fixture detail failed'); END`
      );
      await expect(
        createOrderForCheckoutIntent(database, plan())
      ).rejects.toThrow("fixture detail failed");
      for (const name of [
        "checkout_intents",
        "orders",
        "orderItems",
        "order_pricing_snapshots",
      ])
        expect(await count(name)).toBe(0);
      expect(await used()).toBe(0);
    }
  );
  it("rechecks coupon capacity inside concurrent different-intent transactions", async () => {
    await database.exec("UPDATE coupons SET max_uses=1");
    const first = plan("checkout:coupon-first"),
      second = plan("checkout:coupon-second");
    first.coupon!.maxUses = 1;
    second.coupon!.maxUses = 1;
    const results = await Promise.allSettled([
      createOrderForCheckoutIntent(database, first),
      createOrderForCheckoutIntent(database, second),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(await count("orders")).toBe(1);
    expect(await count("checkout_intents")).toBe(1);
    expect(await used()).toBe(1);
  });
  it("does not count an exhausted coupon again when an identical concurrent request has already won", async () => {
    await database.exec("UPDATE coupons SET max_uses=1");
    const request = plan();
    request.coupon!.maxUses = 1;
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        createOrderForCheckoutIntent(database, request)
      )
    );
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(await used()).toBe(1);
  });
  it("maps domain-level reuse to the existing order and refuses another customer order", async () => {
    const first = await createOrderForCheckoutIntent(database, plan());
    const alias = {
      ...plan().intent,
      key: "checkout:pending-alias",
      requestHash: "c".repeat(64),
    };
    await expect(
      bindCheckoutIntentToOrder(database, alias, first.orderId)
    ).resolves.toBe(first.orderId);
    await expect(
      bindCheckoutIntentToOrder(
        database,
        { ...alias, userId: 8 },
        first.orderId
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await count("orders")).toBe(1);
    expect(await used()).toBe(1);
  });
  it("keeps intent mappings and new pricing snapshots immutable", async () => {
    await createOrderForCheckoutIntent(database, plan());
    await expect(
      database.exec("UPDATE checkout_intents SET request_hash='changed'")
    ).rejects.toThrow("checkout_intent_immutable");
    await expect(database.exec("DELETE FROM checkout_intents")).rejects.toThrow(
      "checkout_intent_immutable"
    );
    await expect(
      database.exec("UPDATE order_pricing_snapshots SET gross_discount_minor=0")
    ).rejects.toThrow("checkout_pricing_immutable");
  });
  it("uses indexed identity/owner lookup and reapplies the additive migration without rewriting orders", async () => {
    const request = plan();
    await createOrderForCheckoutIntent(database, request);
    await database.exec(checkoutMigration);
    const queryPlan = (
      await database
        .prepare("EXPLAIN QUERY PLAN " + CHECKOUT_INTENT_LOOKUP_SQL)
        .bind(7, request.intent.key)
        .all()
    ).results
      .map(row => String(row.detail))
      .join("\n");
    expect(queryPlan).not.toMatch(/SCAN /);
    expect(queryPlan).toMatch(
      /SEARCH i USING INDEX|SEARCH i USING COVERING INDEX/
    );
    expect(queryPlan).toContain("INTEGER PRIMARY KEY");
    expect(await findCheckoutIntent(database, request.intent)).toBe(1);
    expect(await count("orders")).toBe(1);
    expect(await count("schema_migrations")).toBe(1);
  });
});
