import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  STAFF_NOTIFICATION_ARCHIVE_DEFAULT_BATCH_LIMIT,
  STAFF_NOTIFICATION_ARCHIVE_DEFAULT_RETENTION_DAYS,
  STAFF_NOTIFICATION_ARCHIVE_MIN_RETENTION_DAYS,
  runStaffNotificationArchiveMaintenanceWithDatabase,
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

const workerSource = readFileSync(
  fileURLToPath(new URL("../backend/_core/worker.ts", import.meta.url)),
  "utf8",
);

const workerConfig = readFileSync(
  fileURLToPath(new URL("../wrangler-worker.toml", import.meta.url)),
  "utf8",
);

function setupDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.exec(DDL);
  const insert = sqlite.prepare(`
    INSERT INTO staff_notifications
      (userId, eventType, titleEn, titleAr, createdAt, archivedAt)
    VALUES (1, ?, 'Test', 'اختبار', ?, NULL)
  `);
  insert.run("new_support_message", "2026-08-01T00:00:00.000Z");
  insert.run("human_escalation", "2026-08-02T00:00:00.000Z");
  insert.run("new_order", "2026-08-01T00:00:00.000Z");
  insert.run("new_support_message", "2026-09-10T00:00:00.000Z");
  return sqlite;
}

describe("staff notification archive automation", () => {
  it("defaults to a bounded dry run that does not mutate data", async () => {
    const sqlite = setupDatabase();
    try {
      const result = await runStaffNotificationArchiveMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-15T05:00:00.000Z",
      });

      expect(result).toEqual({
        dryRun: true,
        cutoffIso: "2026-08-16T05:00:00.000Z",
        batchKey: "staff-support-archive:2026-09-15",
        retentionDays: STAFF_NOTIFICATION_ARCHIVE_DEFAULT_RETENTION_DAYS,
        limit: STAFF_NOTIFICATION_ARCHIVE_DEFAULT_BATCH_LIMIT,
        candidateCount: 2,
        archivedCount: 0,
      });
      expect(sqlite.prepare(`
        SELECT COUNT(*) AS archived FROM staff_notifications WHERE archivedAt IS NOT NULL
      `).get()).toEqual({ archived: 0 });
    } finally {
      sqlite.close();
    }
  });

  it("archives only the allowed batch when explicitly switched out of dry-run", async () => {
    const sqlite = setupDatabase();
    try {
      const result = await runStaffNotificationArchiveMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-15T05:00:00.000Z",
        dryRun: false,
        limit: 1,
      });

      expect(result).toMatchObject({
        dryRun: false,
        candidateCount: 1,
        archivedCount: 1,
        batchKey: "staff-support-archive:2026-09-15",
      });
      expect(sqlite.prepare(`
        SELECT id, eventType, archivedAt, archiveBatchKey
        FROM staff_notifications WHERE archivedAt IS NOT NULL
      `).all()).toEqual([{
        id: 1,
        eventType: "new_support_message",
        archivedAt: "2026-09-15T05:00:00.000Z",
        archiveBatchKey: "staff-support-archive:2026-09-15",
      }]);
      expect(sqlite.prepare(`
        SELECT COUNT(*) AS activeNewOrder
        FROM staff_notifications
        WHERE eventType='new_order' AND archivedAt IS NULL
      `).get()).toEqual({ activeNewOrder: 1 });
    } finally {
      sqlite.close();
    }
  });

  it("rejects retention windows shorter than the approved minimum", async () => {
    const sqlite = setupDatabase();
    try {
      await expect(runStaffNotificationArchiveMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-15T05:00:00.000Z",
        retentionDays: STAFF_NOTIFICATION_ARCHIVE_MIN_RETENTION_DAYS - 1,
      })).rejects.toThrow("Archive retention must be between 30 and 3650 days");
    } finally {
      sqlite.close();
    }
  });

  it("keeps Worker automation disabled unless explicitly enabled", () => {
    expect(workerSource).toContain('env.STAFF_NOTIFICATION_ARCHIVE_ENABLED !== "true"');
    expect(workerSource).toContain('dryRun: env.STAFF_NOTIFICATION_ARCHIVE_DRY_RUN !== "false"');
    expect(workerSource).toContain("await runStaffNotificationArchiveAutomation(env)");
    expect(workerSource.indexOf("await db.runStaffMonitoringRetention()"))
      .toBeLessThan(workerSource.indexOf("await runStaffNotificationArchiveAutomation(env)"));
    expect(workerSource.indexOf("await runStaffNotificationArchiveAutomation(env)"))
      .toBeLessThan(workerSource.indexOf("const unfrozen = await db.processExpiredFreezes()"));

    expect(workerConfig.match(/STAFF_NOTIFICATION_ARCHIVE_ENABLED = "false"/g))
      .toHaveLength(3);
    expect(workerConfig.match(/STAFF_NOTIFICATION_ARCHIVE_DRY_RUN = "true"/g))
      .toHaveLength(3);
    expect(workerConfig.match(/STAFF_NOTIFICATION_ARCHIVE_BATCH_LIMIT = "50"/g))
      .toHaveLength(3);
  });
});
