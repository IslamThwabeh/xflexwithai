import { beforeEach, describe, expect, it } from "vitest";
import {
  orderCancellationDatabase,
  migration,
  originalTime,
} from "./fixtures/orderCancellationDatabase";
import {
  cancelReviewedUnpaidOrder,
  readOrderCancellationReview,
  ORDER_CANCELLATION_REVIEW_SQL,
  readOrderStatusHistory,
  orderStatusHistorySql,
} from "../backend/services/order-cancellation.service";
import type { D1Database } from "@cloudflare/workers-types";

const operational = { operational: true, financeReview: false };
const finance = { operational: false, financeReview: true };
let database: D1Database;
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "orders",
    "order_status_history",
    "order_payment_confirmations",
    "registrationKeys",
    "financial_ledger_entries",
    "live_package_entitlements",
    "packageSubscriptions",
    "trade_copier_subscriptions",
    "order_retirements",
  ])
    result[table] = (
      await database.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
    ).results;
  return result;
}
async function input(authority = operational) {
  const review = await readOrderCancellationReview(database, 42, authority);
  return {
    orderId: 42,
    reason: "Reviewed unpaid duplicate request",
    confirmed: true as const,
    version: review.version,
    actorType: "staff" as const,
    actorId: 20,
    authority,
    ipAddress: "127.0.0.1",
  };
}

