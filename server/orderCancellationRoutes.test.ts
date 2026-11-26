import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { orderCancellationDatabase } from "./fixtures/orderCancellationDatabase";

vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getDb: vi.fn(),
  getAdminByEmail: vi.fn(),
  hasAnyRole: vi.fn(),
  resolveFinanceActor: vi.fn(),
  getOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
  logOrderStatusHistory: vi.fn(),
  confirmOrderPayment: vi.fn(),
  createOrderActivationKeys: vi.fn(),
  deactivateUnusedOrderActivationKeys: vi.fn(),
  revokeLivePackageEntitlementForOrder: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

let database: D1Database,
  roles: string[],
  admin: boolean,
  financeAccess: "owner" | "manager" | null;
const user = {
  id: 20,
  email: "reviewer@example.test",
  name: "Reviewer",
  isStaff: true,
};
const caller = (identity: any = user) =>
  appRouter.createCaller({
    user: identity,
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/orders.adminUpdateStatus",
    },
    setCookie() {},
    clearCookie() {},
  } as any);
const payload = async () => ({
  orderId: 42,
  status: "cancelled" as const,
  reason: "Reviewed obsolete unpaid request",
  cancellationReview: {
    confirmed: true as const,
    version: (await caller().orders.adminCancellationReview({ orderId: 42 }))
      .version as {
      status: "pending";
      updatedAt: string;
      paymentProofUrl: string | null;
    },
  },
});
const history = async () =>
  (await database.prepare("SELECT * FROM order_status_history").all()).results;

describe("order cancellation route boundaries", () => {
  it("lets support review a bounded named audit after cancellation without granting cancellation authority", async () => {
    await caller().orders.adminUpdateStatus(await payload());
    roles = ["support"];
    const result = await caller().orders.adminStatusHistory({
      orderId: 42,
      viewerId: 20,
    });
    expect(result).toMatchObject({
      viewerId: 20,
      orderId: 42,
      nextCursor: null,
      entries: [
        {
          actorName: "Test reviewer",
          reason: "Reviewed obsolete unpaid request",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("ip_address");
    await expect(
      caller().orders.adminCancellationReview({ orderId: 42 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a different history viewer before touching financial/order storage", async () => {
    await expect(
      caller().orders.adminStatusHistory({ orderId: 42, viewerId: 21 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getDb).not.toHaveBeenCalled();
    await expect(
      caller(null).orders.adminStatusHistory({ orderId: 42, viewerId: 20 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    database = await orderCancellationDatabase();
    roles = ["key_manager"];
    admin = false;
    financeAccess = null;
    vi.mocked(db.getDb).mockResolvedValue({ $client: database } as any);
    vi.mocked(db.getAdminByEmail).mockImplementation(async () =>
      admin ? ({ id: 1, email: user.email } as any) : null
    );
    vi.mocked(db.hasAnyRole).mockImplementation(async (_id, wanted) =>
      wanted.some(role => roles.includes(role))
    );
    vi.mocked(db.resolveFinanceActor).mockImplementation(async () =>
      financeAccess
        ? {
            actorType: admin ? "admin" : "staff",
            actorId: admin ? 1 : 20,
            access: financeAccess,
          }
        : null
    );
    vi.mocked(db.getOrderById).mockImplementation(
      async id =>
        (await database
          .prepare("SELECT * FROM orders WHERE id=?")
          .bind(id)
          .first()) as any
    );
  });

  it.each([
    { roles: null },
    { roles: ["support"] },
    { roles: ["client_lookup"] },
    { roles: [] },
  ])(
    "denies cancellation review and actions without order-review authority: %o",
    async ({ roles: accessRoles }) => {
      if (accessRoles) roles = accessRoles;
      const who = accessRoles === null ? null : user;
      await expect(
        caller(who).orders.adminCancellationReview({ orderId: 42 })
      ).rejects.toMatchObject({
        code: accessRoles === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      await expect(
        caller(who).orders.adminUpdateStatus({
          orderId: 42,
          status: "cancelled",
        })
      ).rejects.toMatchObject({
        code: accessRoles === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(db.getDb).not.toHaveBeenCalled();
      expect(await history()).toEqual([]);
    }
  );

  it("blocks the legacy one-click cancellation path without confirmation/version/reason", async () => {
    await expect(
      caller().orders.adminUpdateStatus({ orderId: 42, status: "cancelled" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await history()).toEqual([]);
    expect(db.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("records an operational reviewer once without financial, delivery or entitlement side effects", async () => {
    const request = await payload();
    await expect(
      caller().orders.adminUpdateStatus(request)
    ).resolves.toMatchObject({
      order: { id: 42, status: "cancelled" },
      activationKeys: [],
      cancellationIdempotent: false,
    });
    await expect(
      caller().orders.adminUpdateStatus(request)
    ).resolves.toMatchObject({ cancellationIdempotent: true });
    expect(await history()).toEqual([
      expect.objectContaining({
        actor_type: "staff",
        actor_id: 20,
        reason: request.reason,
      }),
    ]);
    for (const action of [
      db.updateOrderStatus,
      db.logOrderStatusHistory,
      db.confirmOrderPayment,
      db.createOrderActivationKeys,
      db.deactivateUnusedOrderActivationKeys,
      db.revokeLivePackageEntitlementForOrder,
    ])
      expect(action).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "requires explicit finance review for a receipt even for a full admin: admin=%s",
    async isAdmin => {
      admin = isAdmin;
      await database.exec(
        "UPDATE orders SET paymentProofUrl='https://proof.example.test/preserved.pdf'"
      );
      const review = await caller().orders.adminCancellationReview({
        orderId: 42,
      });
      expect(review).toMatchObject({
        canCancel: false,
        block: "finance_review",
      });
      await expect(
        caller().orders.adminUpdateStatus(await payload())
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await history()).toEqual([]);
    }
  );

  it.each(["owner", "manager"] as const)(
    "allows a receipt-reviewed cancellation with %s authority and preserves actor identity",
    async access => {
      financeAccess = access;
      admin = access === "owner";
      roles = ["finance_manager"];
      await database.exec(
        "UPDATE orders SET paymentProofUrl='https://proof.example.test/preserved.pdf'"
      );
      const request = await payload();
      await expect(
        caller().orders.adminUpdateStatus(request)
      ).resolves.toMatchObject({ order: { status: "cancelled" } });
      expect(await history()).toEqual([
        expect.objectContaining({
          actor_type: admin ? "admin" : "staff",
          actor_id: admin ? 1 : 20,
        }),
      ]);
    }
  );

  it("blocks a newly confirmed payment after the dialog review and does not revoke access", async () => {
    const request = await payload();
    await database.exec(
      "INSERT INTO order_payment_confirmations VALUES(1,42,'2026-11-26')"
    );
    await expect(
      caller().orders.adminUpdateStatus(request)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await history()).toEqual([]);
    expect(db.deactivateUnusedOrderActivationKeys).not.toHaveBeenCalled();
  });

  it("returns safety flags without exposing issued credentials", async () => {
    await database.exec(
      "INSERT INTO registrationKeys VALUES(1,42,'PRIVATE-CREDENTIAL',1)"
    );
    const review = await caller().orders.adminCancellationReview({
      orderId: 42,
    });
    expect(review).toMatchObject({
      canCancel: false,
      block: "keys",
      facts: { keysIssued: true },
    });
    expect(JSON.stringify(review)).not.toContain("PRIVATE-CREDENTIAL");
  });
});
