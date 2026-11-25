/** Report dates deliberately retain the existing staff report's UTC calendar. */
export const PERFORMANCE_MAX_AGE_MS = 5 * 60 * 1000;
export const PERFORMANCE_MIN_MONTH = '2000-01';
export const PERFORMANCE_PATH = '/recommendations-performance';

export type PerformanceSummary = {
  netPips: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
};
export type PerformancePeriod = PerformanceSummary & {
  startDate: string;
  endDate: string;
  partialWeek: boolean;
};
export type RecommendationPerformance = {
  month: string;
  timezone: 'UTC';
  basis: 'reported_cumulative_progress';
  calculatedAt: string;
  expiresAt: string;
  summary: PerformanceSummary;
  daily: PerformancePeriod[];
  weekly: PerformancePeriod[];
  unresolvedTrades: number;
  cancelledPending: number;
};

export function isSupportedPerformanceMonth(month: string, now = new Date()) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    && month >= PERFORMANCE_MIN_MONTH && month <= now.toISOString().slice(0, 7);
}

/** Arithmetic illustration only: no instrument, lot, execution or margin claim. */
export function illustratePerformance(netPips: number, startingAmount: number, valuePerPip: number) {
  if (![netPips, startingAmount, valuePerPip].every(Number.isFinite)
    || startingAmount <= 0 || valuePerPip <= 0) return null;
  const change = Math.round(netPips * valuePerPip * 100) / 100;
  const endingAmount = Math.round((startingAmount + change) * 100) / 100;
  const percentage = Math.round(change / startingAmount * 10_000) / 100;
  return [change, endingAmount, percentage].every(Number.isFinite) ? { change, endingAmount, percentage } : null;
}
