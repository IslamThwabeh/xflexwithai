import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationNames = [
  "115_staff_notification_archiving.sql",
  "116_staff_notification_archive_candidates.sql",
  "117_staff_notification_archive_rollback.sql",
  "118_staff_notification_archive_history.sql",
] as const;

const migrations = migrationNames.map((name) => readFileSync(
  fileURLToPath(new URL(`../database/migrations/${name}`, import.meta.url)),
  "utf8",
));

describe("staff notification archive migrations", () => {
  it("apply additively to the legacy schema and preserve every existing value", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(`
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
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          dedupe_key TEXT
        );
        CREATE UNIQUE INDEX uq_staff_notifications_user_dedupe_key
          ON staff_notifications(userId, dedupe_key)
          WHERE dedupe_key IS NOT NULL;
        CREATE TABLE schema_migrations (
          migration_name TEXT NOT NULL UNIQUE,
          source TEXT NOT NULL,
          notes TEXT,
          applied_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO staff_notifications
          (userId,eventType,titleEn,titleAr,contentEn,contentAr,actionUrl,metadata,
           isRead,createdAt,dedupe_key)
        VALUES
          (9,'new_support_message','Support','دعم','Body','نص','/admin/support',
           '{"conversationId":10}',0,'2026-08-01T00:00:00.000Z',NULL),
          (9,'new_order','Order','طلب',NULL,NULL,'/admin/orders',NULL,1,
           '2026-09-01T00:00:00.000Z','order:1');
      `);
      const before = sqlite.prepare("SELECT * FROM staff_notifications ORDER BY id").all();

      for (const migration of migrations) sqlite.exec(migration);

      const after = sqlite.prepare(`
        SELECT id,userId,eventType,titleEn,titleAr,contentEn,contentAr,actionUrl,
               metadata,isRead,createdAt,dedupe_key
        FROM staff_notifications ORDER BY id
      `).all();
      expect(after).toEqual(before);
      expect(sqlite.prepare(`
        SELECT archivedAt,archiveReason,archiveBatchKey
        FROM staff_notifications ORDER BY id
      `).all()).toEqual([
        { archivedAt: null, archiveReason: null, archiveBatchKey: null },
        { archivedAt: null, archiveReason: null, archiveBatchKey: null },
      ]);
      expect(sqlite.prepare(`
        SELECT migration_name FROM schema_migrations ORDER BY migration_name
      `).all()).toEqual(migrationNames.map((migration_name) => ({ migration_name })));

      const indexes = sqlite.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name LIKE 'idx_staff_notif_archive%'
        ORDER BY name
      `).all();
      expect(indexes).toEqual([
        { name: "idx_staff_notif_archive_batch" },
        { name: "idx_staff_notif_archive_candidates" },
        { name: "idx_staff_notif_archive_history" },
      ]);
      expect(sqlite.prepare(`
        SELECT name FROM sqlite_master WHERE name='idx_staff_notif_active_badges'
      `).get()).toEqual({ name: "idx_staff_notif_active_badges" });

      // Index-only migrations and their ledger writes remain repeatable after
      // the one-time ALTER migration has been recorded.
      for (const migration of migrations.slice(1)) sqlite.exec(migration);
      expect(sqlite.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get())
        .toEqual({ total: 4 });

      const historyPlan = sqlite.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM staff_notifications
        WHERE userId=? AND archivedAt IS NOT NULL
        ORDER BY archivedAt DESC, id DESC LIMIT ? OFFSET ?
      `).all(9, 25, 0).map((row: any) => String(row.detail)).join("\n");
      expect(historyPlan).toContain("idx_staff_notif_archive_history");
      expect(historyPlan).not.toContain("SCAN staff_notifications");
    } finally {
      sqlite.close();
    }
  });

  it("contains no data cleanup or destructive schema operation", () => {
    const combined = migrations.join("\n");
    const executableSql = combined
      .replace(/^\s*--.*$/gm, "")
      .replace(/'[^']*'/g, "''");
    expect(executableSql).not.toMatch(/(?:^|;)\s*(?:DELETE|DROP|VACUUM|REPLACE)\b/i);
    expect(executableSql).not.toMatch(/(?:^|;)\s*UPDATE\s+staff_notifications/i);
    expect(combined.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(4);
    expect(combined).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });
});
