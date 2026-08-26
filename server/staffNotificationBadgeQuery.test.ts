import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { buildUnreadStaffNotificationBadgeQuery } from "../backend/db";

const STAFF_NOTIFICATION_PRODUCTION_SHAPED_DDL = `
  CREATE TABLE staff_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    eventType TEXT NOT NULL,
    titleEn TEXT NOT NULL,
    titleAr TEXT NOT NULL,
    contentEn TEXT,
    contentAr TEXT,
    actionUrl TEXT,
    metadata TEXT,
    isRead INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_staff_notif_actionUrl
    ON staff_notifications(userId, isRead, actionUrl);
`;

function insertNotification(
  database: Database.Database,
  input: { userId: number; isRead: number; actionUrl: string | null },
) {
  database.prepare(`
    INSERT INTO staff_notifications (
      userId,
      eventType,
      titleEn,
      titleAr,
      actionUrl,
      isRead
    ) VALUES (?, 'test', 'Test', 'اختبار', ?, ?)
  `).run(input.userId, input.actionUrl, input.isRead);
}

function normalizeBadgeRows(rows: Array<{ actionUrl: string | null; count: unknown }>) {
  const byRoute: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count ?? 0);
    total += count;
    if (row.actionUrl) byRoute[row.actionUrl] = count;
  }
  return { total, byRoute };
}

describe("staff notification badge SQL contract", () => {
  it("returns one user's exact unread total and route counts", async () => {
    const database = new Database(":memory:");
    try {
      database.exec(STAFF_NOTIFICATION_PRODUCTION_SHAPED_DDL);
      insertNotification(database, { userId: 9, isRead: 0, actionUrl: "/admin/support" });
      insertNotification(database, { userId: 9, isRead: 0, actionUrl: "/admin/support" });
      insertNotification(database, { userId: 9, isRead: 0, actionUrl: "/admin/orders" });
      insertNotification(database, { userId: 9, isRead: 0, actionUrl: null });
      insertNotification(database, { userId: 9, isRead: 0, actionUrl: "" });
      insertNotification(database, { userId: 9, isRead: 1, actionUrl: "/admin/support" });
      insertNotification(database, { userId: 10, isRead: 0, actionUrl: "/admin/support" });

      const rows = await buildUnreadStaffNotificationBadgeQuery(drizzle(database), 9);

      expect(normalizeBadgeRows(rows)).toEqual({
        total: 5,
        byRoute: {
          "/admin/orders": 1,
          "/admin/support": 2,
        },
      });
    } finally {
      database.close();
    }
  });

  it("uses the production covering index instead of scanning staff notifications", () => {
    const database = new Database(":memory:");
    try {
      database.exec(STAFF_NOTIFICATION_PRODUCTION_SHAPED_DDL);
      const query = buildUnreadStaffNotificationBadgeQuery(drizzle(database), 9);
      const compiled = query.toSQL();
      const plan = database
        .prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
        .all(...compiled.params)
        .map((row: any) => String(row.detail))
        .join("\n");

      expect(plan).toContain("idx_staff_notif_actionUrl");
      expect(plan).not.toContain("SCAN staff_notifications");
    } finally {
      database.close();
    }
  });
});
