import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildSupportMessageChangeQueries,
  mergeSupportMessageChanges,
} from "../backend/db";

const migrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../database/migrations/096_d1_remaining_hot_path_indexes.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const readSource = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)),
  "utf8",
);

const schemaSql = `
  CREATE TABLE staff_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    eventType TEXT NOT NULL,
    actionUrl TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE supportMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationId INTEGER NOT NULL,
    senderId INTEGER NOT NULL,
    senderType TEXT NOT NULL,
    content TEXT NOT NULL,
    isRead INTEGER NOT NULL DEFAULT 0,
    replyToMessageId INTEGER,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_size INTEGER,
    attachmentType TEXT,
    attachmentDuration INTEGER,
    editedAt TEXT,
    deletedAt TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL
  );
  CREATE TABLE points_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference_type TEXT,
    created_at TEXT NOT NULL
  );
`;

describe("remaining D1 hot-path safeguards", () => {
  it("keeps the migration additive, idempotent, and non-unique", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/im,
    );
    expect(migrationSql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(7);
    expect(migrationSql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });

  it("gives every urgent scan an indexed local query plan", () => {
    const database = new Database(":memory:");
    try {
      database.exec(`${schemaSql}${migrationSql}${migrationSql}`);
      const plan = (sql: string, ...params: unknown[]) => database
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row: any) => String(row.detail))
        .join("\n");

      expect(plan(`
        SELECT id FROM staff_notifications
        WHERE eventType = ? AND actionUrl = ? AND createdAt >= ? LIMIT 1
      `, "new_support_message", "/admin/support", "2026-09-01T00:00:00Z"))
        .toContain("idx_staff_notif_event_action_created");

      const staffListPlan = plan(`
        SELECT id FROM staff_notifications
        WHERE userId = ? ORDER BY createdAt DESC LIMIT 50
      `, -1);
      expect(staffListPlan).toContain("idx_staff_notif_user_created");
      expect(staffListPlan).not.toContain("USE TEMP B-TREE");

      expect(plan(`
        SELECT id FROM supportMessages
        WHERE conversationId = ? AND editedAt > ?
      `, 1, "2026-09-01T00:00:00Z"))
        .toContain("idx_support_messages_conversation_edited");
      expect(plan(`
        SELECT id FROM supportMessages
        WHERE conversationId = ? AND deletedAt > ?
      `, 1, "2026-09-01T00:00:00Z"))
        .toContain("idx_support_messages_conversation_deleted");
      expect(plan(`
        SELECT id FROM supportMessages
        WHERE conversationId = ? AND senderType <> 'client' AND isRead = 0
      `, 1)).toContain("idx_support_messages_unread_non_client");
      expect(plan(`
        SELECT id FROM enrollments WHERE userId = ? AND courseId = ?
      `, 1, 2)).toContain("idx_enrollments_user_course");
      expect(plan(`
        SELECT COUNT(*) FROM points_transactions
        WHERE user_id = ? AND reference_type = ? AND created_at >= ?
      `, 1, "login", "2026-09-01T00:00:00Z"))
        .toContain("idx_points_transactions_user_reference_created");

      const queries = buildSupportMessageChangeQueries(drizzle(database), {
        conversationId: 1,
        afterMessageId: 5,
        changedAfter: "2026-09-01T00:00:00Z",
      });
      const edited = queries.editedMessages.toSQL();
      const deleted = queries.deletedMessages.toSQL();
      expect(plan(edited.sql, ...edited.params))
        .toContain("idx_support_messages_conversation_edited");
      expect(plan(deleted.sql, ...deleted.params))
        .toContain("idx_support_messages_conversation_deleted");
    } finally {
      database.close();
    }
  });

  it("deduplicates and orders split support change results", () => {
    const base = {
      conversationId: 1,
      senderId: 1,
      senderType: "client",
      content: "x",
      isRead: false,
      replyToMessageId: null,
      attachmentUrl: null,
      attachmentName: null,
      attachmentSize: null,
      attachmentType: null,
      attachmentDuration: null,
      editedAt: null,
      deletedAt: null,
    };
    const first = { ...base, id: 1, createdAt: "2026-09-01T10:00:00Z" } as any;
    const second = { ...base, id: 2, createdAt: "2026-09-01T10:01:00Z" } as any;

    expect(mergeSupportMessageChanges([second], [first, second], [])
      .map((message) => message.id)).toEqual([1, 2]);
  });

  it("uses normalized equality and slower visible-only polling", () => {
    const entitlementSection = backendSource.slice(
      backendSource.indexOf("async function getUserEntitlementDays"),
      backendSource.indexOf("export function getKeyAccessEndDate"),
    );
    const termsSection = backendSource.slice(
      backendSource.indexOf("export async function getUserTermsAcceptanceStatus"),
      backendSource.indexOf("export async function recordUserTermsAcceptance"),
    );
    expect(entitlementSection).toContain("eq(registrationKeys.email, normalizedEmail)");
    expect(entitlementSection).not.toContain("LOWER(${registrationKeys.email})");
    expect(termsSection).toContain("AND rk.email = ${normalizedEmail}");
    expect(termsSection).not.toContain("lower(trim(COALESCE(rk.email" );

    expect(readSource("../frontend/src/components/DashboardLayout.tsx"))
      .toContain("isPageVisible ? 120_000 : false");
    expect(readSource("../frontend/src/components/ClientLayout.tsx"))
      .toContain("refetchInterval: 120_000");
    expect(readSource("../frontend/src/pages/AdminNotifications.tsx"))
      .toContain("refetchInterval: 120_000");
    expect(readSource("../frontend/src/pages/AdminSupport.tsx"))
      .toContain("refetchInterval: isPageVisible ? 15_000 : false");
    expect(readSource("../frontend/src/pages/SupportChat.tsx"))
      .toContain("refetchInterval: isPageVisible ? 15_000 : false");
  });
});
