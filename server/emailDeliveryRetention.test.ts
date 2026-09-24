import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const migration = read("../database/migrations/129_email_delivery_retention.sql");
const maintenance = read("../database/maintenance/email_delivery_retention_batch.sql");
const worker = read("../backend/_core/worker.ts");

describe("email delivery 7/30/180-day retention", () => {
  it("aggregates first, compacts details, and preserves exceptional/security evidence", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const db = new Database(":memory:");
    try {
      db.exec(`CREATE TABLE schema_migrations(migration_name TEXT UNIQUE,source TEXT,notes TEXT);
        CREATE TABLE email_delivery_logs(id INTEGER PRIMARY KEY,event_type TEXT,status TEXT,provider TEXT,subject TEXT NOT NULL,error_message TEXT,metadata TEXT,created_at TEXT);
        CREATE TABLE email_provider_webhook_events(id INTEGER PRIMARY KEY,delivery_status TEXT,diagnostic TEXT,received_at TEXT);
        INSERT INTO email_delivery_logs VALUES
          (1,'newsletter','sent','zeptomail','old','err','{}',datetime('now','-40 days')),
          (2,'support','bounced_hard','zeptomail','bounce','err','{}',datetime('now','-40 days')),
          (3,'login_otp','sent','zeptomail','security','err','{}',datetime('now','-40 days')),
          (4,'support','sent','zeptomail','detail','err','{}',datetime('now','-8 days'));
        INSERT INTO email_provider_webhook_events VALUES
          (1,'delivered','diagnostic',datetime('now','-40 days')),
          (2,'complained','complaint',datetime('now','-40 days'));
      `);
      db.exec(migration);
      expect(db.prepare("SELECT SUM(total) AS total FROM email_delivery_daily_aggregates").get()).toEqual({ total: 4 });
      db.exec(maintenance);
      expect(db.prepare("SELECT COUNT(*) AS total FROM email_delivery_logs").get()).toEqual({ total: 3 });
      expect(db.prepare("SELECT COUNT(*) AS total FROM email_delivery_logs WHERE id IN (2,3)").get()).toEqual({ total: 2 });
      expect(db.prepare("SELECT subject,error_message,metadata FROM email_delivery_logs WHERE id=4").get()).toEqual({ subject: "", error_message: null, metadata: null });
      expect(db.prepare("SELECT COUNT(*) AS total FROM email_provider_webhook_events").get()).toEqual({ total: 1 });
      expect(db.prepare("SELECT diagnostic FROM email_provider_webhook_events WHERE id=2").get()).toEqual({ diagnostic: null });
    } finally { db.close(); }
  });

  it("is bounded, leaves suppressions alone, and runs only in daily maintenance", () => {
    expect(maintenance.match(/LIMIT 500/g)).toHaveLength(6);
    expect(maintenance).not.toContain("email_suppressions");
    expect(worker).toContain("await db.runEmailDeliveryRetention()");
  });
});
