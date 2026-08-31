# Cloudflare D1 free-tier audit — source notes

## Decision

Determine whether XFlex can remain on Cloudflare Workers Free after D1 daily limits are enforced on September 1, 2026, and identify the smallest safe sequence of changes. This audit is diagnostic and planning-only.

## Scope and sources

- User-supplied Cloudflare email screenshots dated August 24, 2026: 5,000,000 rows read/day, 100,000 rows written/day, enforcement September 1, 2026, daily reset at 00:00 UTC.
- Live `wrangler d1 info` for production database `xflexwithai-db`, executed August 24, 2026: 10,912,314 rows read, 27,185 rows written, 142,146 read queries, 13,024 write queries, 267,464,704-byte database size over the trailing 24 hours.
- Live experimental `wrangler d1 insights` for rolling 1-day and 7-day windows, sorted independently by total reads, run count, and total writes. Bound values are not captured by Cloudflare.
- Live production index catalog from `sqlite_master` for the hot tables.
- Live production aggregate checks for notification, email-outbox, recommendation-message, and email-normalization shape. No personal values were selected.
- Live production `EXPLAIN QUERY PLAN` checks in `query-plans.sql` and individual read-only commands.
- Repository review of `wrangler-worker.toml`, `backend/_core/worker.ts`, `backend/db.ts`, `backend/routers.ts`, `frontend/src/components/DashboardLayout.tsx`, `frontend/src/components/ClientLayout.tsx`, and the support/recommendation pages.
- Official Cloudflare documentation: D1 pricing, metrics/analytics, billing, and index best practices as retrieved August 24, 2026.

## Metric definitions and time windows

- `rows read` and `rows written` are Cloudflare D1 billing metrics; query count itself is not billed.
- Current utilization uses the trailing 24-hour values returned by `wrangler d1 info` at approximately 20:00 Asia/Amman on August 24, 2026.
- Recurring-query comparison uses rolling seven-day D1 Insights totals divided by seven. It is a normalized daily average, not a UTC-calendar-day series.
- Current read utilization: 10,912,314 / 5,000,000 = 218.25%.
- Required reduction to reach the hard cap: 5,912,314 rows/day, or 54.18% of current reads.
- Current write utilization: 27,185 / 100,000 = 27.19%.
- Top ten recurring read families: 46,307,502 rows over seven days, or 6,615,357/day; 60.62% of the current trailing-24-hour total. Because the windows are not identical, this percentage is directional rather than an additive reconciliation.

## Verified drivers

1. `email_outbox` health aggregation scans the whole table. Seven-day total: 10,222,609 rows; normalized 1,460,373/day. The production table currently contains 3,742 rows and no pending/failed/dead-letter rows.
2. Recommendation summary aggregation scans `recommendationMessages` and runs a correlated child scan. Seven-day total: 9,863,467 rows; normalized 1,409,067/day. Production currently contains 1,056 recommendation-message rows.
3. Staff badge queries scan accumulated unread rows. Production has 19,914 unread staff notifications; 18,010 (90.44%) are `new_support_message`, and support messages plus human escalations are 97.47% of unread rows.
4. Case-insensitive key predicates wrap indexed email columns in `LOWER`/`TRIM`, preventing targeted index searches. Production aggregation found zero non-normalized nonblank emails across 148 registration keys and 127 users, so direct normalized equality is feasible if write-time normalization remains enforced.
5. Production plans confirm full scans for recommendation children, enrollment lookup, and the recommendation open-root path; the latter scans the created-date index rather than searching a selective index.
6. Frontend polling repeats expensive exact counts and feeds: staff badges every 30 seconds, admin recommendation summary/open feed every 30 seconds, client recommendation alerts every 15 seconds, support inbox every 8 seconds, and support message changes every 5 seconds while visible.

## Opportunity sizing

