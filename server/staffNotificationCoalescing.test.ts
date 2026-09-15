import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { upsertCoalescedStaffNotification } from "../backend/db";

const DDL = `
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
    createdAt TEXT NOT NULL,
    archivedAt TEXT,
    archiveReason TEXT,
    archiveBatchKey TEXT
  );
  CREATE UNIQUE INDEX uq_staff_notifications_user_dedupe_key
    ON staff_notifications(userId, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
`;

function value(overrides: Record<string, unknown> = {}) {
  return {
    userId: 9,
    eventType: "new_support_message" as const,
    titleEn: "New support message",
    titleAr: "رسالة دعم جديدة",
    contentEn: "First message",
    contentAr: "First message",
    actionUrl: "/admin/support?conversationId=10",
    metadata: JSON.stringify({ conversationId: 10 }),
    isRead: false,
    dedupeKey: "support_conversation:10",
    createdAt: "2026-09-15T10:00:00.000Z",
    ...overrides,
  } as any;
}

describe("staff support notification coalescing", () => {
  it("updates and reopens one row instead of inserting repeated conversation alerts", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const db = drizzle(sqlite);
      await upsertCoalescedStaffNotification(db, value());
      sqlite.prepare(`
        UPDATE staff_notifications
        SET isRead=1, archivedAt='2026-09-15T11:00:00.000Z',
            archiveReason='test', archiveBatchKey='test-batch'
      `).run();
      await upsertCoalescedStaffNotification(db, value({
        contentEn: "Latest message",
        contentAr: "Latest message",
        createdAt: "2026-09-15T12:00:00.000Z",
      }));

      expect(sqlite.prepare(`
        SELECT COUNT(*) AS total FROM staff_notifications
      `).get()).toEqual({ total: 1 });
      expect(sqlite.prepare(`
        SELECT contentEn, isRead, archivedAt, archiveReason, archiveBatchKey, createdAt
        FROM staff_notifications
      `).get()).toEqual({
        contentEn: "Latest message",
        isRead: 0,
        archivedAt: null,
        archiveReason: null,
        archiveBatchKey: null,
        createdAt: "2026-09-15T12:00:00.000Z",
      });
    } finally {
      sqlite.close();
    }
  });

  it("does not downgrade a human escalation when a later message arrives", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const db = drizzle(sqlite);
      await upsertCoalescedStaffNotification(db, value({
        eventType: "human_escalation",
        titleEn: "Human review required",
        titleAr: "مراجعة بشرية مطلوبة",
        contentEn: "Escalated",
        contentAr: "Escalated",
      }));
      await upsertCoalescedStaffNotification(db, value({
        contentEn: "Latest client context",
        contentAr: "Latest client context",
        createdAt: "2026-09-15T12:00:00.000Z",
      }));

      expect(sqlite.prepare(`
        SELECT eventType, titleEn, contentEn, isRead FROM staff_notifications
      `).get()).toEqual({
        eventType: "human_escalation",
        titleEn: "Human review required",
        contentEn: "Latest client context",
        isRead: 0,
      });
    } finally {
      sqlite.close();
    }
  });

  it("keeps the same conversation isolated per staff user", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const db = drizzle(sqlite);
      await upsertCoalescedStaffNotification(db, value({ userId: 9 }));
      await upsertCoalescedStaffNotification(db, value({ userId: 10 }));

      expect(sqlite.prepare(`
        SELECT userId, COUNT(*) AS total
        FROM staff_notifications GROUP BY userId ORDER BY userId
      `).all()).toEqual([
        { userId: 9, total: 1 },
        { userId: 10, total: 1 },
      ]);
    } finally {
      sqlite.close();
    }
  });
});
