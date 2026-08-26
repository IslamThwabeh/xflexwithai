import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  buildRecommendationThreadSummaryQueries,
  readRecommendationThreadSummary,
} from "../backend/db";

const PRODUCTION_SHAPED_DDL = `
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
  CREATE INDEX idx_recommendation_messages_parent_type_created_id
    ON recommendationMessages(parentId, type, createdAt DESC, id DESC);
`;

const OLD_SUMMARY_SQL = `
  SELECT
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN 1 ELSE 0 END) AS total,
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND (threadStatus IS NULL OR threadStatus <> 'closed') THEN 1 ELSE 0 END) AS open,
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND (threadStatus IS NULL OR threadStatus <> 'closed')
      AND NOT EXISTS (
        SELECT 1 FROM recommendationMessages child
        WHERE child.parentId = recommendationMessages.id
          AND child.type = 'result'
      ) THEN 1 ELSE 0 END) AS needsResult,
    SUM(CASE WHEN parentId IS NULL AND type = 'recommendation'
      AND threadStatus = 'closed' THEN 1 ELSE 0 END) AS closed,
    SUM(CASE WHEN parentId IS NOT NULL AND type = 'result' THEN 1 ELSE 0 END) AS resultMessages,
    SUM(CASE WHEN parentId IS NOT NULL AND type = 'update' THEN 1 ELSE 0 END) AS updateMessages,
    MIN(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN createdAt END) AS oldestRecommendationAt,
    MAX(CASE WHEN parentId IS NULL AND type = 'recommendation' THEN createdAt END) AS newestRecommendationAt
  FROM recommendationMessages
`;

function normalizeOldSummary(row: Record<string, unknown>) {
  return {
    total: Number(row.total ?? 0),
    open: Number(row.open ?? 0),
    needsResult: Number(row.needsResult ?? 0),
    closed: Number(row.closed ?? 0),
    resultMessages: Number(row.resultMessages ?? 0),
    updateMessages: Number(row.updateMessages ?? 0),
    oldestRecommendationAt: row.oldestRecommendationAt ?? null,
    newestRecommendationAt: row.newestRecommendationAt ?? null,
  };
}

function explain(
  database: Database.Database,
  query: { toSQL(): { sql: string; params: unknown[] } }
) {
  const compiled = query.toSQL();
  return database
    .prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
    .all(...compiled.params)
    .map((row: any) => String(row.detail))
    .join("\n");
}

describe("recommendation thread summary SQL contract", () => {
  it("matches the legacy summary for rich and empty production-shaped data", async () => {
    const database = new Database(":memory:");
    try {
      database.exec(PRODUCTION_SHAPED_DDL);
      const orm = drizzle(database);

      expect(await readRecommendationThreadSummary(orm)).toEqual(
        normalizeOldSummary(
          database.prepare(OLD_SUMMARY_SQL).get() as Record<string, unknown>
        )
      );

      database.exec(`
        INSERT INTO recommendationMessages
          (id, userId, type, content, createdAt, parentId, threadStatus)
        VALUES
          (1, 10, 'recommendation', 'Open legacy', '2026-08-20 09:00:00', NULL, NULL),
          (2, 10, 'update', 'Update', '2026-08-20 09:01:00', 1, NULL),
          (3, 10, 'recommendation', 'Open with results', '2026-08-21 09:00:00', NULL, 'open'),
          (4, 10, 'result', 'Result one', '2026-08-21 09:01:00', 3, NULL),
          (5, 10, 'result', 'Duplicate legacy result', '2026-08-21 09:02:00', 3, NULL),
          (6, 10, 'recommendation', 'Closed', '2026-08-22 09:00:00', NULL, 'closed'),
          (7, 10, 'result', 'Closed result', '2026-08-22 09:01:00', 6, NULL),
          (8, 10, 'update', 'Orphan update', '2026-08-22 09:02:00', 999, NULL),
          (9, 10, 'result', 'Root result ignored', '2026-08-22 09:03:00', NULL, NULL),
          (10, 10, 'recommendation', 'Child recommendation ignored', '2026-08-22 09:04:00', 1, NULL),
          (11, 10, 'recommendation', 'Legacy status', '2026-08-23 09:00:00', NULL, 'legacy');
      `);

      const oldSummary = normalizeOldSummary(
        database.prepare(OLD_SUMMARY_SQL).get() as Record<string, unknown>
      );
      const newSummary = await readRecommendationThreadSummary(orm);
      expect(newSummary).toEqual(oldSummary);
      expect(newSummary).toEqual({
        total: 4,
        open: 3,
        needsResult: 2,
        closed: 1,
        resultMessages: 3,
        updateMessages: 2,
        oldestRecommendationAt: "2026-08-20 09:00:00",
        newestRecommendationAt: "2026-08-23 09:00:00",
      });
    } finally {
      database.close();
    }
  });

  it("searches the production index for both exact application queries", () => {
    const database = new Database(":memory:");
    try {
      database.exec(PRODUCTION_SHAPED_DDL);
      const queries = buildRecommendationThreadSummaryQueries(
        drizzle(database)
      );
      const rootPlan = explain(database, queries.roots);
      const childPlan = explain(database, queries.children);

      expect(rootPlan).toContain(
        "idx_recommendation_messages_parent_type_created_id"
      );
      expect(childPlan).toContain(
        "idx_recommendation_messages_parent_type_created_id"
      );
      expect(rootPlan).not.toContain("SCAN recommendationMessages");
      expect(childPlan).not.toContain("SCAN recommendationMessages");
      expect(rootPlan).not.toContain("SCAN child");
    } finally {
      database.close();
    }
  });
});
