import type { D1Database } from "@cloudflare/workers-types";

type SqliteRunResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

type SqliteStatement = {
  readonly reader: boolean;
  all(...values: unknown[]): Record<string, unknown>[];
  get(...values: unknown[]): Record<string, unknown> | undefined;
  raw(enabled?: boolean): SqliteStatement;
  run(...values: unknown[]): SqliteRunResult;
};

type SqliteDatabase = {
  close(): void;
  exec(query: string): unknown;
  pragma(query: string): unknown;
  prepare(query: string): SqliteStatement;
};

type SqliteDatabaseConstructor = new (
  filename: string,
  options?: { fileMustExist?: boolean },
) => SqliteDatabase;

type LocalD1Result = {
  results: Record<string, unknown>[];
  success: true;
  meta: {
    changes: number;
    duration: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
};

const toSafeNumber = (value: number | bigint) =>
  typeof value === "bigint" ? Number(value) : value;

const createResult = (
  results: Record<string, unknown>[],
  startedAt: number,
  changes = 0,
  lastInsertRowid: number | bigint = 0,
): LocalD1Result => ({
  results,
  success: true,
  meta: {
    changes,
    duration: performance.now() - startedAt,
    last_row_id: toSafeNumber(lastInsertRowid),
    rows_read: results.length,
    rows_written: changes,
  },
});

class LocalD1PreparedStatement {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly query: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new LocalD1PreparedStatement(this.database, this.query, values);
  }

  async first(columnName?: string) {
    const row = this.database.prepare(this.query).get(...this.values);
    if (!row) return null;
    return columnName ? (row[columnName] ?? null) : row;
  }

  async run() {
    const startedAt = performance.now();
    const statement = this.database.prepare(this.query);

    if (statement.reader) {
      return createResult(statement.all(...this.values), startedAt);
    }

    const result = statement.run(...this.values);
    return createResult([], startedAt, result.changes, result.lastInsertRowid);
  }

  async all() {
    const startedAt = performance.now();
    const results = this.database.prepare(this.query).all(...this.values);
    return createResult(results, startedAt);
  }

  async raw() {
    return this.database
      .prepare(this.query)
      .raw(true)
      .all(...this.values) as unknown as unknown[][];
  }

  async executeForBatch() {
    const statement = this.database.prepare(this.query);
    return statement.reader ? this.all() : this.run();
  }
}

export async function createLocalD1Database(
  filename: string,
): Promise<D1Database> {
  // Keep the package name dynamic so the Cloudflare Worker bundle never loads
  // this Node-only development dependency.
  const packageName = "better-sqlite3";
  const imported = await import(packageName);
  const Database = (imported.default ?? imported) as SqliteDatabaseConstructor;
  const sqlite = new Database(filename, { fileMustExist: true });

  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  const localD1 = {
    prepare(query: string) {
      return new LocalD1PreparedStatement(sqlite, query);
    },
    async batch(statements: LocalD1PreparedStatement[]) {
      return Promise.all(
        statements.map(statement => statement.executeForBatch()),
      );
    },
    async exec(query: string) {
      const startedAt = performance.now();
      sqlite.exec(query);
      return {
        count: query
          .split(";")
          .filter(statement => statement.trim().length > 0).length,
        duration: performance.now() - startedAt,
      };
    },
    async dump() {
      throw new Error("Local D1 dump is not implemented");
    },
  };

  return localD1 as unknown as D1Database;
}
