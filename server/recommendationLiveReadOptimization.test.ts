import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  fileURLToPath(new URL("../database/migrations/124_recommendation_live_read_indexes.sql", import.meta.url)),
  "utf8",
);
const dbSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const legacyOpenRootsSql = `
  SELECT id, content, createdAt
  FROM recommendationMessages
  WHERE parentId IS NULL
    AND type = ?
    AND (threadStatus IS NULL OR threadStatus <> ?)
  ORDER BY createdAt DESC, id DESC
`;

const optimizedOpenRootsSql = `
  SELECT id, content, createdAt
  FROM recommendationMessages
  WHERE parentId IS NULL
    AND type = ?
    AND COALESCE(threadStatus, 'open') = 'open'
  ORDER BY createdAt DESC, id DESC
`;

describe("recommendation live-read optimization", () => {
  it("adds only idempotent, non-unique indexes and preserves exact live results", async () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im);
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(2);
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);

    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        CREATE TABLE recommendationMessages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          parentId INTEGER,
          threadStatus TEXT,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE recommendationAlerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          analystUserId INTEGER NOT NULL,
          notifiedAt TEXT NOT NULL,
          expiresAt TEXT NOT NULL,
          status TEXT NOT NULL
        );
        INSERT INTO recommendationMessages
          (id, userId, type, content, parentId, threadStatus, createdAt)
        VALUES
          (1, 10, 'recommendation', 'legacy open', NULL, NULL, '2026-09-20T09:00:00.000Z'),
          (2, 10, 'recommendation', 'open', NULL, 'open', '2026-09-21T09:00:00.000Z'),
          (3, 10, 'recommendation', 'closed', NULL, 'closed', '2026-09-22T09:00:00.000Z'),
          (4, 10, 'update', 'child', 2, NULL, '2026-09-21T09:01:00.000Z');
        INSERT INTO recommendationAlerts
          (analystUserId, notifiedAt, expiresAt, status)
        VALUES
          (10, '2026-09-23T09:00:00.000Z', '2026-09-23T12:00:00.000Z', 'pending'),
          (11, '2026-09-22T09:00:00.000Z', '2026-09-22T12:00:00.000Z', 'cancelled');
      `);

      const before = database.prepare(legacyOpenRootsSql).all("recommendation", "closed");
      database.exec(migrationSql);
      database.exec(migrationSql);
      const after = database.prepare(optimizedOpenRootsSql).all("recommendation");
      expect(after).toEqual(before);

      const openPlan = database
        .prepare(`EXPLAIN QUERY PLAN ${optimizedOpenRootsSql}`)
        .all("recommendation")
        .map((row: { detail: string }) => row.detail)
        .join("\n");
      expect(openPlan).toContain("idx_recommendation_messages_open_roots");
      expect(openPlan).not.toContain("SCAN recommendationMessages");

      const alertPlan = database
        .prepare(`EXPLAIN QUERY PLAN
          SELECT id, analystUserId, notifiedAt, expiresAt, status
          FROM recommendationAlerts
          WHERE status = ? AND expiresAt > ?
          ORDER BY notifiedAt DESC
        `)
        .all("pending", "2026-09-23T10:00:00.000Z")
        .map((row: { detail: string }) => row.detail)
        .join("\n");
      expect(alertPlan).toContain("idx_recommendation_alerts_status_expiry_notified");
      expect(alertPlan).not.toContain("SCAN recommendationAlerts");
    } finally {
      database.close();
    }
  });

  it("removes the root re-read and keeps the monthly cutoff indexable", () => {
    const section = dbSource.slice(
      dbSource.indexOf("export async function getOpenRecommendationMessagesFeed"),
      dbSource.indexOf("export async function setRecommendationReaction"),
    );
    expect(section).toContain("const rootMessages = await db");
    expect(section).toContain("COALESCE(${recommendationMessages.threadStatus}, 'open') = 'open'");
    expect(section).not.toContain("const openRoots = await db");
    expect(section).not.toContain("collectChunkedRows(rootIds, (chunk) => db\n    .select()\n    .from(recommendationMessages)\n    .where(inArray(recommendationMessages.id, chunk))");

    const reportSection = dbSource.slice(
      dbSource.indexOf("export async function getRecommendationMonthlyTradeReport"),
      dbSource.indexOf("export async function getRecommendationThreadMessagesFeed"),
    );
    expect(reportSection).toContain("lt(recommendationMessages.createdAt, periodEnd)");
    expect(reportSection).not.toContain("datetime(${recommendationMessages.createdAt}) < datetime(${periodEnd})");
  });
});
