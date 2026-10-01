import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  RAW_DATA_RETENTION_DEFAULT_BATCH_LIMIT,
  RAW_DATA_RETENTION_DEFAULT_RETENTION_DAYS,
  RAW_DATA_RETENTION_MIN_RETENTION_DAYS,
  buildRawDataRetentionCandidateQuery,
  prepareRawDataRetentionRollupsWithDatabase,
  runRawDataRetentionMaintenanceWithDatabase,
  type RawDataRetentionTableName,
} from "../backend/db";

const retentionIndexMigrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../database/migrations/126_raw_data_retention_indexes.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const retentionRollupMigrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../database/migrations/127_raw_data_retention_rollups.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const schemaSource = readFileSync(
  fileURLToPath(new URL("../database/schema-sqlite.ts", import.meta.url)),
  "utf8",
);

const workerSource = readFileSync(
  fileURLToPath(new URL("../backend/_core/worker.ts", import.meta.url)),
  "utf8",
);

const workerConfig = readFileSync(
  fileURLToPath(new URL("../wrangler-worker.toml", import.meta.url)),
  "utf8",
);

const DDL = `
  CREATE TABLE schema_migrations (
    migration_name TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    notes TEXT,
    applied_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE engagement_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    metadata TEXT,
    created_at TEXT NOT NULL
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
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_email_delivery_logs_created_id
    ON email_delivery_logs(created_at, id);

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
    batch_id TEXT,
    email_sent INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT,
    created_at TEXT NOT NULL
  );
`;

function setupDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    ${DDL}
    ${retentionIndexMigrationSql}
    ${retentionIndexMigrationSql}
    ${retentionRollupMigrationSql}
    ${retentionRollupMigrationSql}
  `);

  sqlite.prepare(`
    INSERT INTO engagement_events (user_id, event_type, created_at)
    VALUES (?, ?, ?)
  `).run(1, "page_view", "2026-06-01T00:00:00.000Z");
  sqlite.prepare(`
    INSERT INTO engagement_events (user_id, event_type, created_at)
    VALUES (?, ?, ?)
  `).run(1, "course_start", "2026-06-02T00:00:00.000Z");
  sqlite.prepare(`
    INSERT INTO engagement_events (user_id, event_type, created_at)
    VALUES (?, ?, ?)
  `).run(1, "page_view", "2026-08-01T00:00:00.000Z");

  sqlite.prepare(`
    INSERT INTO email_delivery_logs
      (recipient_email, event_type, subject, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run("old@example.com", "admin_bulk_notification", "Old", "sent", "2026-06-03T00:00:00.000Z");
  sqlite.prepare(`
    INSERT INTO email_delivery_logs
      (recipient_email, event_type, subject, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run("recent@example.com", "login_code", "Recent", "sent", "2026-08-03T00:00:00.000Z");

  sqlite.prepare(`
    INSERT INTO user_notifications
      (user_id, title_en, title_ar, is_read, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(1, "Old unread", "قديم غير مقروء", 0, "2026-06-04T00:00:00.000Z");
  sqlite.prepare(`
    INSERT INTO user_notifications
      (user_id, title_en, title_ar, is_read, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(2, "Old read", "قديم مقروء", 1, "2026-06-05T00:00:00.000Z");
  sqlite.prepare(`
    INSERT INTO user_notifications
      (user_id, title_en, title_ar, is_read, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(3, "Recent", "حديث", 0, "2026-08-05T00:00:00.000Z");

  return sqlite;
}

function explainPlan(database: Database.Database, table: RawDataRetentionTableName) {
  const query = buildRawDataRetentionCandidateQuery(drizzle(database), {
    table,
    cutoffIso: "2026-07-02T00:00:00.000Z",
    limit: 50,
  });
  const compiled = query.toSQL();
  return database
    .prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
    .all(...compiled.params)
    .map((row: any) => String(row.detail))
    .join("\n");
}

describe("raw data retention maintenance", () => {
  it("keeps the index migration additive, idempotent, non-unique, and data preserving", () => {
    const statementsOnly = retentionIndexMigrationSql
      .replace(/^--.*$/gm, "")
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+schema_migrations[\s\S]*?\);\s*/im, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im,
    );
    expect(retentionIndexMigrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(2);
    expect(retentionIndexMigrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
    expect(schemaSource).toContain("idx_engagement_events_created_id");
    expect(schemaSource).toContain("idx_user_notifications_retention_created_id");
  });

  it("keeps the rollup migration additive and modeled in schema", () => {
    const statementsOnly = retentionRollupMigrationSql
      .replace(/^--.*$/gm, "")
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+schema_migrations[\s\S]*?\);\s*/im, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER\b|DROP\b|DELETE\b|UPDATE\b|INSERT\s+(?!INTO\s+raw_retention_))/im,
    );
    expect(retentionRollupMigrationSql.match(/CREATE TABLE IF NOT EXISTS raw_retention_/g))
      .toHaveLength(3);
    expect(retentionRollupMigrationSql.match(/CREATE INDEX IF NOT EXISTS idx_raw_retention_/g))
      .toHaveLength(3);
    expect(schemaSource).toContain("rawRetentionEngagementDailyRollups");
    expect(schemaSource).toContain("rawRetentionEmailDailyRollups");
    expect(schemaSource).toContain("rawRetentionNotificationDailyRollups");
  });

  it("uses retention indexes for bounded candidate selection", () => {
    const sqlite = setupDatabase();
    try {
      expect(explainPlan(sqlite, "engagement_events"))
        .toContain("idx_engagement_events_created_id");
      expect(explainPlan(sqlite, "email_delivery_logs"))
        .toContain("idx_email_delivery_logs_created_id");
      expect(explainPlan(sqlite, "user_notifications"))
        .toContain("idx_user_notifications_retention_created_id");
      expect(explainPlan(sqlite, "engagement_events")).not.toContain("SCAN engagement_events");
      expect(explainPlan(sqlite, "user_notifications")).not.toContain("SCAN user_notifications");
    } finally {
      sqlite.close();
    }
  });

  it("defaults to a bounded dry run that reports eligible rows without deleting", async () => {
    const sqlite = setupDatabase();
    try {
      const result = await runRawDataRetentionMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-30T00:00:00.000Z",
        limit: 1,
      });

      expect(result).toEqual({
        dryRun: true,
        cutoffIso: "2026-07-02T00:00:00.000Z",
        retentionDays: RAW_DATA_RETENTION_DEFAULT_RETENTION_DAYS,
        limit: 1,
        tables: [
          {
            table: "engagement_events",
            limit: 1,
            eligibleCount: 2,
            candidateCount: 1,
            rollupBucketCount: 2,
            projectedDeleteCount: 1,
            estimatedBatches: 2,
            deletedCount: 0,
          },
          {
            table: "email_delivery_logs",
            limit: 1,
            eligibleCount: 1,
            candidateCount: 1,
            rollupBucketCount: 1,
            projectedDeleteCount: 1,
            estimatedBatches: 1,
            deletedCount: 0,
          },
          {
            table: "user_notifications",
            limit: 1,
            eligibleCount: 2,
            candidateCount: 1,
            rollupBucketCount: 2,
            projectedDeleteCount: 1,
            estimatedBatches: 2,
            deletedCount: 0,
          },
        ],
        totals: {
          eligibleCount: 5,
          candidateCount: 3,
          rollupBucketCount: 5,
          projectedDeleteCount: 3,
          deletedCount: 0,
        },
      });

      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM engagement_events").get())
        .toEqual({ count: 3 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM email_delivery_logs").get())
        .toEqual({ count: 2 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM user_notifications").get())
        .toEqual({ count: 3 });
      expect(sqlite.prepare(`
        SELECT COUNT(*) AS unreadOld
        FROM user_notifications
        WHERE is_read = 0 AND created_at < '2026-07-02T00:00:00.000Z'
      `).get()).toEqual({ unreadOld: 1 });
    } finally {
      sqlite.close();
    }
  });

  it("prepares idempotent rollups before any raw deletion capability exists", async () => {
    const sqlite = setupDatabase();
    try {
      const db = drizzle(sqlite);
      const first = await prepareRawDataRetentionRollupsWithDatabase(db, {
        cutoffIso: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-09-30T00:00:00.000Z",
      });
      const second = await prepareRawDataRetentionRollupsWithDatabase(db, {
        cutoffIso: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-09-30T01:00:00.000Z",
      });

      expect(first).toMatchObject({
        cutoffIso: "2026-07-02T00:00:00.000Z",
        totalRollupBucketCount: 5,
      });
      expect(second).toMatchObject({
        cutoffIso: "2026-07-02T00:00:00.000Z",
        totalRollupBucketCount: 5,
      });

      expect(sqlite.prepare(`
        SELECT local_date, event_type, entity_type, event_count, unique_user_count,
               first_event_at, last_event_at, updated_at
        FROM raw_retention_engagement_daily_rollups
        ORDER BY local_date, event_type
      `).all()).toEqual([
        {
          local_date: "2026-06-01",
          event_type: "page_view",
          entity_type: "",
          event_count: 1,
          unique_user_count: 1,
          first_event_at: "2026-06-01T00:00:00.000Z",
          last_event_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-09-30T01:00:00.000Z",
        },
        {
          local_date: "2026-06-02",
          event_type: "course_start",
          entity_type: "",
          event_count: 1,
          unique_user_count: 1,
          first_event_at: "2026-06-02T00:00:00.000Z",
          last_event_at: "2026-06-02T00:00:00.000Z",
          updated_at: "2026-09-30T01:00:00.000Z",
        },
      ]);
      expect(sqlite.prepare(`
        SELECT local_date, event_type, status, provider, email_count
        FROM raw_retention_email_daily_rollups
      `).all()).toEqual([{
        local_date: "2026-06-03",
        event_type: "admin_bulk_notification",
        status: "sent",
        provider: "",
        email_count: 1,
      }]);
      expect(sqlite.prepare(`
        SELECT local_date, type, is_read, email_sent, notification_count
        FROM raw_retention_notification_daily_rollups
        ORDER BY local_date, is_read
      `).all()).toEqual([
        {
          local_date: "2026-06-04",
          type: "info",
          is_read: 0,
          email_sent: 0,
          notification_count: 1,
        },
        {
          local_date: "2026-06-05",
          type: "info",
          is_read: 1,
          email_sent: 0,
          notification_count: 1,
        },
      ]);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM engagement_events").get())
        .toEqual({ count: 3 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM email_delivery_logs").get())
        .toEqual({ count: 2 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM user_notifications").get())
        .toEqual({ count: 3 });
    } finally {
      sqlite.close();
    }
  });

  it("rolls up first and deletes only bounded candidates when explicitly enabled", async () => {
    const sqlite = setupDatabase();
    try {
      const result = await runRawDataRetentionMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-30T00:00:00.000Z",
        dryRun: false,
        tableLimits: {
          engagement_events: 1,
          email_delivery_logs: 1,
          user_notifications: 1,
        },
      });

      expect(result).toMatchObject({
        dryRun: false,
        totals: {
          eligibleCount: 5,
          candidateCount: 3,
          rollupBucketCount: 5,
          projectedDeleteCount: 3,
          deletedCount: 3,
        },
      });
      expect(result.tables.map((table) => ({
        table: table.table,
        limit: table.limit,
        deletedCount: table.deletedCount,
      }))).toEqual([
        { table: "engagement_events", limit: 1, deletedCount: 1 },
        { table: "email_delivery_logs", limit: 1, deletedCount: 1 },
        { table: "user_notifications", limit: 1, deletedCount: 1 },
      ]);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM engagement_events").get())
        .toEqual({ count: 2 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM email_delivery_logs").get())
        .toEqual({ count: 1 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM user_notifications").get())
        .toEqual({ count: 2 });
      expect(sqlite.prepare(`
        SELECT COALESCE(SUM(event_count), 0) AS preserved FROM raw_retention_engagement_daily_rollups
      `).get()).toEqual({ preserved: 2 });
      expect(sqlite.prepare(`
        SELECT COALESCE(SUM(email_count), 0) AS preserved FROM raw_retention_email_daily_rollups
      `).get()).toEqual({ preserved: 1 });
      expect(sqlite.prepare(`
        SELECT COALESCE(SUM(notification_count), 0) AS preserved FROM raw_retention_notification_daily_rollups
      `).get()).toEqual({ preserved: 2 });
    } finally {
      sqlite.close();
    }
  });

  it("validates retention windows, batch limits, and worker safety gates", async () => {
    const sqlite = setupDatabase();
    try {
      await expect(runRawDataRetentionMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-30T00:00:00.000Z",
        retentionDays: RAW_DATA_RETENTION_MIN_RETENTION_DAYS - 1,
      })).rejects.toThrow("between 30 and 3650 days");
      await expect(runRawDataRetentionMaintenanceWithDatabase(drizzle(sqlite), {
        nowIso: "2026-09-30T00:00:00.000Z",
        limit: 501,
      })).rejects.toThrow("between 1 and 500");
    } finally {
      sqlite.close();
    }

    expect(RAW_DATA_RETENTION_DEFAULT_BATCH_LIMIT).toBe(50);
    expect(workerSource).toContain('env.RAW_DATA_RETENTION_ENABLED !== "true"');
    expect(workerSource).toContain('dryRun: env.RAW_DATA_RETENTION_DRY_RUN !== "false"');
    expect(workerSource).toContain('const RAW_DATA_RETENTION_CRON = "30 23 * * *"');
    expect(workerSource).toContain("await runRawDataRetentionAutomation(env)");
    expect(workerSource.indexOf("controller.cron === RAW_DATA_RETENTION_CRON"))
      .toBeLessThan(workerSource.indexOf("controller.cron !== DAILY_MAINTENANCE_CRON"));
    expect(workerConfig.match(/RAW_DATA_RETENTION_ENABLED = "true"/g))
      .toHaveLength(1);
    expect(workerConfig.match(/RAW_DATA_RETENTION_ENABLED = "false"/g))
      .toHaveLength(2);
    expect(workerConfig.match(/RAW_DATA_RETENTION_DRY_RUN = "false"/g))
      .toHaveLength(1);
    expect(workerConfig.match(/RAW_DATA_RETENTION_DRY_RUN = "true"/g))
      .toHaveLength(2);
    expect(workerConfig.match(/RAW_DATA_RETENTION_DAYS = "90"/g))
      .toHaveLength(3);
    expect(workerConfig.match(/RAW_DATA_RETENTION_BATCH_LIMIT = "50"/g))
      .toHaveLength(3);
    expect(workerConfig).toContain('"30 23 * * *"');
    expect(workerConfig.match(/RAW_DATA_RETENTION_ENGAGEMENT_LIMIT = "100"/g))
      .toHaveLength(3);
    expect(workerConfig.match(/RAW_DATA_RETENTION_EMAIL_LIMIT = "50"/g))
      .toHaveLength(3);
    expect(workerConfig.match(/RAW_DATA_RETENTION_NOTIFICATION_LIMIT = "50"/g))
      .toHaveLength(3);
  });
});
