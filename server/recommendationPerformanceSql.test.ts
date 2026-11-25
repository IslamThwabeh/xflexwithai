import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Sqlite from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalD1Database } from '../backend/_core/localD1';
import * as db from '../backend/db';

let directory: string, raw: Sqlite.Database, local: Awaited<ReturnType<typeof createLocalD1Database>>;
const queries: string[] = [];
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'xflex-performance-'));
  const filename = join(directory, 'report.db'); raw = new Sqlite(filename);
  raw.exec(`CREATE TABLE recommendationMessages (
    id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'recommendation', content TEXT NOT NULL,
    symbol TEXT, side TEXT, entryPrice TEXT, stopLoss TEXT, takeProfit1 TEXT, takeProfit2 TEXT, takeProfit3 TEXT,
    riskPercent TEXT, resultOutcome TEXT, resultPips REAL, parentId INTEGER, threadStatus TEXT, closedAt TEXT,
    closedByUserId INTEGER, deliveryDiagnosticsJson TEXT, createdAt TEXT NOT NULL, entryMode TEXT DEFAULT 'legacy',
    cancelledAt TEXT, managementAction TEXT, managementRequestId TEXT);
    CREATE INDEX idx_recommendationMessages_createdAt ON recommendationMessages(createdAt);
    CREATE INDEX idx_recommendation_messages_parent_type_created_id ON recommendationMessages(parentId,type,createdAt,id);`);
  const insert = raw.prepare(`INSERT INTO recommendationMessages (id,userId,type,content,parentId,createdAt,threadStatus,managementAction,resultOutcome,resultPips,cancelledAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const seed = (id: number, type: string, content: string, parent: number | null, date: string, management: string | null = null, outcome: string | null = null, pips: number | null = null, cancelled: string | null = null) => insert.run(id, 9, type, content, parent, date, 'open', management, outcome, pips, cancelled);
  seed(1, 'recommendation', 'PRIVATE ROOT', null, '2026-10-01T00:00:00Z');
  seed(2, 'recommendation', 'PRIVATE ROOT TWO', null, '2026-11-01 00:00:00');
  seed(3, 'update', '+30 pips', 1, '2026-10-31T23:59:59Z');
  seed(4, 'update', '+50 pips', 1, '2026-11-01T00:00:00Z');
  seed(5, 'update', '+100 pips', 1, '2026-11-08 12:00:00');
  seed(6, 'update', '+100 pips', 1, '2026-11-08T13:00:00Z');
  seed(7, 'result', 'Stopped -25 pips', 2, '2026-11-30T23:59:59Z');
  seed(8, 'update', 'Clarification +999 pips is management prose', 1, '2026-11-10T12:00:00Z', 'correction');
  seed(9, 'result', 'Unknown outcome', 99, '2026-11-15T12:00:00Z');
  seed(10, 'recommendation', 'CANCELLED PRIVATE ROOT', null, '2026-11-02T00:00:00Z', null, null, null, '2026-11-02T01:00:00Z');
  seed(11, 'result', '+250 pips', 1, '2026-12-01T00:00:00Z');
  local = await createLocalD1Database(filename);
  const tracked = Object.create(local);
  tracked.prepare = (query: string) => { queries.push(query); return local.prepare(query); };
  await db.getDb({ DB: tracked as any });
}, 20_000);
afterAll(() => { local?.close(); raw?.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

describe('actual D1-backed report projection', () => {
  it('matches staff totals while retaining UTC deltas, missing results, and management exclusion', async () => {
    queries.length = 0;
    const report = await db.getRecommendationCustomerPerformance('2026-11');
    const customerQueries = [...queries];
    const staff = await db.getRecommendationMonthlyTradeReport('2026-11');
    expect(report.summary).toMatchObject({ netPips: 45, totalTrades: 2, winningTrades: 1, losingTrades: 1, winRate: 50 });
    for (const key of Object.keys(report.summary)) expect(report.summary[key as keyof typeof report.summary]).toBe(staff.summary[key as keyof typeof report.summary]);
    expect(report.unresolvedTrades).toBe(1); expect(report.cancelledPending).toBe(1);
    expect(report.daily[0].netPips).toBe(20); expect(report.daily[7].netPips).toBe(50); expect(report.daily[29].netPips).toBe(-25);
    expect(report.daily.reduce((sum, row) => sum + row.netPips, 0)).toBe(45);
    expect(customerQueries).toHaveLength(3); // One history read, one stats read, one parent chunk; not per day/week.
    expect(customerQueries.every(query => /^select\b/i.test(query))).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|999|Unknown outcome|parentId|userId|content/);
  });
  it('reflects manual corrections and preserves original messages', async () => {
    raw.prepare("UPDATE recommendationMessages SET resultOutcome='breakeven', resultPips=0 WHERE id=7").run();
    const report = await db.getRecommendationCustomerPerformance('2026-11');
    expect(report.summary).toMatchObject({ netPips: 70, breakevenTrades: 1, losingTrades: 0 });
    expect(report.daily[29]).toMatchObject({ netPips: 0, breakevenTrades: 1 });
    expect(raw.prepare('SELECT content FROM recommendationMessages WHERE id=7').get()).toEqual({ content: 'Stopped -25 pips' });
  });
  it('keeps empty-month outputs bounded and requires no parent hydration without history', async () => {
    queries.length = 0;
    const report = await db.getRecommendationCustomerPerformance('2025-01');
    expect(report.summary.totalTrades).toBe(0); expect(report.daily).toHaveLength(31);
    expect(queries).toHaveLength(2);
  });
  it('batches more than 500 parent IDs with one bound JSON value per query and the existing PK', async () => {
    const insert = raw.prepare('INSERT INTO recommendationMessages (id,userId,type,content,parentId,createdAt) VALUES (?,?,?,?,?,?)');
    raw.transaction(() => { for (let index = 0; index < 501; index++) {
      insert.run(10000 + index, 9, 'recommendation', 'Synthetic historical root', null, '2026-05-01T12:00:00Z');
      insert.run(20000 + index, 9, 'result', '+1 pips', 10000 + index, '2026-06-01T12:00:00Z');
    } })();
    queries.length = 0;
    const report = await db.getRecommendationCustomerPerformance('2026-06');
    expect(report.summary).toMatchObject({ totalTrades: 501, netPips: 501 });
    expect(queries).toHaveLength(4);
    const hydration = queries.filter(query => query.includes('json_each'));
    expect(hydration).toHaveLength(2);
    expect(hydration.every(query => (query.match(/\?/g) ?? []).length === 1)).toBe(true);
    const plan = raw.prepare('EXPLAIN QUERY PLAN SELECT * FROM recommendationMessages WHERE id IN (SELECT value FROM json_each(?))').all('[10000,10001]');
    expect(JSON.stringify(plan)).toMatch(/SEARCH recommendationMessages USING INTEGER PRIMARY KEY/);
  });
});
