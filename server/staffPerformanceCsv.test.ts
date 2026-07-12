import { describe, expect, it } from "vitest";
import {
  csvEscapeCell,
  rowsToCsv,
  staffPerformanceCsvFilename,
} from "../shared/staffPerformanceCsv";

describe("staff performance CSV utilities", () => {
  it("escapes commas, quotes, and multiline values", () => {
    expect(csvEscapeCell('Needs review, "today"\nplease')).toBe('"Needs review, ""today""\nplease"');
  });

  it("prefixes spreadsheet formula-like values", () => {
    expect(csvEscapeCell("=IMPORTXML(\"https://example.com\")")).toBe('"\'=IMPORTXML(""https://example.com"")"');
    expect(csvEscapeCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(csvEscapeCell("-10")).toBe("'-10");
    expect(csvEscapeCell("@hidden")).toBe("'@hidden");
  });

  it("builds a stable CSV from row keys", () => {
    expect(rowsToCsv([
      { date: "2026-07-10", status: "submitted", notes: "Done" },
      { date: "2026-07-11", status: "approved", notes: "Reviewed" },
    ])).toBe("date,status,notes\r\n2026-07-10,submitted,Done\r\n2026-07-11,approved,Reviewed");
  });

  it("normalizes export filenames", () => {
    expect(staffPerformanceCsvFilename("Manager Daily Logs", new Date("2026-07-10T12:00:00Z")))
      .toBe("staff-performance-manager-daily-logs-2026-07-10.csv");
  });
});
