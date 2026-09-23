import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)),
  "utf8",
);
const payloadMigration = readProjectFile("../database/migrations/127_email_outbox_duplicate_payloads.sql");
const linkMigration = readProjectFile("../database/migrations/128_email_outbox_payload_links.sql");
const compactSql = readProjectFile("../database/maintenance/compact_email_outbox_payloads_batch.sql");
const rehydrateSql = readProjectFile("../database/maintenance/rehydrate_email_outbox_payloads_batch.sql");

describe("terminal email outbox duplicate-payload compaction", () => {
  it("compacts only exact terminal duplicates and preserves unique and active bodies", async () => {
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
        CREATE TABLE email_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventType TEXT NOT NULL,
          templateId TEXT,
          emailCategory TEXT,
          subject TEXT NOT NULL,
          bodyText TEXT NOT NULL,
          bodyHtml TEXT,
          metadataJson TEXT,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        INSERT INTO email_outbox
          (eventType, templateId, emailCategory, subject, bodyText, bodyHtml,
           metadataJson, status, createdAt, updatedAt)
        VALUES
          ('survey', 'survey', 'service', 'Shared', 'Same', '<p>Same</p>', '{"batch":1}', 'sent', '2026-09-01', '2026-09-02'),
          ('survey', 'survey', 'service', 'Shared', 'Same', '<p>Same</p>', '{"batch":1}', 'skipped_suppressed', '2026-09-01', '2026-09-03'),
          ('support', 'support', 'service', 'Unique', 'Private reply', '<p>Private</p>', NULL, 'sent', '2026-09-01', '2026-09-04'),
          ('survey', 'survey', 'service', 'Active', 'Do not move', '<p>Active</p>', NULL, 'pending', '2026-09-01', '2026-09-05');
      `);
      const original = database.prepare(`
        SELECT id, subject, bodyText, bodyHtml, metadataJson, status
        FROM email_outbox ORDER BY id
      `).all();

      database.exec(payloadMigration);
      database.exec(payloadMigration);
      database.exec(linkMigration);
      expect(database.prepare("SELECT COUNT(*) AS count FROM email_outbox_payloads").get()).toEqual({ count: 1 });
      expect(database.prepare("SELECT COUNT(*) AS count FROM email_outbox WHERE payloadId IS NOT NULL").get()).toEqual({ count: 2 });

      database.exec(compactSql);
      expect(database.prepare("SELECT subject, bodyText FROM email_outbox WHERE id=3").get()).toEqual({ subject: "Unique", bodyText: "Private reply" });
      expect(database.prepare("SELECT subject, bodyText FROM email_outbox WHERE id=4").get()).toEqual({ subject: "Active", bodyText: "Do not move" });
      expect(database.prepare("SELECT COUNT(*) AS count FROM email_outbox WHERE payloadId IS NOT NULL AND subject='' AND bodyText=''").get()).toEqual({ count: 2 });

      database.exec(rehydrateSql);
      expect(database.prepare(`
        SELECT id, subject, bodyText, bodyHtml, metadataJson, status
        FROM email_outbox ORDER BY id
      `).all()).toEqual(original);
    } finally {
      database.close();
    }
  });

  it("keeps both maintenance directions bounded and never deletes audit rows", () => {
    expect(compactSql).toContain("LIMIT 500");
    expect(rehydrateSql).toContain("LIMIT 500");
    expect(compactSql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(rehydrateSql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
