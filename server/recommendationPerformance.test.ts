import { describe, expect, it, vi } from 'vitest';
import { buildRecommendationPerformance, createPerformanceCache } from '../backend/services/recommendation-performance.service';
import { buildRecommendationPeriodTradeStates, type RecommendationScoringEvent } from '../backend/services/recommendation-report.service';
import { PERFORMANCE_MAX_AGE_MS, illustratePerformance, isSupportedPerformanceMonth } from '../shared/recommendationPerformance';

const event = (messageId: number, tradeId: number, occurredAt: string, cumulativePips: number): RecommendationScoringEvent => ({ messageId, tradeId, occurredAt, cumulativePips, outcome: cumulativePips < 0 ? 'loss' : cumulativePips > 0 ? 'win' : 'breakeven' });
const summary = { netPips: 100, totalTrades: 1, winningTrades: 1, losingTrades: 0, breakevenTrades: 0, winRate: 100 };
const build = (events: RecommendationScoringEvent[] = [], now = new Date('2026-11-25T12:00:00Z')) => buildRecommendationPerformance({ month: '2026-11', events, summary, unresolvedTrades: 2, cancelledPending: 1, now });

describe('customer aggregate performance', () => {
  it('counts only changes on the actual UTC day and carries earlier-month state', () => {
    const report = build([
      event(4, 1, '2026-11-03T13:00:00Z', 100),
      event(1, 1, '2026-10-31T23:00:00Z', 30),
      event(2, 1, '2026-11-01T23:59:59Z', 50),
      event(3, 1, '2026-11-02T00:00:00Z', 50),
      event(5, 1, '2026-12-01T00:00:00Z', 250),
    ]);
    expect(report.daily.slice(0, 3).map(day => day.netPips)).toEqual([20, 0, 50]);
    expect(report.daily[1]).toMatchObject({ totalTrades: 1, breakevenTrades: 1, winRate: 0 });
    expect(report.weekly[0].netPips).toBe(70);
    expect(report.daily).toHaveLength(30);
    expect(report.weekly.at(-1)).toMatchObject({ startDate: '2026-11-29', endDate: '2026-11-30', partialWeek: true });
  });
  it('handles loss reversals, multiple trades, same-time ordering and a new week', () => {
    const report = build([
      event(1, 1, '2026-11-07T12:00:00Z', 100),
      event(3, 1, '2026-11-08T12:00:00Z', -30),
      event(2, 1, '2026-11-08T12:00:00Z', 150),
      event(4, 2, '2026-11-08T12:00:00Z', 50),
    ]);
    expect(report.daily[7]).toMatchObject({ netPips: -80, totalTrades: 2, winningTrades: 1, losingTrades: 1, winRate: 50 });
    expect(report.weekly.slice(0, 2).map(week => week.netPips)).toEqual([100, -80]);
  });
  it('reconciles daily and weekly net pips with original monthly scoring across many histories', () => {
    const events = Array.from({ length: 600 }, (_, index) => event(index, index % 31,
      new Date(Date.UTC(2026, 9, 18 + index % 60, index % 24)).toISOString(), ((index * 17) % 350 - 175) / 10));
    const states = buildRecommendationPeriodTradeStates({ events, periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' });
    const net = Math.round(states.reduce((sum, state) => sum + state.periodPips, 0) * 100) / 100;
    const report = build(events);
    for (const periods of [report.daily, report.weekly]) expect(Math.round(periods.reduce((sum, period) => sum + period.netPips, 0) * 100) / 100).toBe(net);
  });
  it('projects only numeric aggregates even when staff input contains private fields', () => {
    const report = buildRecommendationPerformance({ month: '2026-11', events: [{ ...event(1, 900, '2026-11-01', 100), candidate: { content: 'PRIVATE TRADE', email: 'private@example.test' } } as any], summary: { ...summary, content: 'PRIVATE TRADE', analystId: 42 } as any, unresolvedTrades: 1, cancelledPending: 0 });
    expect(Object.keys(report.summary).sort()).toEqual(Object.keys(summary).sort());
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE TRADE|private@example|analystId|tradeId|messageId|candidate/);
    expect(Object.keys(report).sort()).toEqual(['basis','calculatedAt','cancelledPending','daily','expiresAt','month','summary','timezone','unresolvedTrades','weekly'].sort());
  });
  it('represents empty/leap months and partial weeks without inventing wins', () => {
    const report = buildRecommendationPerformance({ month: '2024-02', events: [], summary: { ...summary, netPips: 0, totalTrades: 0, winningTrades: 0, winRate: 0 }, unresolvedTrades: 0, cancelledPending: 0 });
    expect(report.daily).toHaveLength(29);
    expect(report.weekly[0]).toMatchObject({ startDate: '2024-02-01', endDate: '2024-02-03', partialWeek: true, totalTrades: 0, winRate: 0 });
  });
});

describe('five-minute internal report cache', () => {
  it('coalesces concurrent misses and refreshes at the original absolute expiry', async () => {
    let now = Date.parse('2026-11-25T12:00:00Z');
    const cache = createPerformanceCache({ now: () => now });
    const load = vi.fn(async () => build([], new Date(now)));
    const values = await Promise.all(Array.from({ length: 30 }, () => cache.get('production', '2026-11', load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(values.every(value => value === values[0])).toBe(true);
    now += PERFORMANCE_MAX_AGE_MS - 1;
    await cache.get('production', '2026-11', load);
    expect(load).toHaveBeenCalledTimes(1);
    now += 1;
    await cache.get('production', '2026-11', load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('separates deployment scopes and months; does not cache failed loads', async () => {
    const cache = createPerformanceCache();
    const load = vi.fn(async () => build([], new Date()));
    await cache.get('a', '2026-11', load); await cache.get('b', '2026-11', load); await cache.get('a', '2026-10', load);
    expect(load).toHaveBeenCalledTimes(3);
    const fail = vi.fn(async () => { throw new Error('synthetic DB failure'); });
    await expect(cache.get('failure', '2026-11', fail)).rejects.toThrow();
    await expect(cache.get('failure', '2026-11', fail)).rejects.toThrow();
    expect(fail).toHaveBeenCalledTimes(2);
  });
  it('reuses only fresh edge snapshots and does not extend their age', async () => {
    let now = Date.parse('2026-11-25T12:00:00Z');
    const report = build([], new Date(now)); now += 240_000;
    const edge = { match: vi.fn(async () => new Response(JSON.stringify(report))), put: vi.fn(async (_key: RequestInfo | URL, _response: Response) => {}) };
    const cache = createPerformanceCache({ now: () => now, edge: () => edge as any });
    const load = vi.fn(async () => build([], new Date(now)));
    expect((await cache.get('edge', '2026-11', load)).expiresAt).toBe('2026-11-25T12:05:00.000Z');
    expect(load).not.toHaveBeenCalled();
    now += 60_000;
    await cache.get('edge', '2026-11', load);
    expect(load).toHaveBeenCalledTimes(1);
    const response = edge.put.mock.calls[0][1] as Response;
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(JSON.stringify(await response.json())).not.toMatch(/content|author|email/);
  });
  it('survives unavailable/malformed cache and caps retained months', async () => {
    const cache = createPerformanceCache({ edge: () => ({ match: async () => { throw new Error('cache unavailable'); }, put: async () => { throw new Error('cache unavailable'); } }) as any });
    const load = vi.fn(async () => build([], new Date()));
    for (let index = 0; index < 13; index++) await cache.get('bounded', String(index), load);
    await cache.get('bounded', '0', load);
    expect(load).toHaveBeenCalledTimes(14);
  });
});

describe('report input and money illustration', () => {
  it('bounds the month and preserves signed, finite arithmetic without compounding', () => {
    expect(isSupportedPerformanceMonth('2026-11', new Date('2026-11-25Z'))).toBe(true);
    for (const month of ['2026-12', '2026-00', '2026-13', '1999-12', "2026-11' OR 1=1", '2026-1']) expect(isSupportedPerformanceMonth(month, new Date('2026-11-25Z'))).toBe(false);
    expect(illustratePerformance(100, 100, 0.1)).toEqual({ change: 10, endingAmount: 110, percentage: 10 });
    expect(illustratePerformance(-150, 100, 0.1)).toEqual({ change: -15, endingAmount: 85, percentage: -15 });
    expect(illustratePerformance(-1500, 100, 0.1)?.endingAmount).toBe(-50);
    for (const value of [0, -1, NaN, Infinity]) expect(illustratePerformance(100, value, 0.1)).toBeNull();
    expect(illustratePerformance(Number.MAX_VALUE, 100, Number.MAX_VALUE)).toBeNull();
  });
});
