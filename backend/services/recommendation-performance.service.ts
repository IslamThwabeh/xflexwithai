import { PERFORMANCE_MAX_AGE_MS, type PerformanceSummary, type PerformancePeriod,
  type RecommendationPerformance } from '../../shared/recommendationPerformance';
import type { RecommendationScoringEvent } from './recommendation-report.service';

const round = (value: number) => Math.round(value * 100) / 100;
const dayMs = 86_400_000;

function summarize(contributions: Map<number, number>): PerformanceSummary {
  const values = [...contributions.values()].map(round);
  const winningTrades = values.filter(value => value > 0).length;
  const losingTrades = values.filter(value => value < 0).length;
  return { netPips: round(values.reduce((sum, value) => sum + value, 0)),
    totalTrades: values.length, winningTrades, losingTrades,
    breakevenTrades: values.length - winningTrades - losingTrades,
    winRate: winningTrades + losingTrades ? round(100 * winningTrades / (winningTrades + losingTrades)) : 0 };
}

/** One history pass; independent per-period trade maps prevent duplicate counts. */
export function buildRecommendationPerformance(input: {
  month: string; events: RecommendationScoringEvent[]; summary: PerformanceSummary;
  unresolvedTrades: number; cancelledPending: number; now?: Date;
}): RecommendationPerformance {
  const now = input.now ?? new Date();
  const start = Date.parse(`${input.month}-01T00:00:00Z`);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const endMs = end.getTime();
  const days = new Map<string, Map<number, number>>();
  const weeks = new Map<string, { start: number; end: number; trades: Map<number, number> }>();
  // Calendar weeks are Sunday–Saturday; clip edge weeks to the selected month.
  for (let at = start; at < endMs; at += dayMs) {
    const date = new Date(at).toISOString().slice(0, 10);
    days.set(date, new Map());
    const weekStart = at - new Date(at).getUTCDay() * dayMs;
    const key = String(weekStart);
    if (!weeks.has(key)) weeks.set(key, { start: weekStart, end: weekStart + 7 * dayMs, trades: new Map() });
  }
  const previous = new Map<number, number>();
  const events = input.events.filter(event => Number.isFinite(event.cumulativePips))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.messageId - b.messageId);
  const add = (map: Map<number, number>, id: number, delta: number) => map.set(id, round((map.get(id) ?? 0) + delta));
  for (const event of events) {
    const at = Date.parse(event.occurredAt);
    if (!Number.isFinite(at) || at >= endMs) continue;
    const current = round(event.cumulativePips);
    const delta = round(current - (previous.get(event.tradeId) ?? 0));
    previous.set(event.tradeId, current);
    if (at < start) continue;
    const day = new Date(at).toISOString().slice(0, 10);
    add(days.get(day)!, event.tradeId, delta);
    const midnight = Date.parse(`${day}T00:00:00Z`);
    const week = weeks.get(String(midnight - new Date(midnight).getUTCDay() * dayMs))!;
    add(week.trades, event.tradeId, delta);
  }
  const daily: PerformancePeriod[] = [...days].map(([date, trades]) => ({
    startDate: date, endDate: date, partialWeek: false, ...summarize(trades),
  }));
  const weekly: PerformancePeriod[] = [...weeks.values()].map(week => ({
    startDate: new Date(Math.max(start, week.start)).toISOString().slice(0, 10),
    endDate: new Date(Math.min(endMs, week.end) - dayMs).toISOString().slice(0, 10),
    partialWeek: week.start < start || week.end > endMs, ...summarize(week.trades),
  }));
  // Explicit projection: never spread staff report objects into this response.
  const s = input.summary;
  return { month: input.month, timezone: 'UTC', basis: 'reported_cumulative_progress',
    calculatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + PERFORMANCE_MAX_AGE_MS).toISOString(),
    summary: { netPips: s.netPips, totalTrades: s.totalTrades, winningTrades: s.winningTrades,
      losingTrades: s.losingTrades, breakevenTrades: s.breakevenTrades, winRate: s.winRate },
    daily, weekly, unresolvedTrades: input.unresolvedTrades, cancelledPending: input.cancelledPending };
}

type EdgeCache = Pick<Cache, 'match' | 'put'>;
/** Internal sanitized data cache only. Authentication must run before get(). */
export function createPerformanceCache(options: { now?: () => number; edge?: () => EdgeCache | undefined } = {}) {
  const entries = new Map<string, RecommendationPerformance>();
  const pending = new Map<string, Promise<RecommendationPerformance>>();
  const clock = options.now ?? Date.now;
  const fresh = (report: RecommendationPerformance) => {
    const created = Date.parse(report.calculatedAt), expires = Date.parse(report.expiresAt), now = clock();
    return Number.isFinite(created) && expires === created + PERFORMANCE_MAX_AGE_MS && created <= now && now < expires;
  };
  return {
    async get(scope: string, month: string, load: () => Promise<RecommendationPerformance>) {
      const key = `https://xflex-performance.internal/v1/${encodeURIComponent(scope)}/${month}`;
      const memory = entries.get(key);
      if (memory && fresh(memory)) return memory;
      const existing = pending.get(key);
      if (existing) return existing;
      const task = (async () => {
        let edge: EdgeCache | undefined;
        try { edge = options.edge?.(); } catch { /* Cache failure is not a report failure. */ }
        if (edge) {
          try {
            const response = await edge.match(key);
            if (response) {
              const report = await response.json() as RecommendationPerformance;
              if (report.month === month && report.basis === 'reported_cumulative_progress' && fresh(report)) {
                remember(key, report); return report;
              }
            }
          } catch { /* Miss or unavailable cache: compute from source. */ }
        }
        const report = await load();
        if (fresh(report)) {
          remember(key, report);
          if (edge) {
            try {
              // Store no request cookies, headers, staff rows or serialized RPC envelope.
              await edge.put(key, new Response(JSON.stringify(report), { headers: {
                'Content-Type': 'application/json', 'Cache-Control': `max-age=${Math.max(1, Math.floor((Date.parse(report.expiresAt) - clock()) / 1000))}`,
              } }));
            } catch { /* Serving fresh source data remains safe. */ }
          }
        }
        return report;
      })();
      pending.set(key, task);
      try { return await task; } finally { pending.delete(key); }
    },
  };
  function remember(key: string, report: RecommendationPerformance) {
    entries.delete(key); entries.set(key, report);
    while (entries.size > 12) entries.delete(entries.keys().next().value!);
  }
}

export const recommendationPerformanceCache = createPerformanceCache({
  edge: () => (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default,
});
