import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
    deleteSupportMessage: vi.fn(),
    getSupportConversation: vi.fn(),
    getSupportMessageDeletionAudits: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const migrationSql = readFileSync(fileURLToPath(new URL(
  "../database/migrations/104_support_message_moderation.sql",
  import.meta.url,
)), "utf8");

const caller = (user: { id: number; email: string; isStaff?: boolean }) => appRouter.createCaller({
  req: { headers: {}, method: "POST", path: "/api/trpc/supportChat.deleteMessage" },
  user: { ...user, passwordHash: "", name: "User", phone: null, emailVerified: true, createdAt: "", updatedAt: "", lastSignedIn: "" },
  setCookie: () => {},
  clearCookie: () => {},
} as any);

describe("support message moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    vi.mocked(db.deleteSupportMessage).mockResolvedValue({
      message: { id: 20, attachmentUrl: null } as any,
      deletedAt: "2026-09-06T12:00:00.000Z",
    });
  });

  it("grants moderation only to the explicit support role", async () => {
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    await caller({ id: 9, email: "support@example.com", isStaff: true }).supportChat.deleteMessage({
      messageId: 20,
      reasonCategory: "sensitive_information",
    });
    expect(db.hasAnyRole).toHaveBeenCalledWith(9, ["support"]);
    expect(db.deleteSupportMessage).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 9,
      actorType: "support",
      canModerate: true,
      reasonCategory: "sensitive_information",
    }));
  });

  it("does not treat an unrelated staff flag as moderation permission", async () => {
    await caller({ id: 10, email: "analyst@example.com", isStaff: true }).supportChat.deleteMessage({ messageId: 20 });
    expect(db.deleteSupportMessage).toHaveBeenCalledWith(expect.objectContaining({
      actorType: "client",
      canModerate: false,
    }));
  });

  it("creates an additive, idempotent, content-free audit schema", async () => {
    expect(migrationSql).not.toMatch(/\b(?:DROP|DELETE|UPDATE|ALTER)\b/i);
    expect(migrationSql).not.toMatch(/message_content|original_content/i);
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(migrationSql);
      database.exec(migrationSql);
      const columns = database.prepare("PRAGMA table_info('support_message_deletion_audit')").all();
      expect(columns.map((column: any) => column.name)).toEqual(expect.arrayContaining([
        "message_id", "conversation_id", "deleted_by_user_id", "actor_type", "reason_category", "created_at",
      ]));
      expect(database.prepare("PRAGMA index_list('support_message_deletion_audit')").all()).toHaveLength(2);
    } finally {
      database.close();
    }
  });
});

