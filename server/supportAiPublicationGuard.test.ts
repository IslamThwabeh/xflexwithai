import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalD1Database } from "../backend/_core/localD1";
import { createSupportAiMessageIfCurrent, getDb } from "../backend/db";

const directory = mkdtempSync(join(tmpdir(), "xflex-support-publication-"));
let database: Awaited<ReturnType<typeof createLocalD1Database>>;
const reply = { conversationId: 10, userId: 123, triggerMessageId: 77, content: "Safe response" };

beforeAll(async () => {
  const imported = await import("better-sqlite3");
  const sqlite = new imported.default(join(directory, "fixture.db"));
  sqlite.exec(`
    CREATE TABLE supportConversations (id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,needsHuman INTEGER,updatedAt TEXT);
    CREATE TABLE supportMessages (id INTEGER PRIMARY KEY AUTOINCREMENT,conversationId INTEGER,senderId INTEGER,senderType TEXT,content TEXT,createdAt TEXT,deletedAt TEXT);
  `);
  sqlite.close();
  database = await createLocalD1Database(join(directory, "fixture.db"));
  await getDb({ DB: database });
});
beforeEach(async () => {
  await database.exec(`DELETE FROM supportMessages; DELETE FROM supportConversations;
    INSERT INTO supportConversations VALUES(10,123,'open',0,NULL);
    INSERT INTO supportMessages VALUES(77,10,123,'client','Help','2026-11-03T07:00:00.000Z',NULL);`);
});
afterAll(() => {
  (database as any)?.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("support AI publication guard", () => {
  it("publishes once for the latest client turn", async () => {
    expect(await createSupportAiMessageIfCurrent(reply)).toMatchObject({ id: expect.any(Number) });
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
    expect(await database.prepare("SELECT COUNT(*) AS total FROM supportMessages WHERE senderType='bot'").first("total")).toBe(1);
  });
  it("suppresses a generated reply after a human takeover", async () => {
    await database.exec("UPDATE supportConversations SET needsHuman=1 WHERE id=10");
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
  });
  it.each(["support", "admin", "client"])("suppresses stale generation after a newer %s message", async (senderType) => {
    await database.prepare("INSERT INTO supportMessages (conversationId,senderId,senderType,content) VALUES (10,456,?,'Newer message')").bind(senderType).run();
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
  });
  it("does not publish after closure or account ownership changes", async () => {
    await database.exec("UPDATE supportConversations SET status='closed' WHERE id=10");
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
    await database.exec("UPDATE supportConversations SET status='open',userId=999 WHERE id=10");
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
  });
  it("does not answer a deleted triggering message", async () => {
    await database.exec("UPDATE supportMessages SET deletedAt='2026-11-03T07:01:00.000Z' WHERE id=77");
    expect(await createSupportAiMessageIfCurrent(reply)).toBeNull();
  });
});
