import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../database/migrations/091_recommendation_message_thread_index.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

const summarySql = `
  SELECT
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN 1 ELSE 0 END),
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND (threadStatus IS NULL OR threadStatus <> 'closed') THEN 1 ELSE 0 END),
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND (threadStatus IS NULL OR threadStatus <> 'closed')
      AND NOT EXISTS (
        SELECT 1 FROM recommendationMessages child
        WHERE child.parentId = recommendationMessages.id
          AND child.type = 'result'
      ) THEN 1 ELSE 0 END),
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND threadStatus = 'closed' THEN 1 ELSE 0 END),
    SUM(CASE WHEN parentId IS NOT NULL AND type = 'result' THEN 1 ELSE 0 END),
    SUM(CASE WHEN parentId IS NOT NULL AND type = 'update' THEN 1 ELSE 0 END),
    MIN(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN createdAt END),
    MAX(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN createdAt END)
  FROM recommendationMessages
`;

const openRootsSql = `
  SELECT id
  FROM recommendationMessages
  WHERE parentId IS NULL
    AND type = ?
    AND (threadStatus IS NULL OR threadStatus <> ?)
  ORDER BY createdAt DESC, id DESC
`;

const schemaMigrationRecordSql = `
  INSERT INTO schema_migrations (migration_name, source, notes)
  SELECT
    '091_recommendation_message_thread_index.sql',
    'codex_wrangler',
    'Add non-unique recommendation parent/type/order index'
  WHERE NOT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE migration_name = '091_recommendation_message_thread_index.sql'
  )
`;

describe("recommendation message thread index migration", () => {
  it("is additive, idempotent, non-unique, data preserving, and indexed", async () => {
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
        CREATE TABLE recommendationMessages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'recommendation',
          content TEXT NOT NULL,
          symbol TEXT,
          side TEXT,
          entryPrice TEXT,
          stopLoss TEXT,
          takeProfit1 TEXT,
          takeProfit2 TEXT,
          riskPercent TEXT,
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          parentId INTEGER,
          threadStatus TEXT,
          closedAt TEXT,
          closedByUserId INTEGER,
          takeProfit3 TEXT,
          resultOutcome TEXT,
          resultPips REAL,
          deliveryDiagnosticsJson TEXT
        );
        CREATE INDEX idx_recommendation_messages_thread_status
          ON recommendationMessages(threadStatus, createdAt);
        CREATE INDEX idx_recommendationMessages_createdAt
          ON recommendationMessages(createdAt);
        CREATE TABLE schema_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_name TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          notes TEXT,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO recommendationMessages
          (id, userId, type, content, createdAt, parentId, threadStatus)
        VALUES
          (1, 10, 'recommendation', 'Open legacy', '2026-08-20 09:00:00', NULL, NULL),
          (2, 10, 'update', 'Update', '2026-08-20 09:01:00', 1, NULL),
          (3, 10, 'recommendation', 'Open with result', '2026-08-21 09:00:00', NULL, 'open'),
          (4, 10, 'result', 'Result one', '2026-08-21 09:01:00', 3, NULL),
          (5, 10, 'result', 'Legacy duplicate result', '2026-08-21 09:02:00', 3, NULL),
          (6, 10, 'recommendation', 'Closed', '2026-08-22 09:00:00', NULL, 'closed'),
          (7, 10, 'result', 'Closed result', '2026-08-22 09:01:00', 6, NULL),
          (8, 10, 'update', 'Orphan legacy child', '2026-08-22 09:02:00', 999, NULL);
      `);

      const before = database.prepare(summarySql).get();
      const beforeCount = database
        .prepare("SELECT COUNT(*) AS count FROM recommendationMessages")
        .get();

      database.exec(migrationSql);
      database.exec(migrationSql);
      database.exec(schemaMigrationRecordSql);
      database.exec(schemaMigrationRecordSql);

      expect(database.prepare(summarySql).get()).toEqual(before);
      expect(
        database.prepare("SELECT COUNT(*) AS count FROM recommendationMessages").get(),
      ).toEqual(beforeCount);
      expect(
        database.prepare(`
          SELECT migration_name, source, notes
          FROM schema_migrations
        `).get(),
      ).toEqual({
        migration_name: "091_recommendation_message_thread_index.sql",
        source: "codex_wrangler",
        notes: "Add non-unique recommendation parent/type/order index",
      });

      const planDetails = (sql: string, ...params: unknown[]) => database
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row: { detail: string }) => row.detail)
        .join("\n");

      const summaryPlan = planDetails(summarySql);
      expect(summaryPlan).toContain(
        "idx_recommendation_messages_parent_type_created_id",
      );
      expect(summaryPlan).not.toContain("SCAN child");

      const rootsPlan = planDetails(openRootsSql, "recommendation", "closed");
      expect(rootsPlan).toContain(
        "idx_recommendation_messages_parent_type_created_id",
      );
      expect(rootsPlan).not.toContain("SCAN recommendationMessages");

      const childrenPlan = planDetails(`
        SELECT id, type, content
        FROM recommendationMessages
        WHERE parentId IN (?, ?)
      `, 1, 3);
      expect(childrenPlan).toContain(
        "idx_recommendation_messages_parent_type_created_id",
      );
      expect(childrenPlan).not.toContain("SCAN recommendationMessages");
    } finally {
      database.close();
    }
  });
});
