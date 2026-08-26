import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../database/migrations/090_user_notification_history_index.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

const boundedHistorySql = `
  SELECT
    batch_id,
    title_en,
    title_ar,
    content_en,
    content_ar,
    type,
    MAX(created_at) AS created_at,
    COUNT(*) AS recipient_count,
    SUM(CASE WHEN email_sent = 1 THEN 1 ELSE 0 END) AS email_sent_count
  FROM user_notifications
  WHERE batch_id IS NOT NULL
    AND created_at >= ?
  GROUP BY batch_id
  ORDER BY MAX(created_at) DESC
  LIMIT ?
`;

describe("user notification history index migration", () => {
  it("is additive, idempotent, non-unique, and data preserving", async () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im,
    );
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(1);
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);

    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        CREATE TABLE user_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          title_en TEXT NOT NULL,
          title_ar TEXT NOT NULL,
          content_en TEXT,
          content_ar TEXT,
          action_url TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          batch_id TEXT,
          email_sent INTEGER NOT NULL DEFAULT 0,
          dedupe_key TEXT
        );
        INSERT INTO user_notifications
          (user_id, type, title_en, title_ar, content_en, content_ar,
           action_url, is_read, created_at, batch_id, email_sent, dedupe_key)
        VALUES
          (1, 'info', 'Old', 'قديم', NULL, NULL, NULL, 0,
           '2026-08-20 09:00:00', 'old-batch', 0, NULL),
          (2, 'info', 'Recent', 'حديث', 'Body', 'المحتوى', '/client', 1,
           '2026-08-25 09:00:00', 'recent-batch', 1, 'recent:2'),
          (3, 'info', 'Recent', 'حديث', 'Body', 'المحتوى', '/client', 0,
           '2026-08-25 09:01:00', 'recent-batch', 0, 'recent:3'),
          (4, 'warning', 'Legacy', 'قديم', '', '', '', 0,
           '2026-08-25 10:00:00', '', 0, NULL),
          (5, 'info', 'Personal', 'شخصي', NULL, NULL, NULL, 0,
           '2026-08-25 11:00:00', NULL, 0, NULL);
        ${migrationSql}
        ${migrationSql}
      `);

      expect(
        database.prepare("SELECT COUNT(*) AS count FROM user_notifications").get(),
      ).toEqual({ count: 5 });
      expect(
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM user_notifications WHERE batch_id = 'recent-batch'",
          )
          .get(),
      ).toEqual({ count: 2 });

      const rows = database
        .prepare(boundedHistorySql)
        .all("2026-08-23 00:00:00", 30) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ batch_id: "", recipient_count: 1 });
      expect(rows[1]).toMatchObject({
        batch_id: "recent-batch",
        created_at: "2026-08-25 09:01:00",
        recipient_count: 2,
        email_sent_count: 1,
      });

      const plan = database
        .prepare(`EXPLAIN QUERY PLAN ${boundedHistorySql}`)
        .all("2026-08-23 00:00:00", 30)
        .map((row: { detail: string }) => row.detail)
        .join("\n");
      expect(plan).toContain("idx_user_notifications_batched_created_at");
      expect(plan).not.toContain("SCAN user_notifications");
    } finally {
      database.close();
    }
  });
});
