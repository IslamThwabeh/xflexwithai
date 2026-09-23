import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)),
  "utf8",
);
const migrationSql = readProjectFile("../database/migrations/125_recommendation_delivery_payload_normalization.sql");
const linkMigrationSql = readProjectFile("../database/migrations/126_recommendation_delivery_payload_links.sql");
const compactSql = readProjectFile("../database/maintenance/compact_recommendation_delivery_payloads_batch.sql");
const rehydrateSql = readProjectFile("../database/maintenance/rehydrate_recommendation_delivery_payloads_batch.sql");
const dbSource = readProjectFile("../backend/db.ts");

describe("recommendation delivery payload normalization", () => {
  it("preserves exact content and recipient audit state through compaction and rollback", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        CREATE TABLE schema_migrations (
          migration_name TEXT NOT NULL UNIQUE,
          source TEXT NOT NULL,
          notes TEXT,
          applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE recommendation_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventKey TEXT NOT NULL,
          language TEXT NOT NULL,
          userId INTEGER NOT NULL,
          status TEXT NOT NULL,
          providerRequestId TEXT,
          providerBatchKey TEXT,
          subject TEXT,
          bodyText TEXT,
          bodyHtml TEXT,
          metadataJson TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        INSERT INTO recommendation_deliveries
          (eventKey, language, userId, status, providerRequestId, providerBatchKey,
           subject, bodyText, bodyHtml, metadataJson, createdAt, updatedAt)
        VALUES
          ('rec_msg:1', 'ar', 10, 'sent', 'provider-1', 'batch-1',
           'AR', 'Arabic', '<p>Arabic</p>', '{"batchId":"rec_live_1"}', '2026-09-01', '2026-09-02'),
          ('rec_msg:1', 'ar', 11, 'skipped', NULL, 'batch-1',
           'AR', 'Arabic', '<p>Arabic</p>', '{"batchId":"rec_live_1"}', '2026-09-01', '2026-09-03'),
          ('rec_msg:1', 'en', 12, 'dead_letter', NULL, 'batch-2',
           'EN', 'English', '<p>English</p>', '{"batchId":"rec_live_1"}', '2026-09-01', '2026-09-04');
      `);
      const original = database.prepare(`
        SELECT id, userId, status, providerRequestId, providerBatchKey,
               subject, bodyText, bodyHtml, metadataJson
        FROM recommendation_deliveries ORDER BY id
      `).all();

      database.exec(migrationSql);
      database.exec(migrationSql);
      database.exec(linkMigrationSql);
      expect(database.prepare("SELECT COUNT(*) AS count FROM recommendation_delivery_payloads").get()).toEqual({ count: 2 });
      expect(database.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE migration_name = '125_recommendation_delivery_payload_normalization.sql'").get()).toEqual({ count: 1 });

      database.exec(compactSql);
      expect(database.prepare(`
        SELECT COUNT(*) AS count FROM recommendation_deliveries
        WHERE subject IS NOT NULL OR bodyText IS NOT NULL OR bodyHtml IS NOT NULL OR metadataJson IS NOT NULL
      `).get()).toEqual({ count: 0 });
      const hydrated = database.prepare(`
        SELECT delivery.id, delivery.userId, delivery.status, delivery.providerRequestId,
               delivery.providerBatchKey, payload.subject, payload.bodyText,
               payload.bodyHtml, payload.metadataJson
        FROM recommendation_deliveries delivery
        INNER JOIN recommendation_delivery_payloads payload
          ON payload.id = delivery.payloadId
        ORDER BY delivery.id
      `).all();
      expect(hydrated).toEqual(original);

      database.exec(rehydrateSql);
      expect(database.prepare(`
        SELECT id, userId, status, providerRequestId, providerBatchKey,
               subject, bodyText, bodyHtml, metadataJson
        FROM recommendation_deliveries ORDER BY id
      `).all()).toEqual(original);
    } finally {
      database.close();
    }
  });

  it("keeps dual-read compatibility and bounds destructive maintenance", () => {
    expect(dbSource).toContain("hydrateRecommendationDeliveryPayloads");
    expect(dbSource).toContain("subject: payload.subject ?? row.subject");
    expect(dbSource).toContain("subject: null");
    expect(compactSql).toContain("LIMIT 500");
    expect(compactSql).not.toMatch(/\bDELETE\b/i);
    expect(rehydrateSql).toContain("LIMIT 500");
  });
});
