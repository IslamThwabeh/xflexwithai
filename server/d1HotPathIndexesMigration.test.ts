import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/081_d1_hot_path_indexes.sql", import.meta.url),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("D1 hot-path index migration", () => {
  it("is additive, idempotent, and never introduces a uniqueness constraint", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im);
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(6);
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });

  it("preserves duplicate progress rows and gives every hot path an indexed plan", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        CREATE TABLE supportConversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          status TEXT NOT NULL DEFAULT 'open',
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE supportMessages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversationId INTEGER NOT NULL,
          senderType TEXT NOT NULL,
          isRead INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE episodeProgress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          episodeId INTEGER NOT NULL,
          courseId INTEGER NOT NULL,
          watchedDuration INTEGER NOT NULL DEFAULT 0,
          isCompleted INTEGER NOT NULL DEFAULT 0,
          lastWatchedAt TEXT NOT NULL
        );
        INSERT INTO episodeProgress
          (userId, episodeId, courseId, watchedDuration, isCompleted, lastWatchedAt)
        VALUES
          (1, 10, 20, 30, 0, '2026-08-01T10:00:00.000Z'),
          (1, 10, 20, 45, 1, '2026-08-01T10:01:00.000Z');
        ${migrationSql}
        ${migrationSql}
      `);

      expect(database.prepare(`
        SELECT COUNT(*) AS count
        FROM episodeProgress
        WHERE userId = 1 AND episodeId = 10
      `).get()).toEqual({ count: 2 });

      const planDetails = (sql: string) => database
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all()
        .map((row: { detail: string }) => row.detail)
        .join("\n");

      expect(planDetails(`
        SELECT id FROM supportConversations
        ORDER BY updatedAt DESC, id DESC LIMIT 30
      `)).toContain("idx_support_conversations_updated_id");
      expect(planDetails(`
        SELECT id FROM supportConversations
        WHERE status = 'open'
        ORDER BY updatedAt DESC, id DESC LIMIT 30
      `)).toContain("idx_support_conversations_status_updated_id");
      expect(planDetails(`
        SELECT id FROM supportMessages
        WHERE conversationId = 1
        ORDER BY createdAt DESC, id DESC LIMIT 1
      `)).toContain("idx_support_messages_conversation_created_id");
      expect(planDetails(`
        SELECT conversationId, COUNT(*) FROM supportMessages
        WHERE senderType = 'client' AND isRead = 0
        GROUP BY conversationId
      `)).toContain("idx_support_messages_unread_client");
      expect(planDetails(`
        SELECT * FROM episodeProgress
        WHERE userId = 1 AND courseId = 20
        ORDER BY lastWatchedAt
      `)).toContain("idx_episode_progress_user_course_watched");
      expect(planDetails(`
        SELECT * FROM episodeProgress
        WHERE userId = 1 AND episodeId = 10 LIMIT 1
      `)).toContain("idx_episode_progress_user_episode");
    } finally {
      database.close();
    }
  });
});
