import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  errorChainMatches,
  getDatabaseErrorDiagnostic,
  getErrorChain,
  getErrorChainMessages,
  isDatabasePersistenceError,
  isSqliteUniqueConstraintError,
} from "../backend/_core/databaseErrors";
import { logger } from "../backend/_core/logger";
import { createLocalD1Database } from "../backend/_core/localD1";
import { publicProcedure, router } from "../backend/_core/trpc";

const temporaryDirectories: string[] = [];
const uniqueItems = sqliteTable("unique_items", {
  id: integer("id").primaryKey(),
  label: text("label").notNull().unique(),
});
const triggerItems = sqliteTable("trigger_items", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function nestedError(message: string, code = "SQLITE_CONSTRAINT") {
  const cause = Object.assign(new Error(message), { code, name: "SqliteError" });
  return new Error("Failed query: insert into private_table values (?)\nparams: secret", {
    cause,
  });
}

describe("database error cause-chain handling", () => {
  it("walks nested and cyclic causes safely", () => {
    const inner = nestedError("UNIQUE constraint failed: records.scope");
    const outer = new Error("outer", { cause: inner });
    Object.defineProperty((inner as Error).cause as object, "cause", {
      value: outer,
      configurable: true,
    });

    expect(getErrorChain(outer)).toHaveLength(3);
    expect(getErrorChainMessages(outer)).toEqual([
      "outer",
      "Failed query: insert into private_table values (?)\nparams: secret",
      "UNIQUE constraint failed: records.scope",
    ]);
    expect(isSqliteUniqueConstraintError(outer)).toBe(true);
  });

  it("recognizes nested trigger markers without misclassifying them as unique", () => {
    const error = nestedError("loyalty_reward_insufficient_points", "SQLITE_CONSTRAINT_TRIGGER");

    expect(errorChainMatches(error, "loyalty_reward_insufficient_points")).toBe(true);
    expect(isDatabasePersistenceError(error)).toBe(true);
    expect(isSqliteUniqueConstraintError(error)).toBe(false);
  });

  it("keeps SQL and params out of server-safe diagnostics", () => {
    const diagnostic = JSON.stringify(getDatabaseErrorDiagnostic(
      nestedError("UNIQUE constraint failed: private_table.secret"),
    ));

    expect(diagnostic).not.toContain("private_table");
    expect(diagnostic).not.toContain("secret");
    expect(diagnostic).not.toContain("params");
    expect(diagnostic).toContain("SQLITE_CONSTRAINT");
  });

  it("sanitizes unexpected database failures at the tRPC boundary", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    const app = router({
      fail: publicProcedure.query(() => {
        throw nestedError("CHECK constraint failed: private_table");
      }),
    });

    const error = await app.createCaller({} as any).fail().catch(value => value);
    expect(error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "The database operation could not be completed",
    });
    expect(error.message).not.toContain("query");
    expect(error.message).not.toContain("private_table");
    expect(logger.error).toHaveBeenCalledWith(
      "Database procedure failed",
      expect.objectContaining({ path: "fail" }),
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("private_table");
  });

  it("reads real Drizzle errors from local SQLite through their nested causes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "xflex-database-errors-"));
    temporaryDirectories.push(directory);
    const filename = join(directory, "test.db");
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const seedDatabase = new Database(filename);
    seedDatabase.exec(`
      CREATE TABLE unique_items (id INTEGER PRIMARY KEY, label TEXT NOT NULL UNIQUE);
      CREATE TABLE trigger_items (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
      CREATE TRIGGER reject_trigger_item
      BEFORE INSERT ON trigger_items
      BEGIN
        SELECT RAISE(ABORT, 'loyalty_reward_already_pending');
      END;
    `);
    seedDatabase.close();

    const database = await createLocalD1Database(filename);
    try {
      const orm = drizzle(database);
      await orm.insert(uniqueItems).values({ id: 1, label: "same" });

      const uniqueError = await orm.insert(uniqueItems)
        .values({ id: 2, label: "same" })
        .then(() => null, error => error);
      expect(getErrorChainMessages(uniqueError)[0]).toContain("Failed query");
      expect(isSqliteUniqueConstraintError(uniqueError)).toBe(true);
      expect(isDatabasePersistenceError(uniqueError)).toBe(true);

      const triggerError = await orm.insert(triggerItems)
        .values({ id: 1, label: "blocked" })
        .then(() => null, error => error);
      expect(errorChainMatches(triggerError, "loyalty_reward_already_pending")).toBe(true);
      expect(isDatabasePersistenceError(triggerError)).toBe(true);
    } finally {
      (database as any).close();
    }
  });
});
