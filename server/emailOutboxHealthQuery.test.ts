import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { buildEmailOutboxAnomalyQueries } from "../backend/db";

const EMAIL_OUTBOX_PRODUCTION_SHAPED_DDL = `
  CREATE TABLE email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupeKey TEXT NOT NULL UNIQUE,
    batchId TEXT,
    recipientUserId INTEGER,
    recipientEmail TEXT NOT NULL,
    eventType TEXT NOT NULL,
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

  CREATE INDEX idx_email_outbox_status_next_attempt
    ON email_outbox(status, nextAttemptAt);

  CREATE INDEX idx_email_outbox_batch
    ON email_outbox(batchId);
`;

function insertOutboxRow(
  database: Database.Database,
  input: { dedupeKey: string; status: string; nextAttemptAt: string },
) {
  database.prepare(`
    INSERT INTO email_outbox (
      dedupeKey,
      recipientEmail,
      eventType,
      subject,
      bodyText,
      status,
      nextAttemptAt
    ) VALUES (?, 'client@example.com', 'support_client_reply', 'Subject', 'Body', ?, ?)
  `).run(input.dedupeKey, input.status, input.nextAttemptAt);
}

function explainPlan(
  database: Database.Database,
  query: { toSQL(): { sql: string; params: unknown[] } },
) {
  const compiled = query.toSQL();
  return database
    .prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
    .all(...compiled.params)
    .map((row: any) => String(row.detail))
    .join("\n");
}

describe("email outbox anomaly SQL contract", () => {
  it("uses production physical columns and valid SQLite/D1-compatible SQL", async () => {
    const database = new Database(":memory:");
    try {
      database.exec(EMAIL_OUTBOX_PRODUCTION_SHAPED_DDL);
      const orm = drizzle(database);
      const cutoff = "2026-08-24T12:00:00.000Z";

      insertOutboxRow(database, {
        dedupeKey: "sent-before-cutoff",
        status: "sent",
        nextAttemptAt: "2026-08-24T11:00:00.000Z",
      });
      let queries = buildEmailOutboxAnomalyQueries(orm, cutoff);
      expect(await queries.staleDue).toEqual([]);
      expect(await queries.deadLetter).toEqual([]);

      insertOutboxRow(database, {
        dedupeKey: "pending-after-cutoff",
        status: "pending",
        nextAttemptAt: "2026-08-24T13:00:00.000Z",
      });
      queries = buildEmailOutboxAnomalyQueries(orm, cutoff);
      expect(await queries.staleDue).toEqual([]);

      insertOutboxRow(database, {
        dedupeKey: "pending-before-cutoff",
        status: "pending",
        nextAttemptAt: "2026-08-24T11:59:59.000Z",
      });
      queries = buildEmailOutboxAnomalyQueries(orm, cutoff);
      expect(await queries.staleDue).toHaveLength(1);

      insertOutboxRow(database, {
        dedupeKey: "dead-letter",
        status: "dead_letter",
        nextAttemptAt: "2026-08-24T14:00:00.000Z",
      });
      queries = buildEmailOutboxAnomalyQueries(orm, cutoff);
      expect(await queries.deadLetter).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it("uses the status/next-attempt index instead of scanning the outbox", () => {
    const database = new Database(":memory:");
    try {
      database.exec(EMAIL_OUTBOX_PRODUCTION_SHAPED_DDL);
      const orm = drizzle(database);
      const queries = buildEmailOutboxAnomalyQueries(
        orm,
        "2026-08-24T12:00:00.000Z",
      );

      const stalePlan = explainPlan(database, queries.staleDue);
      const deadLetterPlan = explainPlan(database, queries.deadLetter);
      expect(stalePlan).toContain("idx_email_outbox_status_next_attempt");
      expect(deadLetterPlan).toContain("idx_email_outbox_status_next_attempt");
      expect(stalePlan).not.toContain("SCAN email_outbox");
      expect(deadLetterPlan).not.toContain("SCAN email_outbox");
    } finally {
      database.close();
    }
  });
});
