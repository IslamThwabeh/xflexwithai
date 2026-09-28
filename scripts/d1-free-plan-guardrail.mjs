#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

process.noDeprecation = true;

export const FREE_PLAN_LIMITS = {
  rowsRead24h: 5_000_000,
  rowsWritten24h: 100_000,
  databaseSizeBytes: 500 * 1024 * 1024,
};

export const STATUS_THRESHOLDS = {
  passRowsRead24h: 3_500_000,
  cautionRowsRead24h: 4_500_000,
  passRowsWritten24h: 60_000,
  cautionRowsWritten24h: 80_000,
  cautionDatabaseSizePercent: 80,
  unsafeDatabaseSizePercent: 95,
};

export function stripAnsi(input) {
  return String(input ?? "").replace(/\u001b\[[0-9;]*m/g, "");
}

export function extractJsonPayload(output) {
  const clean = stripAnsi(output).trim();
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (char !== "{" && char !== "[") continue;
    try {
      return JSON.parse(clean.slice(index));
    } catch {
      // Wrangler may print warnings before JSON. Keep scanning for the real
      // JSON payload instead of binding to a fragile line number.
    }
  }
  throw new Error("Could not find a JSON payload in Wrangler output.");
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function compactQuery(query) {
  return String(query ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function metricBand(metric, value, percentOfLimit) {
  if (metric === "rows_read_24h") {
    if (value >= FREE_PLAN_LIMITS.rowsRead24h || value > STATUS_THRESHOLDS.cautionRowsRead24h) return "unsafe";
    if (value >= STATUS_THRESHOLDS.passRowsRead24h) return "caution";
    return "pass";
  }

  if (metric === "rows_written_24h") {
    if (value >= FREE_PLAN_LIMITS.rowsWritten24h || value > STATUS_THRESHOLDS.cautionRowsWritten24h) return "unsafe";
    if (value >= STATUS_THRESHOLDS.passRowsWritten24h) return "caution";
    return "pass";
  }

  if (metric === "database_size") {
    if (percentOfLimit >= 100 || percentOfLimit >= STATUS_THRESHOLDS.unsafeDatabaseSizePercent) return "unsafe";
    if (percentOfLimit >= STATUS_THRESHOLDS.cautionDatabaseSizePercent) return "caution";
    return "pass";
  }

  return "pass";
}

function overallStatus(metrics) {
  if (metrics.some((metric) => metric.band === "unsafe")) return "unsafe";
  if (metrics.some((metric) => metric.band === "caution")) return "caution";
  return "pass";
}

function buildMetricRows(info) {
  const rowsRead = Number(info.rows_read_24h ?? 0);
  const rowsWritten = Number(info.rows_written_24h ?? 0);
  const databaseSize = Number(info.database_size ?? 0);

  const rows = [
    {
      metric: "rows_read_24h",
      label: "Rows read",
      current: rowsRead,
      limit: FREE_PLAN_LIMITS.rowsRead24h,
      percentOfLimit: (rowsRead / FREE_PLAN_LIMITS.rowsRead24h) * 100,
    },
    {
      metric: "rows_written_24h",
      label: "Rows written",
      current: rowsWritten,
      limit: FREE_PLAN_LIMITS.rowsWritten24h,
      percentOfLimit: (rowsWritten / FREE_PLAN_LIMITS.rowsWritten24h) * 100,
    },
    {
      metric: "database_size",
      label: "Database size",
      current: databaseSize,
      limit: FREE_PLAN_LIMITS.databaseSizeBytes,
      percentOfLimit: (databaseSize / FREE_PLAN_LIMITS.databaseSizeBytes) * 100,
    },
  ];

  return rows.map((row) => ({
    ...row,
    band: metricBand(row.metric, row.current, row.percentOfLimit),
  }));
}

function insightTable(title, rows, valueField) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const lines = [`## ${title}`, "", `| # | ${valueField} | Runs | Avg rows read | Avg ms | Query fingerprint |`, "|---:|---:|---:|---:|---:|---|"];
  if (!safeRows.length) {
    lines.push("| 1 | 0 | 0 | 0 | 0 | No rows returned |");
    return lines.join("\n");
  }

  safeRows.slice(0, 10).forEach((row, index) => {
    const value = row[valueField] ?? row.totalRowsRead ?? row.totalRowsWritten ?? row.numberOfTimesRun ?? 0;
    lines.push([
      `| ${index + 1}`,
      formatInteger(value),
      formatInteger(row.numberOfTimesRun),
      formatInteger(row.avgRowsRead),
      (Number(row.avgDurationMs) || 0).toFixed(2),
      `\`${compactQuery(row.query).replaceAll("|", "\\|")}\` |`,
    ].join(" | "));
  });
  return lines.join("\n");
}

export function buildGuardrailReport({
  info,
  topReads = [],
  topWrites = [],
  topCounts = [],
  generatedAt = new Date(),
  insightsWindow = "1d",
}) {
  const metrics = buildMetricRows(info);
  const status = overallStatus(metrics);
  const statusLabel = status.toUpperCase();
  const databaseName = info.name ?? "unknown";
  const generatedIso = generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt);

  const lines = [
    "# D1 Free-Plan Guardrail",
    "",
    `- Generated: ${generatedIso}`,
    `- Database: ${databaseName}`,
    "- `wrangler d1 info` window: trailing 24 hours.",
    `- \`wrangler d1 insights\` window: rolling ${insightsWindow}; experimental Cloudflare output.`,
    `- Overall status: **${statusLabel}**`,
    "",
    "## Free Plan Usage",
    "",
    "| Metric | Current | Free limit | Usage | Band |",
    "|---|---:|---:|---:|---|",
  ];

  metrics.forEach((metric) => {
    lines.push(`| ${metric.label} | ${formatInteger(metric.current)} | ${formatInteger(metric.limit)} | ${formatPercent(metric.percentOfLimit)} | ${metric.band} |`);
  });

  lines.push(
    "",
    "## Decision Bands",
    "",
    "- Pass: under 3.5M reads and under 60k writes in trailing 24 hours.",
    "- Caution: 3.5M-4.5M reads or 60k-80k writes.",
    "- Unsafe: above 4.5M reads, above 80k writes, or database size at/above 95% of 500 MB.",
    "- Block downgrade: at/above 5M reads, at/above 100k writes, at/above 500 MB, D1-limit errors, Worker CPU-limit errors, or functional regressions.",
    "",
    insightTable("Top Read Fingerprints", topReads, "totalRowsRead"),
    "",
    insightTable("Top Write Fingerprints", topWrites, "totalRowsWritten"),
    "",
    insightTable("Top Execution-Count Fingerprints", topCounts, "numberOfTimesRun"),
    "",
  );

  return { status, markdown: lines.join("\n") };
}

function runWranglerJson(args) {
  const wranglerExecutable = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const attempts = [
    { executable: wranglerExecutable, args },
    { executable: pnpmExecutable, args: ["exec", "wrangler", ...args] },
  ];
  const failures = [];

  for (const attempt of attempts) {
    try {
      const stdout = execFileSync(attempt.executable, attempt.args, {
        encoding: "utf8",
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return extractJsonPayload(stdout);
    } catch (error) {
      const stderr = stripAnsi(error.stderr ?? "");
      const stdout = stripAnsi(error.stdout ?? "");
      const message = stripAnsi(error.message ?? "");
      const detail = [message, stderr, stdout].filter(Boolean).join("\n").trim();
      failures.push(`${attempt.executable} ${attempt.args.join(" ")}${detail ? `\n${detail}` : ""}`);
    }
  }

  throw new Error(`Wrangler command failed after ${failures.length} attempts:\n${failures.join("\n\n")}`);
}

function parseArgs(argv) {
  const options = {
    database: "xflexwithai-db",
    insightsWindow: "1d",
    skipInsights: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--time-period") {
      options.insightsWindow = argv[index + 1] ?? options.insightsWindow;
      index += 1;
    } else if (arg === "--skip-insights") {
      options.skipInsights = true;
    } else if (!arg.startsWith("--")) {
      options.database = arg;
    }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(options.database)) {
    throw new Error("Database name may only contain letters, numbers, underscores, and dashes.");
  }
  if (!/^[0-9]+[hdwmy]$/.test(options.insightsWindow)) {
    throw new Error("Insights time period must look like 1d, 24h, 7d, 4w, 3m, or 1y.");
  }

  return options;
}

export function runGuardrail(options) {
  const info = runWranglerJson(["d1", "info", options.database, "--json"]);
  const topReads = options.skipInsights
    ? []
    : runWranglerJson(["d1", "insights", options.database, "--time-period", options.insightsWindow, "--sort-by", "reads", "--sort-type", "sum", "--sort-direction", "DESC", "--limit", "10", "--json"]);
  const topWrites = options.skipInsights
    ? []
    : runWranglerJson(["d1", "insights", options.database, "--time-period", options.insightsWindow, "--sort-by", "writes", "--sort-type", "sum", "--sort-direction", "DESC", "--limit", "10", "--json"]);
  const topCounts = options.skipInsights
    ? []
    : runWranglerJson(["d1", "insights", options.database, "--time-period", options.insightsWindow, "--sort-by", "count", "--sort-type", "sum", "--sort-direction", "DESC", "--limit", "10", "--json"]);

  return buildGuardrailReport({
    info,
    topReads,
    topWrites,
    topCounts,
    insightsWindow: options.insightsWindow,
  });
}

/*
 * Keep the CLI below the exports so tests can import this module without
 * invoking Wrangler.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const result = runGuardrail(options);
  console.log(result.markdown);
  process.exitCode = result.status === "unsafe" ? 2 : 0;
}
