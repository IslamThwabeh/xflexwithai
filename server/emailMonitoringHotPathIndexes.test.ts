import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../database/migrations/124_email_monitoring_hot_path_indexes.sql",
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

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE email_delivery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_email TEXT NOT NULL,
    recipient_user_id INTEGER,
    event_type TEXT NOT NULL,
    template_id TEXT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT,
    provider_request_id TEXT,
    provider_client_reference TEXT,
    provider_event_name TEXT,
    provider_event_at TEXT,
    final_status_at TEXT,
    error_message TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupeKey TEXT NOT NULL UNIQUE,
    batchId TEXT,
    recipientUserId INTEGER,
    recipientEmail TEXT NOT NULL,
    eventType TEXT NOT NULL,
    deliveryClass TEXT NOT NULL DEFAULT 'urgent',
    templateId TEXT,
    emailCategory TEXT,
    subject TEXT NOT NULL,
    bodyText TEXT NOT NULL,
    bodyHtml TEXT,
    metadataJson TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt TEXT NOT NULL,
    lockedAt TEXT,
    provider TEXT,
    attemptedProviders TEXT,
    errorCategory TEXT,
    errorMessage TEXT,
    sentAt TEXT,
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

describe("email monitoring D1 hot-path indexes", () => {
  it("keeps the migration additive, idempotent, and non-unique", () => {
    const statementsOnly = migrationSql
      .replace(/^--.*$/gm, "")
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+schema_migrations[\s\S]*?codex_local_release'[\s\S]*?\);\s*/im, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im,
    );
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(4);
    expect(migrationSql).toContain("INSERT OR IGNORE INTO schema_migrations");
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });

  it("models the new indexes in the Drizzle schema", () => {
    expect(schemaSource).toContain("idx_email_delivery_logs_created_id");
    expect(schemaSource).toContain("idx_email_delivery_logs_status_created_id");
    expect(schemaSource).toContain("idx_email_delivery_logs_event_created_id");
    expect(schemaSource).toContain("idx_email_outbox_created_status");
  });

  it("removes the legacy timestamp CASE from delivery-log list ordering", () => {
    const listSection = backendSource.slice(
      backendSource.indexOf("export async function getEmailDeliveryLogs"),
      backendSource.indexOf("export async function getEmailDeliveryLogSummary"),
    );
    expect(listSection).toContain(".orderBy(desc(emailDeliveryLogs.createdAt), desc(emailDeliveryLogs.id))");
    expect(listSection).not.toContain("hasSortableTimestamp");
    expect(listSection).not.toContain("case when ${emailDeliveryLogs.createdAt} like");
  });

  it("gives the measured delivery-log and outbox summaries indexed plans", () => {
    const database = new Database(":memory:");
    try {
      database.exec(`${productionShapedSql}${migrationSql}${migrationSql}`);

      const newestListPlan = explainPlan(database, `
        SELECT email_delivery_logs.id
        FROM email_delivery_logs
        LEFT JOIN users ON email_delivery_logs.recipient_user_id = users.id
        WHERE email_delivery_logs.created_at >= ?
          AND email_delivery_logs.created_at <= ?
        ORDER BY email_delivery_logs.created_at DESC, email_delivery_logs.id DESC
        LIMIT 100
      `, "2026-09-22", "2026-09-28 23:59:59");
      expect(newestListPlan).toContain("idx_email_delivery_logs_created_id");
      expect(newestListPlan).not.toContain("USE TEMP B-TREE");

      const statusListPlan = explainPlan(database, `
        SELECT id
        FROM email_delivery_logs
        WHERE status = ?
          AND created_at >= ?
          AND created_at <= ?
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `, "delivered", "2026-09-22", "2026-09-28 23:59:59");
      expect(statusListPlan).toContain("idx_email_delivery_logs_status_created_id");
      expect(statusListPlan).not.toContain("USE TEMP B-TREE");

      const eventListPlan = explainPlan(database, `
        SELECT id
        FROM email_delivery_logs
        WHERE event_type = ?
          AND created_at >= ?
          AND created_at <= ?
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `, "support_client_reply", "2026-09-22", "2026-09-28 23:59:59");
      expect(eventListPlan).toContain("idx_email_delivery_logs_event_created_id");
      expect(eventListPlan).not.toContain("USE TEMP B-TREE");

      const summaryPlan = explainPlan(database, `
        SELECT count(*),
          sum(case when status = 'sent' then 1 else 0 end),
          sum(case when status = 'delivered' then 1 else 0 end)
        FROM email_delivery_logs
        LEFT JOIN users ON email_delivery_logs.recipient_user_id = users.id
        WHERE email_delivery_logs.created_at >= ?
          AND email_delivery_logs.created_at <= ?
      `, "2026-09-22", "2026-09-28 23:59:59");
      expect(summaryPlan).toContain("idx_email_delivery_logs_created_id");

      const outboxStatsPlan = explainPlan(database, `
        SELECT status, count(*)
        FROM email_outbox
        WHERE createdAt >= ?
        GROUP BY status
      `, "2026-09-28T00:00:00.000Z");
      expect(outboxStatsPlan).toContain("idx_email_outbox_created_status");
    } finally {
      database.close();
    }
  });
});
