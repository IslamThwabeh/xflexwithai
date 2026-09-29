import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  buildUserActivityTouchWhere,
  getUserActivityTouchStaleBefore,
  USER_ACTIVITY_TOUCH_THROTTLE_MS,
} from "../backend/db";
import { users } from "../database/schema-sqlite";

function setupDatabase() {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      lastActiveAt TEXT
    );
  `);

  return { database, db: drizzle(database) };
}

async function touchUserActivityForTest(
  db: ReturnType<typeof drizzle>,
  userId: number,
  at: Date,
) {
  await db.update(users)
    .set({ lastActiveAt: at.toISOString() })
    .where(buildUserActivityTouchWhere(userId, getUserActivityTouchStaleBefore(at)));
}

describe("user activity touch throttling", () => {
  it("updates a missing activity marker", async () => {
    const { database, db } = setupDatabase();
    try {
      database.prepare("INSERT INTO users (id, lastActiveAt) VALUES (1, NULL)").run();
      const now = new Date("2026-09-29T09:00:00.000Z");

      await touchUserActivityForTest(db, 1, now);

      expect(database.prepare("SELECT lastActiveAt FROM users WHERE id = 1").get())
        .toEqual({ lastActiveAt: now.toISOString() });
    } finally {
      database.close();
    }
  });

  it("does not rewrite a recent activity marker inside the throttle window", async () => {
    const { database, db } = setupDatabase();
    try {
      const now = new Date("2026-09-29T09:00:00.000Z");
      const recent = new Date(now.getTime() - USER_ACTIVITY_TOUCH_THROTTLE_MS + 1).toISOString();
      database.prepare("INSERT INTO users (id, lastActiveAt) VALUES (1, ?)").run(recent);

      await touchUserActivityForTest(db, 1, now);

      expect(database.prepare("SELECT lastActiveAt FROM users WHERE id = 1").get())
        .toEqual({ lastActiveAt: recent });
    } finally {
      database.close();
    }
  });

  it("refreshes a stale activity marker after the throttle window", async () => {
    const { database, db } = setupDatabase();
    try {
      const now = new Date("2026-09-29T09:00:00.000Z");
      const stale = new Date(now.getTime() - USER_ACTIVITY_TOUCH_THROTTLE_MS - 1).toISOString();
      database.prepare("INSERT INTO users (id, lastActiveAt) VALUES (1, ?)").run(stale);

      await touchUserActivityForTest(db, 1, now);

      expect(database.prepare("SELECT lastActiveAt FROM users WHERE id = 1").get())
        .toEqual({ lastActiveAt: now.toISOString() });
    } finally {
      database.close();
    }
  });
});
