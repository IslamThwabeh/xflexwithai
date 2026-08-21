import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { buildRecommendationPeriodTradeStates } from "../backend/services/recommendation-report.service";

const event = (
  messageId: number,
  tradeId: number,
  occurredAt: string,
  cumulativePips: number,
) => ({
  messageId,
  tradeId,
  occurredAt,
  cumulativePips,
  outcome: cumulativePips < 0 ? "loss" as const : "win" as const,
});

describe("cumulative recommendation reporting", () => {
  it("collapses +50, +100, and +250 into one 250-pip trade contribution", () => {
    const [row] = buildRecommendationPeriodTradeStates({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      events: [
        event(1, 10, "2026-08-19T13:52:32.993Z", 50),
        event(2, 10, "2026-08-19T13:53:08.502Z", 100),
        event(3, 10, "2026-08-19T14:09:36.859Z", 250),
      ],
    });

    expect(row).toMatchObject({
      periodStartPips: 0,
      cumulativePips: 250,
      periodPips: 250,
      milestoneCount: 3,
      outcome: "win",
    });
  });

  it("counts only the incremental change when a cumulative target crosses months", () => {
    const [row] = buildRecommendationPeriodTradeStates({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      events: [
        event(1, 16, "2026-04-10T18:22:04.424Z", 30),
        event(2, 16, "2026-08-19T14:35:39.446Z", 150),
      ],
    });

    expect(row).toMatchObject({
      periodStartPips: 30,
      cumulativePips: 150,
      periodPips: 120,
      milestoneCount: 1,
    });
  });

  it("does not add duplicate cumulative milestones twice", () => {
    const [row] = buildRecommendationPeriodTradeStates({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      events: [
        event(1, 20, "2026-07-31T23:50:00.000Z", 100),
        event(2, 20, "2026-08-01T00:10:00.000Z", 100),
      ],
    });

    expect(row.periodPips).toBe(0);
    expect(row.cumulativePips).toBe(100);
  });

  it("keeps uncapped custom targets and refreshes the report after channel changes", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "frontend/src/pages/AdminRecommendations.tsx"),
      "utf8",
    );

    expect(source).toContain('key: "p250"');
    expect(source).toContain('key: "p300"');
    expect(source).toContain('placeholder={isRTL ? "قيمة أخرى" : "Custom pips"}');
    expect(source.match(/monthlyTradeReport\.invalidate\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
