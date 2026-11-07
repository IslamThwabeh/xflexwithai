import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalD1Database } from "../backend/_core/localD1";
import { completePasswordRecovery, getDb } from "../backend/db";

let database: Awaited<ReturnType<typeof createLocalD1Database>>;
beforeAll(async () => {
  database = await createLocalD1Database(":memory:");
  await database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, passwordHash TEXT, login_blocked_at TEXT);
    CREATE TABLE authEmailOtps (id INTEGER PRIMARY KEY, email TEXT, purpose TEXT, codeHash TEXT, salt TEXT, expiresAtMs INTEGER, attempts INTEGER);
  `);
  await getDb({ DB: database });
});
afterAll(() => (database as any)?.close());

describe("transactional password recovery", () => {
  it("consumes a link once and invalidates outstanding reset/login codes", async () => {
    await database.prepare("INSERT INTO users VALUES (1, 'client@example.com', 'old', NULL)").run();
    for (const purpose of ["support_reset", "password_reset", "login", "login_stepup"]) {
      await database.prepare("INSERT INTO authEmailOtps (email, purpose, codeHash, expiresAtMs, attempts) VALUES (?, ?, ?, ?, 0)")
        .bind("client@example.com", purpose, "valid-hash", Date.now() + 60_000).run();
    }
    const input = { userId: 1, email: "client@example.com", purpose: "support_reset" as const, codeHash: "valid-hash", passwordHash: "new-hash" };
    expect(await completePasswordRecovery({ ...input, codeHash: "wrong" })).toBe(false);
    expect(await database.prepare("SELECT COUNT(*) AS n FROM authEmailOtps").first("n")).toBe(4);
    const results = await Promise.all([completePasswordRecovery(input), completePasswordRecovery({ ...input, passwordHash: "replay" })]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await database.prepare("SELECT passwordHash FROM users WHERE id=1").first("passwordHash")).toBe("new-hash");
    expect(await database.prepare("SELECT COUNT(*) AS n FROM authEmailOtps").first("n")).toBe(0);
  });

  it("rejects expired, exhausted, and blocked-account credentials without consuming other codes", async () => {
    await database.prepare("INSERT INTO authEmailOtps (email, purpose, codeHash, expiresAtMs, attempts) VALUES ('client@example.com', 'support_reset', 'hash', ?, 0)").bind(Date.now() - 1).run();
    const input = { userId: 1, email: "client@example.com", purpose: "support_reset" as const, codeHash: "hash", passwordHash: "forbidden" };
    expect(await completePasswordRecovery(input)).toBe(false);
    await database.prepare("UPDATE authEmailOtps SET expiresAtMs=?, attempts=10").bind(Date.now() + 60_000).run();
    expect(await completePasswordRecovery(input)).toBe(false);
    await database.exec("UPDATE authEmailOtps SET attempts=0; UPDATE users SET login_blocked_at='blocked'");
    expect(await completePasswordRecovery(input)).toBe(false);
    expect(await database.prepare("SELECT passwordHash FROM users WHERE id=1").first("passwordHash")).toBe("new-hash");
    expect(await database.prepare("SELECT COUNT(*) AS n FROM authEmailOtps").first("n")).toBe(1);
  });
});
