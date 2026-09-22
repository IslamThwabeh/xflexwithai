import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyEmailDelivery } from "../shared/emailDeliveryClasses";

const migrationSql = readFileSync(
  fileURLToPath(new URL("../database/migrations/119_email_delivery_class_lanes.sql", import.meta.url)),
  "utf8",
);

function createPreMigrationDatabase() {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE email_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventType TEXT NOT NULL,
      emailCategory TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      nextAttemptAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE email_outbox_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventType TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE schema_migrations (
      migration_name TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      notes TEXT
    );
    INSERT INTO email_outbox (eventType, emailCategory, status, nextAttemptAt, createdAt) VALUES
      ('support_client_reply', 'transactional', 'pending', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
      ('timed_service_activation', 'transactional', 'pending', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
      ('student_community_post_published', 'marketing', 'pending', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z');
    INSERT INTO email_outbox_campaigns (eventType, status, createdAt)
      VALUES ('student_community_post_published', 'pending', '2026-09-22T00:00:00.000Z');
  `);
  return database;
}

describe("email delivery classes", () => {
  it("classifies known bulk and critical traffic and fails unknown transactional traffic toward urgent", () => {
    expect(classifyEmailDelivery({ eventType: "student_survey_reminder", emailCategory: "marketing" })).toBe("bulk");
    expect(classifyEmailDelivery({ eventType: "timed_service_activation", emailCategory: "transactional" })).toBe("critical");
    expect(classifyEmailDelivery({ eventType: "payment_confirmation", emailCategory: "transactional" })).toBe("critical");
    expect(classifyEmailDelivery({ eventType: "support_client_reply", emailCategory: "transactional" })).toBe("urgent");
    expect(classifyEmailDelivery({ eventType: "future_account_event", emailCategory: "transactional" })).toBe("urgent");
  });

  it("migrates independent databases consistently and uses the lane index for due claims", () => {
    for (let run = 0; run < 2; run += 1) {
      const database = createPreMigrationDatabase();
      database.exec(migrationSql);

      const rows = database.prepare(
        "SELECT eventType, deliveryClass FROM email_outbox ORDER BY id",
      ).all() as Array<{ eventType: string; deliveryClass: string }>;
      expect(rows).toEqual([
        { eventType: "support_client_reply", deliveryClass: "urgent" },
        { eventType: "timed_service_activation", deliveryClass: "critical" },
        { eventType: "student_community_post_published", deliveryClass: "bulk" },
      ]);

      const plan = database.prepare(`
        EXPLAIN QUERY PLAN
        SELECT id FROM email_outbox
        WHERE status IN ('pending', 'failed')
          AND deliveryClass IN ('critical', 'urgent')
          AND nextAttemptAt <= ?
        ORDER BY createdAt, id
        LIMIT 5
      `).all("2026-09-22T01:00:00.000Z") as Array<{ detail: string }>;
      expect(plan.map((entry) => entry.detail).join("\n"))
        .toContain("idx_email_outbox_status_class_due");
      expect(() => database.prepare(`
        INSERT INTO email_outbox (
          eventType, emailCategory, status, nextAttemptAt, createdAt, deliveryClass
        ) VALUES ('bad', 'transactional', 'pending', 'now', 'now', 'invalid')
      `).run()).toThrow();
      database.close();
    }
  });
});
