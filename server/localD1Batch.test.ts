import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createLocalD1Database } from "../backend/_core/localD1";

const temporaryDirectories: string[] = [];
const batchItems = sqliteTable("batch_items", {
  id: integer("id").primaryKey(),
  label: text("label").notNull().unique(),
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local D1 batch parity", () => {
  it("rolls back every statement when one batched statement fails", async () => {
    const directory = mkdtempSync(join(tmpdir(), "xflex-local-d1-batch-"));
    temporaryDirectories.push(directory);
    const filename = join(directory, "test.db");
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const seedDatabase = new Database(filename);
    seedDatabase.exec("CREATE TABLE batch_items (id INTEGER PRIMARY KEY, label TEXT NOT NULL UNIQUE)");
    seedDatabase.close();

    const database = await createLocalD1Database(filename);
    try {
      const orm = drizzle(database);
      await expect(orm.batch([
        orm.insert(batchItems).values({ id: 1, label: "first" }).returning(),
        orm.insert(batchItems).values({ id: 2, label: "first" }).returning(),
      ])).rejects.toThrow();

      const total = await database.prepare("SELECT COUNT(*) AS total FROM batch_items").first<number>("total");
      expect(total).toBe(0);
      const [insertedRows] = await orm.batch([
        orm.insert(batchItems).values({ id: 3, label: "committed" }).returning(),
      ]);
      expect(insertedRows).toEqual([{ id: 3, label: "committed" }]);
    } finally {
      (database as any).close();
    }
  });
});