The recommendation is sized by observed read families, not a guarantee of exact savings. The first implementation batch addresses more than seven million observed rows/day across outbox checks, recommendation queries, notification polling/list/dedupe, normalized key lookups, and missing course/notification indexes. Overlap, traffic variation, query-plan changes, and new usage mean savings must be confirmed with a complete UTC day after deployment.

Decision thresholds:

- Target: less than 3.5 million rows read per UTC day (30% headroom).
- Caution: 3.5–4.5 million; proceed with notification-retention/counter work.
- Unsafe: more than 4.5 million; implement materialized counters/cache before relying on Free.
- Hard failure risk: 5 million or more after enforcement.

## Recommended sequence

1. Keep the minute delivery drain, but replace the full outbox health scan with an indexed anomaly existence check; run the full diagnostic only when an anomaly exists.
2. Combine staff unread total and route badges into one response; poll every two minutes only while visible and invalidate after read actions.
3. Reduce recommendation summary to five minutes or mutation-driven refresh, open-thread refresh to 60 seconds while visible, and disable background polling.
4. Add narrowly targeted non-unique indexes through one additive migration, validate with `EXPLAIN QUERY PLAN`, then run `PRAGMA optimize`.
5. Rewrite email joins/lookups to direct normalized equality and replace the correlated admin package-key listing with joined/pre-aggregated latest-subscription data.
6. Add client-side caching for terms status and static course data; throttle `lastActiveAt` updates.
7. After owner approval, redesign support alerts so one conversation does not create persistent unread rows for every message and every staff member; define retention or auto-read rules for old notifications.

## Validation assessment

- Overall: ready to use for prioritization, with implementation impact estimates requiring post-deploy measurement.
- Live 24-hour totals, seven-day query patterns, production index catalog, aggregate table shape, repository polling, and query plans agree on the principal drivers.
- D1 Insights is explicitly experimental, and its rolling window did not perfectly reconcile with the separately sampled trailing-24-hour total. Ranking and order-of-magnitude conclusions are reliable; exact savings are provisional.
- This audit covers the D1 limits shown in the email. It is not a full audit of Workers request, CPU, R2, Pages, email-provider, or third-party free-tier quotas.

## Diagnostic safety note

No application rows, schema, indexes, code, schedules, or settings were changed. One batch containing only `EXPLAIN QUERY PLAN` statements was sent through Wrangler's remote `--file` import path; Wrangler reported zero rows read and zero rows written but marked the database bookmark as changed. All subsequent plans used individual `--command` calls and reported `changed_db: false`.

## Chart contract

- Analytical question: which recurring D1 query families consume the most rows per day?
- Takeaway: the top ten average 6.62 million rows/day, already above the entire free allowance; the first two alone average 2.87 million/day.
- Family/type: comparison and ranking, horizontal bar.
- Grain: one row per normalized query family from the rolling seven-day Insights window.
- Measure: seven-day total rows divided by seven; zero baseline.
- Palette: single-root preferred, no redundant legend.
- Final surface: canonical portable HTML report.

## Report structure mapping

- Title: `Cloudflare D1 Free-Tier Plan`.
- Executive Summary: direct decision and risk.
- Key findings with visual evidence: current utilization, concentrated hot queries, and notification accumulation.
- Recommended next steps: two implementation batches with verification gates.
- Further questions: notification retention and acceptable refresh latency.
- Caveats and assumptions: rolling windows, experimental Insights, D1-only scope, and no guaranteed savings.

## Delivery QA

- The canonical artifact schema validated and the report was generated as a self-contained HTML file.
- The combined Windows delivery helper reproduced its known static-chart horizontal-overflow false positive, so the canonical-builder fallback was used.
- Direct local Chromium checks passed at 1440 × 900 and 390 × 900 in both light and dark system modes: correct title/heading, rendered chart content, no horizontal overflow, no browser errors, and no external network requests.
- Keyboard activation of chart options exposed `Explore chart` and `View data source`.
- This validates the delivered file in the tested Chromium contexts; it is not full Safari, Firefox, touch, print, or conversion certification.
