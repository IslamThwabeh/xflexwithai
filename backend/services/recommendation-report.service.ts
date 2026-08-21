export type RecommendationReportOutcome = "win" | "loss";

export type RecommendationScoringEvent = {
  messageId: number;
  tradeId: number;
  occurredAt: string;
  outcome: RecommendationReportOutcome;
  cumulativePips: number;
};

export type RecommendationPeriodTradeState<T extends RecommendationScoringEvent> = {
  latestEvent: T;
  periodStartPips: number;
  cumulativePips: number;
  periodPips: number;
  milestoneCount: number;
  outcome: RecommendationReportOutcome;
};

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Treat every scored follow-up as the latest cumulative state of one trade.
 * The period contribution is latest state minus the state before the period,
 * so +50 then +100 contributes 100 (not 150), while a later-month +150 after
 * an earlier +30 contributes only the new 120 pips in that later month.
 */
export function buildRecommendationPeriodTradeStates<T extends RecommendationScoringEvent>(input: {
  events: T[];
  periodStart: string;
  periodEnd: string;
}): RecommendationPeriodTradeState<T>[] {
  const periodStartMs = timestamp(input.periodStart);
  const periodEndMs = timestamp(input.periodEnd);
  if (periodEndMs <= periodStartMs) {
    throw new Error("Recommendation report period end must be after its start.");
  }

  const byTrade = new Map<number, T[]>();
  for (const event of input.events) {
    if (!Number.isFinite(event.cumulativePips)) continue;
    const list = byTrade.get(event.tradeId) ?? [];
    list.push(event);
    byTrade.set(event.tradeId, list);
  }

  const rows: RecommendationPeriodTradeState<T>[] = [];
  for (const [, tradeEvents] of byTrade) {
    const ordered = [...tradeEvents].sort((a, b) => {
      const timeDifference = timestamp(a.occurredAt) - timestamp(b.occurredAt);
      return timeDifference || a.messageId - b.messageId;
    });

    let periodStartPips = 0;
    const periodEvents: T[] = [];
    for (const event of ordered) {
      const occurredAtMs = timestamp(event.occurredAt);
      if (occurredAtMs < periodStartMs) {
        periodStartPips = event.cumulativePips;
      } else if (occurredAtMs < periodEndMs) {
        periodEvents.push(event);
      }
    }
    if (!periodEvents.length) continue;

    const latestEvent = periodEvents[periodEvents.length - 1];
    const cumulativePips = roundTo2(latestEvent.cumulativePips);
    const periodPips = roundTo2(cumulativePips - periodStartPips);
    rows.push({
      latestEvent,
      periodStartPips: roundTo2(periodStartPips),
      cumulativePips,
      periodPips,
      milestoneCount: periodEvents.length,
      outcome: periodPips < 0 ? "loss" : periodPips > 0 ? "win" : latestEvent.outcome,
    });
  }

  return rows.sort((a, b) => {
    const timeDifference = timestamp(a.latestEvent.occurredAt) - timestamp(b.latestEvent.occurredAt);
    return timeDifference || a.latestEvent.messageId - b.latestEvent.messageId;
  });
}
