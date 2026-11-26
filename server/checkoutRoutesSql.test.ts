import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { getTableColumns } from "drizzle-orm";
import { packages } from "../database/schema-sqlite";
import { checkoutIntentDatabase } from "./fixtures/checkoutIntentDatabase";
import { CURRENT_TERMS_VERSION } from "../shared/legal";

vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  checkUpgradeEligibility: vi.fn(),
  notifyStaffByEvent: vi.fn(),
  getUserTermsAcceptanceStatus: vi.fn(),
  getOrderActivationKeys: vi.fn(),
  getOrderKeyFulfillmentRows: vi.fn(),
  getAdminByEmail: vi.fn(),
}));
vi.mock("../backend/_core/orderEmails", async () => ({
  ...(await vi.importActual<typeof import("../backend/_core/orderEmails")>(
    "../backend/_core/orderEmails"
  )),
  sendOrderConfirmationEmail: vi.fn(),
  sendAdminNewOrderNotification: vi.fn(),
}));
import * as db from "../backend/db";
import { appRouter } from "../backend/routers";
import {
  sendOrderConfirmationEmail,
  sendAdminNewOrderNotification,
} from "../backend/_core/orderEmails";

let binding: D1Database;
let queries: string[];
// The production adapter caches its binding. Delegate to a new in-memory
// fixture for each test without changing production initialization behavior.
const proxy = new Proxy({} as D1Database, {
  get(_target, key) {
    if (key === "prepare")
      return (query: string) => {
        queries.push(query);
        return binding.prepare(query);
      };
    const value = (binding as any)[key];
    return typeof value === "function" ? value.bind(binding) : value;
  },
});
const user = {
  id: 7,
  email: "buyer@example.test",
  name: "Buyer",
  isStaff: false,
  emailVerified: true,
};
const caller = (identity: any = user) =>
  appRouter.createCaller({
    user: identity,
    req: {
      headers: {
        "cf-connecting-ip": "203.0.113.20",
        "user-agent": "Checkout SQL test",
      },
      method: "POST",
      path: "/api/trpc/orders.create",
    },
    setCookie() {},
    clearCookie() {},
  } as any);
const input = () => ({
  items: [{ itemType: "package" as const, packageId: 2 }],
  paymentMethod: "bank_transfer" as const,
  isGift: true,
  giftEmail: " Gift@Example.Com ",
  giftMessage: " Original gift ",
  notes: " Buyer note ",
  couponCode: " save10 ",
  termsAcceptedAt: "2000-01-01T00:00:00Z",
  termsAcceptedVersion: CURRENT_TERMS_VERSION,
});
const count = async (table: string) =>
  Number(
    (await binding.prepare(`SELECT count(*) AS total FROM ${table}`).first())
      ?.total
  );