describe("audited unpaid order cancellation", () => {
  it("pages status history by indexed ID with names and without private request data", async () => {
    for (let id = 1; id <= 12; id++)
      await database
        .prepare(
          `INSERT INTO order_status_history
      (id,order_id,user_id,previous_status,new_status,actor_type,actor_id,reason,ip_address,created_at)
      VALUES(?,42,7,'pending','cancelled',?,?,?,'PRIVATE-IP','2026-11-26T08:00:00Z')`
        )
        .bind(
          id,
          id % 2 ? "staff" : "admin",
          id % 2 ? 20 : 1,
          "Review reason " + id
        )
        .run();
    const first = await readOrderStatusHistory(database, 42);
    expect(first.entries.map(entry => entry.id)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);
    expect(first.nextCursor).toBe(3);
    expect(first.entries[0].actorName).toBe("Test finance owner");
    expect(first.entries[1].actorName).toBe("Test reviewer");
    expect(JSON.stringify(first)).not.toContain("PRIVATE-IP");
    const second = await readOrderStatusHistory(
      database,
      42,
      first.nextCursor!
    );
    expect(second.entries.map(entry => entry.id)).toEqual([2, 1]);
    expect(second.nextCursor).toBeNull();
    const plan = (
      await database
        .prepare("EXPLAIN QUERY PLAN " + orderStatusHistorySql(3))
        .bind(42, 3)
        .all()
    ).results
      .map(row => String(row.detail))
      .join("\n");
    expect(plan).toContain("idx_order_status_history_order_id");
    expect(plan).not.toMatch(/SCAN |TEMP B-TREE/);
  });

  it("distinguishes an empty audit history from a missing order", async () => {
    await expect(readOrderStatusHistory(database, 42)).resolves.toEqual({
      orderId: 42,
      entries: [],
      nextCursor: null,
    });
    await expect(readOrderStatusHistory(database, 999)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  beforeEach(async () => {
    database = await orderCancellationDatabase();
  });

  it("changes only status/update time and appends the actor/reason atomically; retry is a no-op", async () => {
    const before = await snapshot(),
      request = await input();
    await expect(cancelReviewedUnpaidOrder(database, request)).resolves.toEqual(
      { orderId: 42, idempotent: false }
    );
    const after = await snapshot();
    const row = (after.orders as any[])[0];
    expect({ ...row, status: "pending", updatedAt: originalTime }).toEqual(
      (before.orders as any[])[0]
    );
    expect(after.order_status_history).toEqual([
      expect.objectContaining({
        order_id: 42,
        user_id: 7,
        previous_status: "pending",
        new_status: "cancelled",
        actor_type: "staff",
        actor_id: 20,
        reason: request.reason,
        ip_address: "127.0.0.1",
      }),
    ]);
    for (const table of Object.keys(before).filter(
      name => !["orders", "order_status_history"].includes(name)
    ))
      expect(after[table]).toEqual(before[table]);
    await expect(cancelReviewedUnpaidOrder(database, request)).resolves.toEqual(
      { orderId: 42, idempotent: true }
    );
    expect(await snapshot()).toEqual(after);
  });

  it("requires finance review for attached evidence and preserves that evidence on cancellation", async () => {
    await database.exec(
      "UPDATE orders SET status='awaiting_confirmation',paymentProofUrl='https://proof.example.test/receipt.pdf'"
    );
    expect(
      (await readOrderCancellationReview(database, 42, operational)).block
    ).toBe("finance_review");
    const before = await snapshot();
    await expect(
      cancelReviewedUnpaidOrder(database, await input())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await snapshot()).toEqual(before);
    await expect(
      cancelReviewedUnpaidOrder(database, await input(finance))
    ).resolves.toMatchObject({ idempotent: false });
    expect(
      (
        await database
          .prepare("SELECT paymentProofUrl FROM orders WHERE id=42")
          .first()
      )?.paymentProofUrl
    ).toBe("https://proof.example.test/receipt.pdf");
  });

  it("does not grant finance-only actors unrelated cancellation powers for receipt-free requests", async () => {
    await expect(
      cancelReviewedUnpaidOrder(database, await input(finance))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  const linkedCases = [
    [
      "INSERT INTO order_payment_confirmations VALUES(1,42,'2026-11-25')",
      "payment",
    ],
    [
      "INSERT INTO registrationKeys VALUES(1,42,'secret credential retained',0)",
      "keys",
    ],
    [
      "INSERT INTO financial_ledger_entries VALUES(1,42,70000)",
      "financial_history",
    ],
    ["INSERT INTO live_package_entitlements VALUES(1,42,0)", "access_history"],
    ["INSERT INTO packageSubscriptions VALUES(1,42,0)", "access_history"],
    [
      "INSERT INTO trade_copier_subscriptions VALUES(1,42,'pending_payment')",
      "access_history",
    ],
    [
      "INSERT INTO order_retirements(order_id,reason) VALUES(42,'Existing documented replacement')",
      "retired",
    ],
  ] as const;
  it.each(linkedCases)(
    "blocks and preserves linked records: %s",
    async (sql, block) => {
      await database.exec(sql);
      const before = await snapshot();
      expect(
        (
          await readOrderCancellationReview(database, 42, {
            operational: true,
            financeReview: true,
          })
        ).block
      ).toBe(block);
      await expect(
        cancelReviewedUnpaidOrder(
          database,
          await input({ operational: true, financeReview: true })
        )
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await snapshot()).toEqual(before);
    }
  );

  it.each(["paid", "completed", "refunded", "cancelled"])(
    "blocks ordinary cancellation of %s orders",
    async status => {
      await database.prepare("UPDATE orders SET status=?").bind(status).run();
      const before = await snapshot();
      await expect(
        cancelReviewedUnpaidOrder(database, await input())
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await snapshot()).toEqual(before);
    }
  );

  it.each(["", "abcd"])(
    "requires a meaningful reason before changing anything: %s",
    async reason => {
      const request = await input(),
        before = await snapshot();
      await expect(
        cancelReviewedUnpaidOrder(database, { ...request, reason })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await snapshot()).toEqual(before);
    }
  );

  it("rejects a receipt that changed after the reviewer opened the dialog", async () => {
    const request = await input({ operational: true, financeReview: true });
    await database.exec(
      "UPDATE orders SET paymentProofUrl='https://proof.example.test/new.pdf'"
    );
    const before = await snapshot();
    await expect(
      cancelReviewedUnpaidOrder(database, request)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot()).toEqual(before);
  });

  it.each(linkedCases)(
    "rechecks linked records inside the write batch after preflight: %s",
    async sql => {
      const request = await input();
      const racing = Object.create(database) as D1Database;
      racing.batch = async statements => {
        await database.exec(sql);
        return database.batch(statements);
      };
      await expect(
        cancelReviewedUnpaidOrder(racing, request)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await database
            .prepare("SELECT status FROM orders WHERE id=42")
            .first()
        )?.status
      ).toBe("pending");
      expect(
        (await database.prepare("SELECT * FROM order_status_history").all())
          .results
      ).toEqual([]);
    }
  );

  it("rolls back the status change when the audit append fails", async () => {
    const request = await input(),
      before = await snapshot();
    await database.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON order_status_history BEGIN SELECT RAISE(ABORT,'audit unavailable'); END"
    );
    await expect(cancelReviewedUnpaidOrder(database, request)).rejects.toThrow(
      "audit unavailable"
    );
    expect(await snapshot()).toEqual(before);
  });

  it("uses lookup indexes for every related table and records migration139 only once", async () => {
    const before = await snapshot();
    await database.exec(migration);
    expect(await snapshot()).toEqual(before);
    const plan = (
      await database
        .prepare("EXPLAIN QUERY PLAN " + ORDER_CANCELLATION_REVIEW_SQL)
        .bind(42)
        .all()
    ).results
      .map(row => String(row.detail))
      .join("\n");
    expect(plan).not.toMatch(/SCAN /);
    for (const name of [
      "idx_registration_keys_order_guard",
      "idx_financial_ledger_order_guard",
      "idx_live_entitlements_order_guard",
      "idx_package_subscriptions_order_guard",
    ])
      expect(plan).toContain(name);
    expect(
      (
        await database
          .prepare("SELECT count(*) AS count FROM schema_migrations")
          .first()
      )?.count
    ).toBe(1);
  });
});
