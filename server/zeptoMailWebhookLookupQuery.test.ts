import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildZeptoMailDeliveryLogMatchQueries,
  mergeZeptoMailDeliveryLogMatchRows,
} from "../backend/db";

const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const productionShapedSql = `
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

  CREATE INDEX idx_email_delivery_logs_provider_request
    ON email_delivery_logs(provider, provider_request_id);

  CREATE INDEX idx_email_delivery_logs_provider_client_reference
    ON email_delivery_logs(provider, provider_client_reference)
    WHERE provider_client_reference IS NOT NULL;
`;

function plan(
  database: Database.Database,
  query: { toSQL(): { sql: string; params: unknown[] } },
) {
  const compiled = query.toSQL();
  return database.prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
    .all(...compiled.params)
    .map((row: any) => String(row.detail))
    .join("\n");
}

describe("ZeptoMail webhook delivery-log lookup", () => {
  it("splits request-id and client-reference matching into indexed probes", () => {
    const database = new Database(":memory:");
    try {
      database.exec(productionShapedSql);
      const queries = buildZeptoMailDeliveryLogMatchQueries(drizzle(database), {
        providerRequestId: "request-1",
        providerClientReference: "client-reference-1",
        recipientEmail: "amal@example.com",
      });

      expect(queries).toHaveLength(2);
      expect(plan(database, queries[0])).toContain("idx_email_delivery_logs_provider_request");
      expect(plan(database, queries[1])).toContain("idx_email_delivery_logs_provider_client_reference");
      expect(plan(database, queries[0])).not.toContain("SCAN email_delivery_logs");
      expect(plan(database, queries[1])).not.toContain("SCAN email_delivery_logs");
    } finally {
      database.close();
    }
  });

  it("keeps the no-client-reference path to one indexed request lookup", () => {
    const database = new Database(":memory:");
    try {
      database.exec(productionShapedSql);
      const queries = buildZeptoMailDeliveryLogMatchQueries(drizzle(database), {
        providerRequestId: "request-1",
        providerClientReference: null,
        recipientEmail: null,
      });

      expect(queries).toHaveLength(1);
      expect(plan(database, queries[0])).toContain("idx_email_delivery_logs_provider_request");
    } finally {
      database.close();
    }
  });

  it("deduplicates logs that match both provider correlations", () => {
    expect(mergeZeptoMailDeliveryLogMatchRows([
      [{ id: 1, status: "sent", providerEventAt: null }],
      [
        { id: 1, status: "sent", providerEventAt: null },
        { id: 2, status: "sent", providerEventAt: null },
      ],
    ])).toEqual([
      { id: 1, status: "sent", providerEventAt: null },
      { id: 2, status: "sent", providerEventAt: null },
    ]);
  });

  it("does not reintroduce the broad OR delivery-log match in the webhook path", () => {
    const section = backendSource.slice(
      backendSource.indexOf("export async function recordZeptoMailWebhookEvent"),
      backendSource.indexOf("export async function getEmailDeliveryLogs"),
    );

    expect(section).toContain("buildZeptoMailDeliveryLogMatchQueries");
    expect(section).not.toContain("providerRequestId, input.providerRequestId),");
    expect(section).not.toContain("providerClientReference, input.providerClientReference),");
    expect(section).not.toContain(" or(");
  });
});