describe("customer checkout through the actual SQLite persistence boundary", () => {
  it("rejects stale prices and coupon savings before writing, while saved retries retain their original invoice", async () => {
    const request = input();
    const quote = { grossSubtotalMinor: 50000, grossDiscountMinor: 5000, currency: 'USD' as const, vatRate: 16 };
    for (const expectedQuote of [{...quote,grossSubtotalMinor:49000},{...quote,grossDiscountMinor:4000},{...quote,vatRate:15},{...quote,currency:'ILS' as const}]) {
      await expect(caller().orders.create({...request,expectedQuote})).rejects.toMatchObject({code:'CONFLICT'});
      expect(await count('orders')).toBe(0);
      expect(await count('checkout_intents')).toBe(0);
    }
    const first = await caller().orders.create({...request,expectedQuote:quote});
    await binding.exec("UPDATE packages SET price=60000;UPDATE coupons SET discount_value=20");
    const retry = await caller().orders.create({...request,expectedQuote:quote});
    expect(retry.id).toBe(first.id);
    expect(retry.totalAmount).toBe(45000);
    expect(retry.checkoutIntentReused).toBe(true);
    expect(await count('orders')).toBe(1);
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    binding = await checkoutIntentDatabase();
    queries = [];
    const columns = Object.values(getTableColumns(packages));
    await binding.exec(`CREATE TABLE packages(${columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`).join(",")});
    INSERT INTO packages(id,slug,packageType,nameEn,nameAr,isPublished,price,currency)VALUES(2,'comprehensive','standard','Comprehensive','الشاملة',1,50000,'USD');`);
    const connection = await db.getDb({ DB: proxy });
    expect(connection?.$client).toBe(proxy);
    vi.mocked(db.checkUpgradeEligibility).mockResolvedValue(null);
    vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined);
    vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({
      requiresAcceptance: false,
    } as any);
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([]);
    vi.mocked(db.getOrderKeyFulfillmentRows).mockResolvedValue([]);
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(sendOrderConfirmationEmail).mockResolvedValue(undefined as any);
    vi.mocked(sendAdminNewOrderNotification).mockResolvedValue(
      undefined as any
    );
  });

  it("stores the approved net-discount invoice and reads matching commercial ILS amounts without extra per-row pricing queries", async () => {
    const saved = await caller().orders.create(input());
    expect(saved).toMatchObject({
      userId: 7,
      status: "pending",
      subtotal: 43103,
      discountAmount: 4310,
      vatAmount: 6207,
      totalAmount: 45000,
      currency: "USD",
      giftEmail: "gift@example.com",
      giftMessage: "Original gift",
      notes: "Buyer note",
      checkoutIntentReused: false,
    });
    expect(saved.termsAcceptedAt).not.toContain("2000");
    expect(saved.termsAcceptedIpAddress).toBe("203.0.113.20");
    const details = await caller().orders.byId({ id: saved.id });
    expect(details).toMatchObject({
      displaySubtotalIls: 1465.5,
      displayDiscountIls: 146.54,
      displayVatIls: 211.04,
      displayTotalIls: 1530,
      displaySavingsIls: 170,
      pricingFormatVersion: 2,
    });
    expect(details.packageItems[0]).not.toHaveProperty("grossSubtotalMinor");
    expect(await count("orders")).toBe(1);
    expect(await count("orderItems")).toBe(1);
    expect(await count("order_pricing_snapshots")).toBe(1);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendAdminNewOrderNotification).toHaveBeenCalledTimes(1);
    expect(db.notifyStaffByEvent).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent default-key submissions and performs new-order notifications once", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => caller().orders.create(input()))
    );
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => !result.checkoutIntentReused)).toHaveLength(
      1
    );
    expect(await count("orders")).toBe(1);
    expect(await count("orderItems")).toBe(1);
    expect(
      (await binding.prepare("SELECT used_count FROM coupons").first())
        ?.used_count
    ).toBe(1);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(db.notifyStaffByEvent).toHaveBeenCalledTimes(1);
  });

  it("reuses a completed request despite changed price/coupon availability and retry timestamps", async () => {
    const first = await caller().orders.create(input());
    await binding.exec(
      "UPDATE orders SET status='completed';UPDATE packages SET price=60000,isPublished=0;UPDATE coupons SET is_active=0"
    );
    const resumed = await caller().orders.create({
      ...input(),
      termsAcceptedAt: "2099-01-01",
      giftEmail: "gift@example.com",
      couponCode: "SAVE10",
    });
    expect(resumed).toMatchObject({
      id: first.id,
      status: "completed",
      totalAmount: 45000,
      checkoutIntentReused: true,
    });
    expect(resumed.termsAcceptedAt).toBe(first.termsAcceptedAt);
    expect(await count("orders")).toBe(1);
    expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("allows distinct gifts while rejecting a supplied key reused with different purchase details", async () => {
    const first = await caller().orders.create({
      ...input(),
      checkoutIntentKey: "new:explicit-fixture-intent",
    });
    await expect(
      caller().orders.create({
        ...input(),
        checkoutIntentKey: "new:explicit-fixture-intent",
        giftEmail: "different@example.com",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const second = await caller().orders.create({
      ...input(),
      giftEmail: "different@example.com",
    });
    expect(second.id).not.toBe(first.id);
    expect(await count("orders")).toBe(2);
    queries = [];
    const list = await caller().orders.myOrders();
    expect(list).toHaveLength(2);
    const pricingReads = queries.filter(
      query =>
        /^select/i.test(query) && query.includes("order_pricing_snapshots")
    );
    expect(pricingReads).toHaveLength(1);
    const queryPlan = (
      await binding
        .prepare("EXPLAIN QUERY PLAN " + pricingReads[0])
        .bind(first.id, second.id, "package")
        .all()
    ).results
      .map(row => String(row.detail))
      .join("\n");
    expect(queryPlan).toContain("idx_order_items_order_id");
    expect(queryPlan).not.toMatch(/SCAN /);
  });

  it("keeps the saved result when staff notification fails instead of encouraging another creation", async () => {
    vi.mocked(db.notifyStaffByEvent).mockRejectedValue(
      new Error("Synthetic notification unavailable")
    );
    const saved = await caller().orders.create(input());
    expect(saved.checkoutIntentReused).toBe(false);
    await expect(caller().orders.create(input())).resolves.toMatchObject({
      id: saved.id,
      checkoutIntentReused: true,
    });
    expect(await count("orders")).toBe(1);
    expect(db.notifyStaffByEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects anonymous/admin identities and an invalid coupon before saving a draft", async () => {
    await expect(caller(null).orders.create(input())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller({ ...user, id: -1 }).orders.create(input())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().orders.create({ ...input(), couponCode: "MISSING" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await count("orders")).toBe(0);
    expect(await count("checkout_intents")).toBe(0);
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it("rolls back required pricing detail failure and safely retries the same request after recovery", async () => {
    await binding.exec(
      "CREATE TRIGGER fail_pricing BEFORE INSERT ON order_pricing_snapshots BEGIN SELECT RAISE(ABORT,'synthetic pricing unavailable'); END"
    );
    await expect(caller().orders.create(input())).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(await count("orders")).toBe(0);
    expect(await count("checkout_intents")).toBe(0);
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
    await binding.exec("DROP TRIGGER fail_pricing");
    await caller().orders.create(input());
    expect(await count("orders")).toBe(1);
  });

  it("keeps another customer outside the invoice projection and creates no financial/access records", async () => {
    const saved = await caller().orders.create(input());
    await expect(
      caller({ ...user, id: 8, email: "other@example.test" }).orders.byId({
        id: saved.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const table of [
      "order_payment_confirmations",
      "financial_ledger_entries",
      "registrationKeys",
      "live_package_entitlements",
    ])
      expect(await count(table)).toBe(0);
  });
});
