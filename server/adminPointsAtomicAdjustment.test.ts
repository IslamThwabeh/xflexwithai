import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { createLocalD1Database } from "../backend/_core/localD1";
import { adjustStudentPointsAtomic } from "../backend/db";

const temporaryDirectories: string[] = [];

async function createPointsDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "xflex-admin-points-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "test.db");
  const imported = await import("better-sqlite3");
  const Database = (imported.default ?? imported) as any;
  const seedDatabase = new Database(filename);
  seedDatabase.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      points_balance INTEGER NOT NULL DEFAULT 0,
      isStaff INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE points_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'earn',
      reason_en TEXT,
      reason_ar TEXT,
      reference_id INTEGER,
      reference_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users (id, points_balance, isStaff) VALUES
      (17, 100, 0),
      (18, 100, 1);
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

describe("atomic admin points adjustments", () => {
  it("commits the balance, ledger, and acting operator together", async () => {
    const { database, orm } = await createPointsDatabase();
    try {
      const transaction = await adjustStudentPointsAtomic(
        {
          userId: 17,
          actorUserId: 77,
          amount: 25,
          direction: "award",
          reasonEn: "Manual correction",
          reasonAr: "تصحيح يدوي",
        },
        orm
      );

      expect(transaction).toMatchObject({
        userId: 17,
        amount: 25,
        type: "bonus",
        referenceId: 77,
        referenceType: "admin_adjustment",
      });
      expect(
        await database
          .prepare("SELECT points_balance FROM users WHERE id = 17")
          .first<number>("points_balance")
      ).toBe(125);
      expect(
        await database
          .prepare("SELECT COUNT(*) AS total FROM points_transactions")
          .first<number>("total")
      ).toBe(1);
    } finally {
      (database as any).close();
    }
  });

  it("serializes competing deductions without overdrawing or orphaning a ledger row", async () => {
    const { database, orm } = await createPointsDatabase();
    try {
      const adjustment = {
        userId: 17,
        actorUserId: 77,
        amount: 80,
        direction: "deduct" as const,
        reasonEn: "Manual correction",
        reasonAr: "تصحيح يدوي",
      };
      const results = await Promise.all([
        adjustStudentPointsAtomic(adjustment, orm),
        adjustStudentPointsAtomic(adjustment, orm),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.filter(result => result === null)).toHaveLength(1);
      expect(
        await database
          .prepare("SELECT points_balance FROM users WHERE id = 17")
          .first<number>("points_balance")
      ).toBe(20);
      expect(
        await database
          .prepare("SELECT COUNT(*) AS total FROM points_transactions")
          .first<number>("total")
      ).toBe(1);
    } finally {
      (database as any).close();
    }
  });

  it("rolls back the ledger guard for a staff target", async () => {
    const { database, orm } = await createPointsDatabase();
    try {
      await expect(
        adjustStudentPointsAtomic(
          {
            userId: 18,
            actorUserId: 77,
            amount: 25,
            direction: "award",
            reasonEn: "Manual correction",
            reasonAr: "تصحيح يدوي",
          },
          orm
        )
      ).resolves.toBeNull();
      expect(
        await database
          .prepare("SELECT points_balance FROM users WHERE id = 18")
          .first<number>("points_balance")
      ).toBe(100);
      expect(
        await database
          .prepare("SELECT COUNT(*) AS total FROM points_transactions")
          .first<number>("total")
      ).toBe(0);
    } finally {
      (database as any).close();
    }
  });
});
