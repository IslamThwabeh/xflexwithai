import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  buildStaffNotificationArchiveCandidateQuery,
  buildStaffNotificationArchiveRollbackCandidateQuery,
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
});
