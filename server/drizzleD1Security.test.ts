import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import Database from "better-sqlite3";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { integer, SQLiteSyncDialect, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createLocalD1Database } from "../backend/_core/localD1";

const fixturePrefix = "xflex-drizzle-security-";
const fixtures: Array<{ directory: string; database?: { close(): void } }> = [];
const ledger = sqliteTable("testLedger", {
  id: integer("id").primaryKey(),
  accountId: integer("accountId").notNull(),
  paymentKey: text("paymentKey").notNull().unique(),
  amountMinor: integer("amountMinor").notNull(),
  refundedMinor: integer("refundedMinor").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
  note: text("note"),
});

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    try {
      fixture.database?.close();
    } finally {
      // Only remove the unique directory this test created directly under TEMP.
      const resolved = realpathSync(fixture.directory);
      if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith(fixturePrefix)) {
        throw new Error("Refusing to clean up an unexpected fixture path");
      }
      rmSync(resolved, { recursive: true, force: true });
    }
  }
});

async function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), fixturePrefix));
  const fixture: (typeof fixtures)[number] = { directory };
  fixtures.push(fixture);
  const filename = join(directory, "test.db");
  const seed = new Database(filename);
  seed.close();
  const database = await createLocalD1Database(filename);
  fixture.database = database as unknown as { close(): void };
  // Fixture tables only: production schemas and migrations are never invoked.
  await database.exec(`CREATE TABLE testLedger (
    id INTEGER PRIMARY KEY, accountId INTEGER NOT NULL, paymentKey TEXT NOT NULL UNIQUE,
    amountMinor INTEGER NOT NULL, refundedMinor INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL DEFAULT (datetime('now')), note TEXT
  )`);
  return { database, orm: drizzle(database) };
}

describe("Drizzle SQLite identifier security", () => {
  it("keeps an embedded quote inside a single SQL identifier", () => {
    const query = new SQLiteSyncDialect().sqlToQuery(sql`select ${sql.identifier('report"column')}`);
    expect(query.sql).toBe('select "report""column"');
    expect(query.params).toEqual([]);
  });

  it("escapes a quoted report alias while preserving result mapping", async () => {
    const { orm } = await createFixture();
    await orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000 }).run();
    const query = orm.select({ net: sql<number>`${ledger.amountMinor} - ${ledger.refundedMinor}`.as('net"ils') }).from(ledger);
    expect(query.toSQL().sql).toContain('as "net""ils"');
    expect(await query.all()).toEqual([{ net: 20_000 }]);
  });

  it("reads and writes quoted table and column names as literal identifiers", async () => {
    const { database, orm } = await createFixture();
    await database.exec('CREATE TABLE "audit""ledger" ("id" INTEGER PRIMARY KEY, "value""ils" INTEGER NOT NULL)');
    const quoted = sqliteTable('audit"ledger', {
      id: integer("id").primaryKey(),
      value: integer('value"ils').notNull(),
    });
    await orm.insert(quoted).values({ id: 1, value: 12_345 }).run();
    expect(await orm.select().from(quoted).all()).toEqual([{ id: 1, value: 12_345 }]);
  });
});

describe("D1 query compatibility on disposable SQLite fixtures", () => {
  it("binds punctuation-heavy customer text as a value rather than SQL", async () => {
    const { orm } = await createFixture();
    const note = "Customer's note: \"quoted\"; -- تعليق تجريبي";
    const statement = orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000, note });
    expect(statement.toSQL().params).toContain(note);
    expect(statement.toSQL().sql).not.toContain(note);
    await statement.run();
    expect(await orm.select({ id: ledger.id, note: ledger.note }).from(ledger).where(eq(ledger.note, note)).all()).toEqual([{ id: 1, note }]);
  });

  it("preserves nullable fields, boolean mapping and SQLite defaults", async () => {
    const { orm } = await createFixture();
    await orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000 }).run();
    const row = await orm.select().from(ledger).get();
    expect(row).toMatchObject({ active: true, refundedMinor: 0, note: null, amountMinor: 20_000 });
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it("preserves scoped updates, affected-row counts and boolean/null results", async () => {
    const { orm } = await createFixture();
    await orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000, note: "test" }).run();
    const updated = await orm.update(ledger).set({ active: false, note: null }).where(and(eq(ledger.id, 1), eq(ledger.accountId, 101))).run();
    expect(updated.meta.changes).toBe(1);
    const noMatch = await orm.update(ledger).set({ amountMinor: 0 }).where(and(eq(ledger.id, 1), eq(ledger.accountId, 202))).run();
    expect(noMatch.meta.changes).toBe(0);
    expect(await orm.select().from(ledger).get()).toMatchObject({ active: false, note: null, amountMinor: 20_000 });
  });

  it("preserves grouped integer-money totals and account isolation", async () => {
    const { orm } = await createFixture();
    await orm.insert(ledger).values([
      { id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000, refundedMinor: 5_000 },
      { id: 2, accountId: 101, paymentKey: "two", amountMinor: 10_000 },
      { id: 3, accountId: 202, paymentKey: "three", amountMinor: 1_000 },
    ]).run();
    const totals = await orm.select({
      accountId: ledger.accountId,
      net: sql<number>`sum(${ledger.amountMinor} - ${ledger.refundedMinor})`.mapWith(Number),
    }).from(ledger).groupBy(ledger.accountId).orderBy(ledger.accountId).all();
    expect(totals).toEqual([{ accountId: 101, net: 25_000 }, { accountId: 202, net: 1_000 }]);
  });

  it("preserves ordered D1 batch writes without a RETURNING clause", async () => {
    const { orm } = await createFixture();
    const results = await orm.batch([
      orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000 }),
      orm.update(ledger).set({ refundedMinor: 5_000 }).where(eq(ledger.id, 1)),
    ]);
    expect(results.map((result) => result.meta.changes)).toEqual([1, 1]);
    expect(await orm.select().from(ledger).get()).toMatchObject({ amountMinor: 20_000, refundedMinor: 5_000 });
  });

  it("preserves unique-key conflict handling without duplicating a payment row", async () => {
    const { orm } = await createFixture();
    await orm.insert(ledger).values({ id: 1, accountId: 101, paymentKey: "one", amountMinor: 20_000 }).run();
    const duplicate = await orm.insert(ledger).values({ id: 2, accountId: 101, paymentKey: "one", amountMinor: 20_000 }).onConflictDoNothing().run();
    expect(duplicate.meta.changes).toBe(0);
    expect(await orm.select({ id: ledger.id }).from(ledger).all()).toEqual([{ id: 1 }]);
  });
});
