import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { orders, users } from "../database/schema-sqlite";
import { readFileSync } from "node:fs";
import { readAdminOrderPage } from "../backend/services/admin-order-page.service";
let raw: Database.Database,
  client: any,
  reads: { sql: string; bindings: any[] }[];
beforeEach(() => {
  raw = new Database(":memory:");
  for (const table of [orders, users]) {
    const config = getTableConfig(table);
    raw.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`).join(",")})`
    );
  }
  raw.exec(
    "CREATE TABLE order_retirements(order_id INTEGER PRIMARY KEY);CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT)"
  );
  const migration = readFileSync(
    "database/migrations/143_admin_order_pages.sql",
    "utf8"
  );
  raw.exec(migration);
  raw.exec(migration);
  raw.exec(
    "INSERT INTO users(id,email,name,phone) VALUES(1,'synthetic@example.invalid','100%_\\Customer','+970000'),(2,'second@example.invalid','Other customer','+970001')"
  );
  const insert = raw.prepare(
    "INSERT INTO orders(id,userId,status,createdAt,totalAmount,currency) VALUES(?,?,?,?,10000,?)"
  );
  for (let id = 1; id <= 75; id++)
    insert.run(
      id,
      id % 2 ? 1 : 2,
      id % 3 === 0
        ? "completed"
        : id % 3 === 1
          ? "pending"
          : "awaiting_confirmation",
      id % 2 ? "2026-11-27 10:00:00" : "2026-11-27T10:00:00Z",
      "ILS"
    );
  raw.exec("INSERT INTO order_retirements VALUES(75)");
  reads = [];
  const prepare = (sql: string, bindings: any[] = []) => ({
    bind: (...next: any[]) => prepare(sql, next),
    first: async () => {
      reads.push({ sql, bindings });
      const stmt = raw.prepare(sql);
      expect(stmt.readonly).toBe(true);
      return stmt.get(...bindings);
    },
    all: async () => {
      reads.push({ sql, bindings });
      const stmt = raw.prepare(sql);
      expect(stmt.readonly).toBe(true);
      return { success: true, results: stmt.all(...bindings) };
    },
  });
  client = { prepare };
});
afterEach(() => raw.close());
const base = { search: "", page: 1, pageSize: 10 };
describe("bounded admin order SQL", () => {
  it("traverses every non-retired order exactly once in stable newest-number order with page-only contact projection", async () => {
    const ids: number[] = [];
    for (let page = 1; page <= 8; page++) {
      const result = await readAdminOrderPage(client, { ...base, page });
      expect(result.total).toBe(74);
      expect(result.items.length).toBeLessThanOrEqual(10);
      ids.push(...result.items.map(row => row.id));
    }
    expect(ids).toEqual(Array.from({ length: 74 }, (_, i) => 74 - i));
    expect(reads).toHaveLength(16);
    expect(reads.map(row => row.sql).join("\n")).not.toMatch(
      /passwordHash|SELECT \*/
    );
  });
  it("uses the same outstanding statuses, clamps stale pages and retains exact-ID history", async () => {
    const result = await readAdminOrderPage(client, {
      ...base,
      status: "outstanding",
      page: 999,
    });
    expect(result.total).toBe(50);
    expect(result.page).toBe(5);
    expect(
      result.items.every(row =>
        ["pending", "awaiting_confirmation"].includes(row.status)
      )
    ).toBe(true);
    expect(
      (await readAdminOrderPage(client, { ...base, search: "#3" })).items.map(
        row => row.id
      )
    ).toEqual([3]);
    expect(
      (await readAdminOrderPage(client, { ...base, search: "#75" })).total
    ).toBe(0);
    expect(
      (
        await readAdminOrderPage(client, {
          ...base,
          search: "#99999999999999999999",
        })
      ).total
    ).toBe(0);
  });
  it("searches literal wildcards and recipient/customer identity across pages without SQL broadening", async () => {
    raw.exec(
      "UPDATE orders SET giftEmail='recipient@example.invalid' WHERE id=3"
    );
    for (const search of ["100%", "%_", "\\Customer"]) {
      const result = await readAdminOrderPage(client, { ...base, search });
      expect(result.total).toBe(37);
      expect(result.items.every(row => row.userId === 1)).toBe(true);
    }
    expect(
      (
        await readAdminOrderPage(client, { ...base, search: "recipient@" })
      ).items.map(row => row.id)
    ).toEqual([3]);
    expect(
      (await readAdminOrderPage(client, { ...base, search: "' OR 1=1 --" }))
        .total
    ).toBe(0);
  });
  it("uses the actual new status index and primary-key source lookup with idempotent schema bookkeeping", async () => {
    await readAdminOrderPage(client, { ...base, status: "pending" });
    const query = reads.at(-1)!;
    const plan = JSON.stringify(
      raw.prepare("EXPLAIN QUERY PLAN " + query.sql).all(...query.bindings)
    );
    expect(plan).toContain("idx_orders_status_id");
    await readAdminOrderPage(client, { ...base, search: "3" });
    const exact = reads.at(-1)!;
    expect(
      JSON.stringify(
        raw.prepare("EXPLAIN QUERY PLAN " + exact.sql).all(...exact.bindings)
      )
    ).toContain("INTEGER PRIMARY KEY");
    expect(
      raw.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
    ).toEqual({ count: 1 });
  });
});
