import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Sqlite from "better-sqlite3";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import {
  orders,
  users,
  courses,
  enrollments,
  registrationKeys,
} from "../database/schema-sqlite";
import { createLocalD1Database } from "../backend/_core/localD1";
import { getDb, getAllOrders, getDashboardStats, getRelatedCompletedOrdersForReview } from "../backend/db";

let raw: Sqlite.Database;
let local: Awaited<ReturnType<typeof createLocalD1Database>>;
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "xflex-order-review-"));
  const file = join(dir, "fixture.db");
  raw = new Sqlite(file);
  // Use the current schema's actual column names/types for read-only query tests.
  // No migrations, external database, customer data or payment workflow is used.
  for (const table of [orders, users, courses, enrollments, registrationKeys]) {
    const config = getTableConfig(table);
    raw.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`).join(",")})`
    );
  }
  raw.exec("CREATE TABLE order_retirements(order_id INTEGER PRIMARY KEY)");
  raw.exec("CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT)");
  raw.exec(readFileSync("database/migrations/138_order_review_lookup.sql", "utf8"));
  raw.exec(
    "INSERT INTO users(id,email,name) VALUES (1,'synthetic@example.test','Synthetic customer')"
  );
  const seed = raw.prepare(
    "INSERT INTO orders(id,userId,status,createdAt,totalAmount,currency) VALUES (?,1,?,'2026-11-25T12:00:00Z',10000,'ILS')"
  );
  for (const [id, status] of [
    [1, "pending"],
    [2, "awaiting_confirmation"],
    [3, "paid"],
    [4, "completed"],
    [5, "cancelled"],
    [6, "refunded"],
    [7, "pending"],
    [8, "awaiting_confirmation"],
  ] as const)
    seed.run(id, status);
  raw.exec("INSERT INTO order_retirements VALUES(7),(8)");
  local = await createLocalD1Database(file);
  await getDb({ DB: local as any });
});
afterAll(() => {
  local?.close();
  raw?.close();
  if (dir) {
    const target = realpathSync(dir);
    if (
      dirname(target) !== realpathSync(tmpdir()) ||
      !basename(target).startsWith("xflex-order-review-")
    )
      throw Error("Unexpected fixture path");
    rmSync(target, { recursive: true, force: true });
  }
});
describe("outstanding order read eligibility", () => {
  it("matches the home counter to both unresolved statuses and excludes retired orders", async () => {
    const list = await getAllOrders("outstanding");
    const stats = await getDashboardStats();
    expect(list.map(order => order.id).sort()).toEqual([1, 2]);
    expect(stats.pendingOrders).toBe(list.length);
    expect(list[0].userEmail).toBe("synthetic@example.test");
  });
  it("preserves exact-status and all-order history without changing stored records", async () => {
    expect((await getAllOrders("pending")).map(order => order.id)).toEqual([1]);
    expect(
      (await getAllOrders("awaiting_confirmation")).map(order => order.id)
    ).toEqual([2]);
    expect((await getAllOrders("cancelled")).map(order => order.id)).toEqual([
      5,
    ]);
    expect((await getAllOrders()).map(order => order.id).sort()).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(raw.prepare("SELECT count(*) AS total FROM orders").get()).toEqual({
      total: 8,
    });
    expect(raw.prepare("SELECT status FROM orders WHERE id=7").get()).toEqual({
      status: "pending",
    });
  });

  it("bounds purchaser context, excludes the source and retired orders, and uses the added index", async () => {
    const seed = raw.prepare("INSERT INTO orders(id,userId,status,createdAt) VALUES (?,?,'completed','2026-11-23 12:00:00')");
    for (let id=100;id<125;id++) seed.run(id,1);
    seed.run(125,2);
    raw.exec("INSERT INTO order_retirements VALUES(124)");
    const result = await getRelatedCompletedOrdersForReview(123);
    expect(result?.hasMore).toBe(true);
    expect(result?.orders).toHaveLength(20);
    expect(result?.orders[0].id).toBe(122);
    expect(result?.orders.some(order => [123,124,125].includes(order.id))).toBe(false);
    expect(await getRelatedCompletedOrdersForReview(999)).toBeNull();
    const plan = raw.prepare("EXPLAIN QUERY PLAN SELECT id FROM orders WHERE userId=? AND status=? AND id<>? ORDER BY id DESC LIMIT 21").all(1,'completed',123);
    expect(JSON.stringify(plan)).toContain("USING COVERING INDEX idx_orders_user_status_id");
    expect(JSON.stringify(plan)).not.toContain("TEMP B-TREE");
    // Reapplying the additive migration is safe and does not alter orders.
    raw.exec(readFileSync("database/migrations/138_order_review_lookup.sql", "utf8"));
    expect(raw.prepare("SELECT count(*) AS total FROM orders").get()).toEqual({total:34});
  });
});
