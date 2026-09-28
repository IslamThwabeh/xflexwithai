import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../database/migrations/125_lexai_course_hot_path_indexes.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const schemaSource = readFileSync(
  fileURLToPath(new URL("../database/schema-sqlite.ts", import.meta.url)),
  "utf8",
);

const productionShapedSql = `
  CREATE TABLE schema_migrations (
    migration_name TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    notes TEXT,
    applied_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE lexaiMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    subscriptionId INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    imageUrl TEXT,
    analysisType TEXT,
    confidence INTEGER,
    apiRequestId TEXT,
    apiStatus TEXT DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId INTEGER NOT NULL,
    titleEn TEXT NOT NULL,
    titleAr TEXT NOT NULL,
    descriptionEn TEXT,
    descriptionAr TEXT,
    videoUrl TEXT,
    duration INTEGER,
    "order" INTEGER NOT NULL,
    isFree INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function explainPlan(database: Database.Database, sql: string, ...params: unknown[]) {
  return database
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((row: any) => String(row.detail))
    .join("\n");
}

describe("LexAI and course hot-path indexes", () => {
  it("keeps the migration additive, idempotent, and non-unique", () => {
    const statementsOnly = migrationSql
      .replace(/^--.*$/gm, "")
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+schema_migrations[\s\S]*?codex_local_release'[\s\S]*?\);\s*/im, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im,
    );
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(2);
    expect(migrationSql).toContain("INSERT OR IGNORE INTO schema_migrations");
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });

  it("models the new indexes in the Drizzle schema", () => {
    expect(schemaSource).toContain("idx_lexai_messages_user_created_id");
    expect(schemaSource).toContain("idx_episodes_course_order_id");
  });

  it("keeps runtime query orderings aligned with the indexes", () => {
    const lexaiSection = backendSource.slice(
      backendSource.indexOf("export async function getUserLexaiMessages"),
      backendSource.indexOf("export async function createLexaiMessage"),
    );
    const episodeSection = backendSource.slice(
      backendSource.indexOf("export async function getEpisodesByCourseId"),
      backendSource.indexOf("export async function getEpisodeById"),
    );

    expect(lexaiSection).toContain(".orderBy(desc(lexaiMessages.createdAt), desc(lexaiMessages.id))");
    expect(episodeSection).toContain(".orderBy(episodes.order, episodes.id)");
  });

  it("gives LexAI history and episode listing indexed local query plans", () => {
    const database = new Database(":memory:");
    try {
      database.exec(`${productionShapedSql}${migrationSql}${migrationSql}`);

      const lexaiPlan = explainPlan(database, `
        SELECT id, userId, subscriptionId, role, content, imageUrl, analysisType,
          confidence, apiRequestId, apiStatus, createdAt
        FROM lexaiMessages
        WHERE userId = ?
        ORDER BY createdAt DESC, id DESC
        LIMIT 100
      `, 42);
      expect(lexaiPlan).toContain("idx_lexai_messages_user_created_id");
      expect(lexaiPlan).not.toContain("USE TEMP B-TREE");

      const episodePlan = explainPlan(database, `
        SELECT id, courseId, titleEn, titleAr, descriptionEn, descriptionAr,
          videoUrl, duration, "order", isFree, createdAt, updatedAt
        FROM episodes
        WHERE courseId = ?
        ORDER BY "order", id
      `, 7);
      expect(episodePlan).toContain("idx_episodes_course_order_id");
      expect(episodePlan).not.toContain("USE TEMP B-TREE");
    } finally {
      database.close();
    }
  });
});
