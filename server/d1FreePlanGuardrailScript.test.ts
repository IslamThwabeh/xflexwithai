import { describe, expect, it } from "vitest";

import {
  buildGuardrailReport,
  extractJsonPayload,
  FREE_PLAN_LIMITS,
} from "../scripts/d1-free-plan-guardrail.mjs";

const infoFixture = {
  name: "xflexwithai-db",
  database_size: 286_535_680,
  rows_read_24h: 2_267_627,
  rows_written_24h: 17_613,
  read_queries_24h: 61_660,
  write_queries_24h: 7_292,
};

const insightFixture = [
  {
    query: "select status, count(*) from email_outbox where createdAt >= ? group by status",
    totalRowsRead: 213_716,
    totalRowsWritten: 0,
    avgRowsRead: 8_219,
    avgDurationMs: 11.68,
    numberOfTimesRun: 26,
  },
];

describe("D1 free-plan guardrail script", () => {
  it("extracts JSON after Wrangler warning output", () => {
    const output = "\u001b[33mWARNING\u001b[0m experimental command\n\n[{\"query\":\"select 1\",\"totalRowsRead\":10}]";
    expect(extractJsonPayload(output)).toEqual([{ query: "select 1", totalRowsRead: 10 }]);
  });

  it("reports pass status for the current free-plan target band", () => {
    const result = buildGuardrailReport({
      info: infoFixture,
      topReads: insightFixture,
      topWrites: insightFixture,
      topCounts: insightFixture,
      generatedAt: new Date("2026-09-28T09:30:00.000Z"),
      insightsWindow: "1d",
    });

    expect(result.status).toBe("pass");
    expect(result.markdown).toContain("Overall status: **PASS**");
    expect(result.markdown).toContain("Rows read");
    expect(result.markdown).toContain("Top Read Fingerprints");
    expect(result.markdown).toContain("rolling 1d");
    expect(result.markdown).toContain("experimental Cloudflare output");
  });

  it("blocks unsafe free-plan usage at or above hard limits", () => {
    const result = buildGuardrailReport({
      info: {
        ...infoFixture,
        rows_read_24h: FREE_PLAN_LIMITS.rowsRead24h,
        rows_written_24h: FREE_PLAN_LIMITS.rowsWritten24h,
      },
      generatedAt: new Date("2026-09-28T09:30:00.000Z"),
    });

    expect(result.status).toBe("unsafe");
    expect(result.markdown).toContain("Overall status: **UNSAFE**");
  });
});
