import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createLocalD1Database } from "../backend/_core/localD1";
import * as schema from "../database/schema-sqlite";
import { createPaidRenewalOrder, createTradeCopierOrder, getPaidRenewalQuote } from "../backend/db";
import type { CheckoutIntent } from "../backend/services/checkout-intent.service";
import { checkoutMigration } from "./fixtures/checkoutIntentDatabase";

let binding: Awaited<ReturnType<typeof createLocalD1Database>>,
  connection: ReturnType<typeof drizzle>;
const acceptedAt = "2026-11-26T10:00:00.000Z";
const proof = {
  userId: 7,
  paymentMethod: "bank_transfer" as const,
  termsAcceptedAt: acceptedAt,
  termsAcceptedVersion: "v2",
  termsAcceptedIpAddress: "PRIVATE-IP",
  termsAcceptedUserAgent: "PRIVATE-UA",
};
const intent = (
  flow: "renewal" | "copier",
  key = `checkout:domain-${flow}`
): CheckoutIntent => ({
  userId: 7,
  flow,
  key,
  requestHash: (flow === "renewal" ? "a" : "b").repeat(64),
});
const count = async (table: string) =>
  Number(
    (await binding.prepare(`SELECT count(*) AS total FROM "${table}"`).first())
      ?.total
  );

