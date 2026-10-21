import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { readRecommendationDeliveryFunnel } from "../backend/db";

const NOW = "2026-10-21T11:10:00.000Z";
const databases: Database.Database[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function fixture() {
  const db = new Database(":memory:");
  databases.push(db);
  // Physical production names, including the legacy camelCase columns.
  db.exec(`
    CREATE TABLE recommendationSubscriptions (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1, isPaused INTEGER NOT NULL DEFAULT 0,
      isPendingActivation INTEGER NOT NULL DEFAULT 0, endDate TEXT NOT NULL);
    CREATE INDEX idx_recommendationSubscriptions_userId ON recommendationSubscriptions(userId);
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, lastActiveAt TEXT,
      lastInteractiveAt TEXT, notificationPrefs TEXT DEFAULT '{}', isStaff INTEGER DEFAULT 0,
      login_blocked_at TEXT);
    CREATE TABLE client_notification_controls (user_id INTEGER, category TEXT,
      is_disabled INTEGER NOT NULL, PRIMARY KEY(user_id, category));
    CREATE TABLE userRoles (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, role TEXT NOT NULL,
      UNIQUE(userId, role));
  `);
  const queries: { sql: string; params: unknown[] }[] = [];
  const orm = drizzle(db, {
    logger: {
      logQuery(sql, params) {
        queries.push({ sql, params });
      },
    },
  });
  let nextId = 0;
  function add(
    options: {
      userId?: number;
      active?: number;
      paused?: number;
      pending?: number;
      end?: string;
      staff?: number;
      prefs?: string | null;
      blocked?: string;
      email?: string;
    } = {}
  ) {
    const id = ++nextId;
    const userId = options.userId ?? id;
    db.prepare(
      "INSERT OR IGNORE INTO users(id,email,isStaff,notificationPrefs,login_blocked_at) VALUES(?,?,?,?,?)"
    ).run(
      userId,
      options.email ?? `client${userId}@example.test`,
      options.staff ?? 0,
      options.prefs === undefined ? "{}" : options.prefs,
      options.blocked ?? null
    );
    db.prepare(
      "INSERT INTO recommendationSubscriptions VALUES(?,?,?,?,?,?)"
    ).run(
      id,
      userId,
      options.active ?? 1,
      options.paused ?? 0,
      options.pending ?? 0,
      options.end ?? "2026-11-21T11:10:00.000Z"
    );
    return userId;
  }
  const read = () => readRecommendationDeliveryFunnel(orm as any, NOW);
  return { db, queries, add, read };
}

describe("Students recommendation audience", () => {
  it("reconciles the 95 records with 11 unique recipients without changing stored state", async () => {
    const f = fixture();
    for (let i = 0; i < 11; i++) f.add();
    for (let i = 0; i < 75; i++) f.add({ end: "2026-10-20T11:10:00.000Z" });
    for (let i = 0; i < 4; i++) f.add({ paused: 1 });
    for (let i = 0; i < 4; i++) f.add({ pending: 1 });
    f.add({ staff: 1 });
    f.add({ active: 0 });
    const changes = f.db.prepare("SELECT total_changes() AS count").get();
    const result = await f.read();
    expect(result.diagnostics).toMatchObject({
      totalSubs: 95,
      expired: 75,
      paused: 4,
      pending: 4,
      activeSubs: 12,
      staffExcluded: 1,
      eligibleCount: 11,
    });
    expect(new Set(result.eligible.map(client => client.userId)).size).toBe(11);
    expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(
      changes
    );
    expect(f.queries.every(query => /^select /i.test(query.sql))).toBe(true);
    expect(f.queries).toHaveLength(3); // Existing bounded role lookups use two chunks.
    const plans = f.queries.map(({ sql, params }) =>
      f.db
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row: any) => row.detail)
        .join("\n")
    );
    // The small subscription table is intentionally read once, only on expansion.
    // Each joined account/control and batched role lookup must use an index.
    expect(plans[0]).toContain("SEARCH users USING INTEGER PRIMARY KEY");
    expect(plans[0]).toContain(
      "sqlite_autoindex_client_notification_controls_1"
    );
    expect(plans[1]).toContain("sqlite_autoindex_userRoles_1");
    expect(plans[2]).toContain("sqlite_autoindex_userRoles_1");
  });

  it("counts overlapping exclusions once and applies notification/account checks and deduplication", async () => {
    const f = fixture();
    const client = f.add({ prefs: null });
    f.add({ userId: client });
    f.add({ paused: 1, pending: 1, end: "2020-01-01" });
    f.add({ pending: 1, end: "2020-01-01" });
    f.add({ end: NOW }); // The delivery rule includes the exact expiry boundary.
    f.add({ prefs: '{"recommendations":false}' });
    f.add({ prefs: "bad json" });
    f.add({ blocked: NOW });
    const analyst = f.add();
    f.db
      .prepare("INSERT INTO userRoles(userId,role) VALUES(?, 'analyst')")
      .run(analyst);
    const disabled = f.add();
    f.db
      .prepare(
        "INSERT INTO client_notification_controls VALUES(?, 'recommendations', 1)"
      )
      .run(disabled);
    f.add({ email: "" });
    const missing = f.add();
    f.db.prepare("DELETE FROM users WHERE id=?").run(missing);
    const { diagnostics: d, eligible } = await f.read();
    expect(d).toMatchObject({
      totalSubs: 12,
      activeSubs: 10,
      paused: 1,
      pending: 1,
      expired: 0,
      eligibleCount: 2,
      staffExcluded: 1,
      optedOut: 1,
      malformedPrefs: 1,
      accountDisabled: 1,
      accountUnavailable: 1,
      notificationsDisabled: 1,
      missingEmail: 1,
    });
    expect(eligible).toHaveLength(2);
    const excluded =
      d.paused +
      d.pending +
      d.expired +
      d.staffExcluded +
      d.optedOut +
      d.malformedPrefs +
      d.accountDisabled +
      d.accountUnavailable +
      d.notificationsDisabled +
      d.missingEmail;
    expect(d.totalSubs - excluded - d.eligibleCount).toBe(1);
  });

  it("returns a genuine zero audience for an empty database", async () => {
    const f = fixture();
    expect(await f.read()).toMatchObject({
      eligible: [],
      diagnostics: { totalSubs: 0, activeSubs: 0, eligibleCount: 0 },
    });
    expect(f.queries).toHaveLength(1);
  });
});
