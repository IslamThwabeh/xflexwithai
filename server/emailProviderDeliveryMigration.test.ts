import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  fileURLToPath(new URL("../database/migrations/123_email_provider_delivery_lifecycle.sql", import.meta.url)),
  "utf8",
);

describe("email provider delivery lifecycle migration", () => {
  it("adds correlation and projection fields and repairs literal timestamps", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE schema_migrations (
        migration_name TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        notes TEXT,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO schema_migrations (migration_name, source, applied_at)
      VALUES ('088_email_delivery_and_support_assignment.sql', 'test', '2026-08-18 08:53:09');
      CREATE TABLE email_delivery_logs (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        provider_request_id TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO email_delivery_logs VALUES (1, 'zeptomail', 'request-1', 'CURRENT_TIMESTAMP');
      CREATE TABLE email_provider_webhook_events (
        id INTEGER PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        provider_request_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        recipient_email TEXT,
        diagnostic TEXT,
        event_at TEXT,
        matched_log_count INTEGER NOT NULL DEFAULT 0,
        received_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    database.exec(migrationSql);

    expect(database.prepare("SELECT created_at FROM email_delivery_logs WHERE id = 1").get())
      .toEqual({ created_at: "2026-08-18 08:53:09" });
    expect(database.prepare("PRAGMA table_info(email_delivery_logs)").all())
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: "provider_client_reference" })]));
    expect(database.prepare("PRAGMA table_info(email_provider_webhook_events)").all())
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "provider_client_reference" }),
        expect.objectContaining({ name: "delivery_status" }),
        expect.objectContaining({ name: "projected_log_count" }),
      ]));
    expect(database.prepare(`
      SELECT COUNT(*) AS count FROM schema_migrations
      WHERE migration_name = '123_email_provider_delivery_lifecycle.sql'
    `).get()).toEqual({ count: 1 });
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
    database.close();
  });
});