describe("checkout domain adapters with real quotes and atomic details", () => {
  it("rejects changed renewal quotes and Copier offers without persisting a request; saved intents still resume", async () => {
    const quote = await getPaidRenewalQuote(7,connection);
    const expectedQuote = {packageId:quote.packageId,amountIlsMinor:quote.amountIlsMinor,entitlementDays:quote.entitlementDays,recommendationsCurrentEndAt:quote.recommendationsCurrentEndAt,lexaiCurrentEndAt:quote.lexaiCurrentEndAt};
    await expect(createPaidRenewalOrder({...proof,checkoutIntent:intent('renewal'),expectedQuote:{...expectedQuote,amountIlsMinor:quote.amountIlsMinor+1}},connection)).rejects.toMatchObject({code:'CONFLICT'});
    await expect(createTradeCopierOrder({...proof,checkoutIntent:intent('copier'),expectedOffer:{amountIlsMinor:1,accessDays:365}},connection)).rejects.toMatchObject({code:'CONFLICT'});
    expect(await count('orders')).toBe(0);
    const first = await createPaidRenewalOrder({...proof,checkoutIntent:intent('renewal'),expectedQuote},connection);
    const retry = await createPaidRenewalOrder({...proof,checkoutIntent:intent('renewal'),expectedQuote:{...expectedQuote,entitlementDays:1}},connection);
    expect(retry.order.id).toBe(first.order.id);
    expect(retry.idempotent).toBe(true);
  });
  beforeEach(async () => {
    binding = await createLocalD1Database(":memory:");
    // Use current column names/types so real Drizzle reads exercise the adapter,
    // while the published migrations supply its behavior/uniqueness guards.
    for (const table of [
      schema.orders,
      schema.orderItems,
      schema.orderRenewalDetails,
      schema.tradeCopierSubscriptions,
      schema.packages,
      schema.packageSubscriptions,
      schema.recommendationSubscriptions,
      schema.lexaiSubscriptions,
      schema.orderPaymentConfirmations,
      schema.financialLedgerEntries,
      schema.registrationKeys,
    ]) {
      const columns = Object.values(getTableColumns(table));
      await binding.exec(
        `CREATE TABLE "${getTableName(table)}"(${columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}${column.isUnique ? " UNIQUE" : ""}`).join(",")})`
      );
    }
    await binding.exec(
      "CREATE TABLE schema_migrations(migration_name TEXT PRIMARY KEY,source TEXT,notes TEXT)"
    );
    await binding.exec(
      readFileSync(
        new URL(
          "../database/migrations/129_trade_copier_service.sql",
          import.meta.url
        ),
        "utf8"
      )
    );
    const renewalMigration = readFileSync(
      new URL(
        "../database/migrations/114_financial_transaction_purpose_and_legacy_migration.sql",
        import.meta.url
      ),
      "utf8"
    );
    const uniqueRenewal = renewalMigration.match(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_open_renewal_per_user[\s\S]*?;/
    )?.[0];
    if (!uniqueRenewal) throw Error("Published renewal guard missing");
    await binding.exec(uniqueRenewal);
    await binding.exec(checkoutMigration);
    await binding.exec(`INSERT INTO packages(id,slug,packageType,nameEn,nameAr,isPublished,price,currency,renewalPeriodDays,includesRecommendations,includesLexai,durationDays)
    VALUES(1,'basic','standard','Basic','الأساسية',1,20000,'USD',30,1,1,30);
    INSERT INTO packageSubscriptions(id,userId,packageId,isActive,createdAt)VALUES(1,7,1,1,'2026-11-20');
    INSERT INTO recommendationSubscriptions(id,userId,isActive,endDate)VALUES(1,7,1,'2099-01-01T00:00:00.000Z');
    INSERT INTO lexaiSubscriptions(id,userId,isActive,endDate)VALUES(1,7,1,'2099-01-01T00:00:00.000Z');`);
    connection = drizzle(binding);
  });

  it("saves one quoted renewal with its immutable projection and original legal proof", async () => {
    const request = { ...proof, checkoutIntent: intent("renewal") };
    const first = await createPaidRenewalOrder(request, connection);
    expect(first.order).toMatchObject({
      userId: 7,
      totalAmount: 17500,
      transactionPurpose: "renewal",
      status: "pending",
      termsAcceptedAt: acceptedAt,
      termsAcceptedIpAddress: "PRIVATE-IP",
    });
    expect(first.detail).toMatchObject({
      orderId: first.order.id,
      entitlementDays: 30,
      amountIlsMinor: 17500,
      recommendationsCurrentEndAt: "2099-01-01T00:00:00.000Z",
      recommendationsProjectedEndAt: "2099-01-31T00:00:00.000Z",
    });
    await binding.exec(
      "UPDATE orders SET status='completed';UPDATE packageSubscriptions SET isActive=0"
    );
    const retry = await createPaidRenewalOrder(
      { ...request, termsAcceptedAt: "2099-03-01" },
      connection
    );
    expect(retry.order.id).toBe(first.order.id);
    expect(retry.idempotent).toBe(true);
    expect(retry.order.termsAcceptedAt).toBe(acceptedAt);
    expect(await count("orders")).toBe(1);
    expect(await count("orderItems")).toBe(1);
    expect(await count("order_renewal_details")).toBe(1);
  });

  it.each(["renewal", "copier"] as const)(
    "coalesces different-intent concurrent %s requests using existing open-request rules without orphan orders",
    async flow => {
      const create =
        flow === "renewal" ? createPaidRenewalOrder : createTradeCopierOrder;
      const results = await Promise.all([
        create(
          { ...proof, checkoutIntent: intent(flow, "checkout:domain-first") },
          connection
        ),
        create(
          { ...proof, checkoutIntent: intent(flow, "checkout:domain-second") },
          connection
        ),
      ]);
      expect(new Set(results.map(result => result.order.id)).size).toBe(1);
      expect(await count("orders")).toBe(1);
      expect(await count("orderItems")).toBe(1);
      expect(
        await count(
          flow === "renewal"
            ? "order_renewal_details"
            : "trade_copier_subscriptions"
        )
      ).toBe(1);
    }
  );

  it("resumes a closed Copier intent rather than creating a later subscription on a retry", async () => {
    const request = { ...proof, checkoutIntent: intent("copier") },
      first = await createTradeCopierOrder(request, connection);
    expect(first.subscription).toMatchObject({
      orderId: first.order.id,
      userId: 7,
      status: "pending_payment",
      accessDays: 365,
    });
    await binding.exec(
      "UPDATE trade_copier_subscriptions SET status='expired';UPDATE orders SET status='completed'"
    );
    const retry = await createTradeCopierOrder(request, connection);
    expect(retry.order.id).toBe(first.order.id);
    expect(retry.idempotent).toBe(true);
    expect(await count("orders")).toBe(1);
    const fresh = await createTradeCopierOrder(
      {
        ...request,
        checkoutIntent: intent("copier", "new:separate-copier-purchase"),
      },
      connection
    );
    expect(fresh.order.id).not.toBe(first.order.id);
    expect(await count("orders")).toBe(2);
  });

  it.each([
    ["renewal", "order_renewal_details"],
    ["copier", "trade_copier_subscriptions"],
  ] as const)(
    "does not leave a saved order if real %s detail persistence fails",
    async (flow, table) => {
      await binding.exec(
        `CREATE TRIGGER fail_adapter BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'required detail unavailable'); END`
      );
      const create =
        flow === "renewal" ? createPaidRenewalOrder : createTradeCopierOrder;
      await expect(
        create({ ...proof, checkoutIntent: intent(flow) }, connection)
      ).rejects.toThrow("required detail unavailable");
      expect(await count("orders")).toBe(0);
      expect(await count("orderItems")).toBe(0);
      expect(await count("checkout_intents")).toBe(0);
    }
  );

  it("never recognizes cash, issues a key or changes the existing timed-service ends", async () => {
    await createPaidRenewalOrder(
      { ...proof, checkoutIntent: intent("renewal") },
      connection
    );
    await createTradeCopierOrder(
      { ...proof, checkoutIntent: intent("copier") },
      connection
    );
    for (const table of [
      "financial_ledger_entries",
      "order_payment_confirmations",
      "registrationKeys",
    ])
      expect(await count(table)).toBe(0);
    expect(
      (
        await binding
          .prepare("SELECT endDate FROM recommendationSubscriptions")
          .first()
      )?.endDate
    ).toBe("2099-01-01T00:00:00.000Z");
    expect(
      (await binding.prepare("SELECT endDate FROM lexaiSubscriptions").first())
        ?.endDate
    ).toBe("2099-01-01T00:00:00.000Z");
  });
  it("rejects a key reused for another workflow instead of creating an unrelated order", async () => {
    const renewalIntent = intent("renewal");
    await createPaidRenewalOrder(
      { ...proof, checkoutIntent: renewalIntent },
      connection
    );
    await expect(
      createTradeCopierOrder(
        { ...proof, checkoutIntent: intent("copier", renewalIntent.key) },
        connection
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await count("orders")).toBe(1);
    expect(await count("trade_copier_subscriptions")).toBe(0);
  });
});
