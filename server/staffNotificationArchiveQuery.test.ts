import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  buildStaffNotificationArchiveCandidateQuery,
  buildStaffNotificationArchiveRollbackCandidateQuery,
  archiveStaffNotificationsBatchWithDatabase,
  rollbackStaffNotificationArchiveBatchWithDatabase,
  STAFF_NOTIFICATION_ARCHIVE_BATCH_LIMIT,
  STAFF_NOTIFICATION_ARCHIVE_EVENT_TYPES,
} from "../backend/db";

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
  CREATE INDEX idx_staff_notif_archive_candidates
    ON staff_notifications(eventType, archivedAt, createdAt, id);
  CREATE INDEX idx_staff_notif_archive_batch
    ON staff_notifications(archiveBatchKey, id);
`;

describe("staff notification archive candidate query", () => {
  it("selects only unarchived, allowlisted rows strictly before the cutoff", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const insert = sqlite.prepare(`
        INSERT INTO staff_notifications
          (userId, eventType, titleEn, titleAr, createdAt, archivedAt)
        VALUES (1, ?, 'Test', 'اختبار', ?, ?)
      `);
      insert.run("new_support_message", "2026-08-01T00:00:00.000Z", null);
      insert.run("human_escalation", "2026-08-02T00:00:00.000Z", null);
      insert.run("new_order", "2026-08-01T00:00:00.000Z", null);
      insert.run("new_support_message", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
      insert.run("new_support_message", "2026-08-15T00:00:00.000Z", null);

      const rows = await buildStaffNotificationArchiveCandidateQuery(drizzle(sqlite), {
        cutoffIso: "2026-08-15T00:00:00.000Z",
        limit: STAFF_NOTIFICATION_ARCHIVE_BATCH_LIMIT,
      });

      expect(rows.map((row) => row.id)).toEqual([1, 2]);
      expect(STAFF_NOTIFICATION_ARCHIVE_EVENT_TYPES).toEqual([
        "new_support_message",
        "human_escalation",
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("uses the archive-candidate index", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const query = buildStaffNotificationArchiveCandidateQuery(drizzle(sqlite), {
        cutoffIso: "2026-08-15T00:00:00.000Z",
        limit: 500,
      });
      const compiled = query.toSQL();
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
        .all(...compiled.params)
        .map((row: any) => String(row.detail))
        .join("\n");

      expect(plan).toContain("idx_staff_notif_archive_candidates");
      expect(plan).not.toContain("SCAN staff_notifications");
    } finally {
      sqlite.close();
    }
  });

  it("uses the batch-key index for bounded rollback selection", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const query = buildStaffNotificationArchiveRollbackCandidateQuery(drizzle(sqlite), {
        batchKey: "staff-support-archive:2026-08-15",
        limit: 500,
      });
      const compiled = query.toSQL();
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
        .all(...compiled.params)
        .map((row: any) => String(row.detail))
        .join("\n");

      expect(plan).toContain("idx_staff_notif_archive_batch");
      expect(plan).not.toContain("SCAN staff_notifications");
    } finally {
      sqlite.close();
    }
  });

  it("archives only eligible rows, preserves their state, reconciles totals, and rolls back one batch", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const insert = sqlite.prepare(`
        INSERT INTO staff_notifications
          (userId, eventType, titleEn, titleAr, contentEn, contentAr, actionUrl,
           metadata, isRead, dedupe_key, createdAt, archivedAt, archiveReason,
           archiveBatchKey)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(9, "new_support_message", "Support 1", "دعم 1", "Body 1", "نص 1",
        "/admin/support?conversationId=1", '{"conversationId":1}', 0, null,
        "2026-08-01T00:00:00.000Z", null, null, null);
      insert.run(9, "human_escalation", "Support 2", "دعم 2", "Body 2", "نص 2",
        "/admin/support?conversationId=2", '{"conversationId":2}', 1, null,
        "2026-08-02T00:00:00.000Z", null, null, null);
      insert.run(9, "new_order", "Order", "طلب", "Order body", "نص الطلب",
        "/admin/orders", null, 0, null, "2026-08-01T00:00:00.000Z", null, null, null);
      insert.run(9, "new_support_message", "Boundary", "الحد", "Boundary", "الحد",
        "/admin/support?conversationId=3", null, 0, null,
        "2026-08-15T00:00:00.000Z", null, null, null);
      insert.run(9, "new_support_message", "Already archived", "مؤرشف", "Old", "قديم",
        "/admin/support?conversationId=4", null, 0, null,
        "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", "prior", "prior-batch");

      const before = sqlite.prepare(`
        SELECT id, userId, eventType, titleEn, titleAr, contentEn, contentAr,
               actionUrl, metadata, isRead, dedupe_key, createdAt
        FROM staff_notifications ORDER BY id
      `).all();
      const db = drizzle(sqlite);
      const result = await archiveStaffNotificationsBatchWithDatabase(db, {
        cutoffIso: "2026-08-15T00:00:00.000Z",
        archivedAt: "2026-09-15T13:00:00.000Z",
        batchKey: "support-archive:phase4-test",
        limit: 2,
      });

      expect(result).toEqual({ candidateCount: 2, archivedCount: 2 });
      expect(sqlite.prepare(`
        SELECT id, isRead, archivedAt, archiveReason, archiveBatchKey
        FROM staff_notifications WHERE archiveBatchKey='support-archive:phase4-test'
        ORDER BY id
      `).all()).toEqual([
        { id: 1, isRead: 0, archivedAt: "2026-09-15T13:00:00.000Z", archiveReason: "routine_support_notification_older_than_30_days", archiveBatchKey: "support-archive:phase4-test" },
        { id: 2, isRead: 1, archivedAt: "2026-09-15T13:00:00.000Z", archiveReason: "routine_support_notification_older_than_30_days", archiveBatchKey: "support-archive:phase4-test" },
      ]);
      expect(sqlite.prepare(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN archivedAt IS NULL THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN archivedAt IS NOT NULL THEN 1 ELSE 0 END) AS archived
        FROM staff_notifications
      `).get()).toEqual({ total: 5, active: 2, archived: 3 });
      expect(sqlite.prepare(`
        SELECT id FROM staff_notifications
        WHERE eventType='new_order' OR createdAt='2026-08-15T00:00:00.000Z'
        ORDER BY id
      `).all()).toEqual([{ id: 3 }, { id: 4 }]);

      const rollback = await rollbackStaffNotificationArchiveBatchWithDatabase(db, {
        batchKey: "support-archive:phase4-test",
        limit: 2,
      });
      expect(rollback).toEqual({ restoredCount: 2 });
      expect(sqlite.prepare(`
        SELECT id, userId, eventType, titleEn, titleAr, contentEn, contentAr,
               actionUrl, metadata, isRead, dedupe_key, createdAt
        FROM staff_notifications ORDER BY id
      `).all()).toEqual(before);
      expect(sqlite.prepare(`
        SELECT archivedAt, archiveReason, archiveBatchKey
        FROM staff_notifications WHERE id IN (1,2) ORDER BY id
      `).all()).toEqual([
        { archivedAt: null, archiveReason: null, archiveBatchKey: null },
        { archivedAt: null, archiveReason: null, archiveBatchKey: null },
      ]);
      expect(sqlite.prepare(`
        SELECT archivedAt, archiveReason, archiveBatchKey
        FROM staff_notifications WHERE id=5
      `).get()).toEqual({
        archivedAt: "2026-08-01T00:00:00.000Z",
        archiveReason: "prior",
        archiveBatchKey: "prior-batch",
      });
    } finally {
      sqlite.close();
    }
  });

  it("rejects non-canonical cutoffs and oversized batches before mutation", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(DDL);
      const db = drizzle(sqlite);
      await expect(archiveStaffNotificationsBatchWithDatabase(db, {
        cutoffIso: "2026-08-15",
        batchKey: "support-archive:invalid-cutoff",
      })).rejects.toThrow("canonical ISO timestamp");
      await expect(archiveStaffNotificationsBatchWithDatabase(db, {
        cutoffIso: "2026-08-15T00:00:00.000Z",
        batchKey: "support-archive:oversized",
        limit: 501,
      })).rejects.toThrow("between 1 and 500");
      expect(sqlite.prepare("SELECT COUNT(*) AS total FROM staff_notifications").get())
        .toEqual({ total: 0 });
    } finally {
      sqlite.close();
    }
  });
});
