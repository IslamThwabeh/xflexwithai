import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { createLocalD1Database } from "../backend/_core/localD1";
import { searchSupportClients } from "../backend/db";

const temporaryDirectories: string[] = [];

async function createSearchDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "xflex-support-search-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "test.db");
  const imported = await import("better-sqlite3");
  const Database = (imported.default ?? imported) as any;
  const seedDatabase = new Database(filename);
  seedDatabase.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      createdAt TEXT NOT NULL
    );
    INSERT INTO users (id, email, name, phone, createdAt) VALUES
      (1, 'exact@example.com', 'Older Exact', '0790000001', '2026-01-01'),
      (2, 'another@example.com', 'Exact Example', '0790000002', '2026-02-01'),
      (3, 'newest@example.com', 'Newest Match', '0790000003', '2026-03-01');
  `);
  seedDatabase.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("bounded support client search", () => {
  it("does not query for fewer than two characters", async () => {
    const { database, orm } = await createSearchDatabase();
    try {
      await expect(searchSupportClients("x", 50, orm)).resolves.toEqual([]);
    } finally {
      (database as any).close();
    }
  });

  it("returns only selected matching rows and prioritizes exact email", async () => {
    const { database, orm } = await createSearchDatabase();
    try {
      const results = await searchSupportClients("exact@example.com", 50, orm);
      expect(results).toEqual([{
        id: 1,
        email: "exact@example.com",
        name: "Older Exact",
        phone: "0790000001",
        createdAt: "2026-01-01",
      }]);
    } finally {
      (database as any).close();
    }
  });

  it("caps callers at fifty results", async () => {
    const routerSource = readFileSync("backend/routers.ts", "utf8");
    expect(routerSource).toContain("return db.searchSupportClients(input.query, 50)");
    expect(routerSource).not.toContain("const allUsers = await db.getAllUsers()");
  });

  it("debounces and never automatically refetches the manual search", () => {
    const source = readFileSync("frontend/src/pages/AdminSupport.tsx", "utf8");
    expect(source).toContain("setNewChatDebounced(newChatSearch.trim()), 400");
    expect(source).toContain("refetchInterval: false");
    expect(source).toContain("refetchIntervalInBackground: false");
    expect(source).toContain("refetchOnWindowFocus: false");
  });
});
