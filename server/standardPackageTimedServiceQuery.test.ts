import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import { buildLatestActivatedStandardPackageKeyQuery } from "../backend/db";

describe("standard timed-service package selection", () => {
  it("executes the application query without letting a newer Live key replace Comprehensive", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE packages (id INTEGER PRIMARY KEY, packageType TEXT NOT NULL, durationDays INTEGER);
        CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, email TEXT, packageId INTEGER, entitlementDays INTEGER, activatedAt TEXT);
        CREATE INDEX idx_keys_email ON registrationKeys(email);
        INSERT INTO packages VALUES (1,'standard',30),(2,'standard',30),(3,'live',0);
        INSERT INTO registrationKeys VALUES
          (1,'mixed@example.com',2,45,'2026-09-01T00:00:00.000Z'),
          (2,'mixed@example.com',3,1,'2026-11-01T00:00:00.000Z'),
          (3,'live@example.com',3,1,'2026-11-01T00:00:00.000Z'),
          (4,'unused@example.com',2,30,NULL),
          (5,'legacy@example.com',1,NULL,'2026-09-01T00:00:00.000Z'),
          (6,'mixed@example.com',1,15,NULL);
      `);
      const query = (email: string) => buildLatestActivatedStandardPackageKeyQuery(drizzle({} as D1Database), email).toSQL();
      const read = (email: string) => { const q = query(email); return sqlite.prepare(q.sql).all(...q.params); };
      expect(read("mixed@example.com")).toEqual([{ entitlementDays: 45, packageId: 2, durationDays: 30 }]);
      expect(read("live@example.com")).toEqual([]);
      expect(read("unused@example.com")).toEqual([]);
      expect(read("legacy@example.com")).toEqual([{ entitlementDays: null, packageId: 1, durationDays: 30 }]);
      const q = query("mixed@example.com");
      expect(sqlite.prepare("EXPLAIN QUERY PLAN " + q.sql).all(...q.params).map((r: any) => r.detail).join("\n")).toContain("idx_keys_email");
    } finally {
      sqlite.close();
    }
  });
});
