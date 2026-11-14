import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalD1Database } from "../backend/_core/localD1";
import { getDb } from "../backend/db";
import {
  getInterfaceAnnouncementStatus as status,
  recordInterfaceAnnouncementAction as respond,
} from "../backend/services/interface-announcement.service";
import { NAVIGATION_ANNOUNCEMENT_ID } from "../shared/interfaceAnnouncement";

describe("durable navigation announcement through actual SQL", () => {
  let directory: string;
  let sqlite: Database.Database;
  let local: Awaited<ReturnType<typeof createLocalD1Database>>;
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "xflex-notice-"));
    const filename = join(directory, "fixture.db");
    sqlite = new Database(filename);
    const migration = readFileSync(
      new URL(
        "../database/migrations/135_interface_announcement_states.sql",
        import.meta.url
      ),
      "utf8"
    );
    sqlite.exec(migration);
    sqlite.exec(migration); // Repeat must preserve existing receipt rows.
    local = await createLocalD1Database(filename);
    statements.length = 0;
    await getDb({
      DB: {
        prepare(query: string) {
          const original = local.prepare(query);
          return {
            ...original,
            bind(...args: unknown[]) {
              statements.push({ sql: query, args });
              return original.bind(...args);
            },
          };
        },
      } as D1Database,
    });
  });
  afterEach(() => {
    (local as unknown as { close(): void }).close();
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  it("starts visible without creating rows, defers this login and returns on the next login", async () => {
    expect(await status(17, "login-one")).toEqual({
      id: NAVIGATION_ANNOUNCEMENT_ID,
      visible: true,
    });
    expect(
      sqlite
        .prepare("SELECT count(*) AS count FROM interface_announcement_states")
        .get()
    ).toEqual({ count: 0 });
    await respond(17, "login-one", "later");
    expect((await status(17, "login-one")).visible).toBe(false);
    expect((await status(17, "login-two")).visible).toBe(true);
    await respond(17, "login-two", "later");
    expect((await status(17, "login-two")).visible).toBe(false);
  });
  it("permanently dismisses, including stale-tab Read later and retried requests", async () => {
    await respond(17, "login-one", "later");
    await respond(17, "login-one", "dismiss");
    await respond(17, "login-two", "later");
    await respond(17, "login-two", "dismiss");
    expect((await status(17, "login-three")).visible).toBe(false);
    expect(
      sqlite
        .prepare("SELECT count(*) AS count FROM interface_announcement_states")
        .get()
    ).toEqual({ count: 1 });
  });
  it("isolates students, staff, negative admin IDs and different campaigns", async () => {
    await respond(17, "one", "dismiss");
    expect((await status(-17, "one")).visible).toBe(true);
    expect((await status(18, "one")).visible).toBe(true);
    await respond(-17, "one", "later");
    expect((await status(-17, "two")).visible).toBe(true);
    sqlite
      .prepare(
        "INSERT INTO interface_announcement_states VALUES (?, ?, ?, NULL, ?)"
      )
      .run("other-campaign", 19, "now", "now");
    expect((await status(19, "one")).visible).toBe(true);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO interface_announcement_states VALUES ('invalid', 0, NULL, NULL, 'now')"
        )
        .run()
    ).toThrow();
  });
  it("runs the exact service SQL against a populated fixture using the composite primary key", async () => {
    const insert = sqlite.prepare(
      "INSERT INTO interface_announcement_states VALUES (?, ?, NULL, NULL, 'now')"
    );
    sqlite.transaction(() => {
      for (let id = 1; id <= 2000; id++)
        insert.run(NAVIGATION_ANNOUNCEMENT_ID, id);
    })();
    await status(1729, "one");
    await respond(1729, "one", "dismiss");
    expect(statements).toHaveLength(2);
    const read = statements.find(statement =>
      /SELECT dismissed_at/.test(statement.sql)
    )!;
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${read.sql}`)
      .all(...read.args) as Array<{ detail: string }>;
    expect(
      plan.some(row =>
        /SEARCH.*PRIMARY KEY.*announcement_id=.*account_id=/.test(row.detail)
      )
    ).toBe(true);
    expect(plan.some(row => /SCAN/.test(row.detail))).toBe(false);
    // Preparing and explaining the real write also validates physical column/upsert names.
    const write = statements.find(statement =>
      /INSERT INTO/.test(statement.sql)
    )!;
    expect(() =>
      sqlite.prepare(`EXPLAIN QUERY PLAN ${write.sql}`).all(...write.args)
    ).not.toThrow();
    expect(sqlite.pragma("integrity_check")).toEqual([
      { integrity_check: "ok" },
    ]);
  });
});
