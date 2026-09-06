# D1 weekend optimization plan — 2026-09-04 to 2026-09-05

## Objective

Reduce the four remaining measured D1 read families without weakening email,
recommendation, support, or notification correctness. Work in small independent
phases on Friday and Saturday, when recommendation publishing is normally idle.

Typing `go` in the existing Codex thread on Friday means: begin Phase 0, report
the fresh evidence, and continue one phase at a time only while its gates pass.
It does not authorize destructive cleanup, deleting history, changing business
truth, suppressing alerts, or silently combining unrelated releases.

## Baseline captured Wednesday, 2026-09-02

- Measurement time: 13:34 Asia/Amman / 10:34 UTC.
- Conservative post-reset upper bound: 1,147,541 rows read, 7,545 rows written.
- Latest-hour pace: 144,857 rows read and 1,264 rows written.
- Projected daily range: approximately 2.7–3.1 million reads and 18–25 thousand
  writes, below the Free-plan 5 million / 100 thousand daily limits.
- Rolling 24-hour telemetry: 4,244,071 rows read and 70,055 rows written. Do not
  confuse this rolling value with the UTC-day quota counter.
- Database size: 300,838,912 bytes, about 60% of the 500 MB per-database limit.
- Worker `/health` and `/api/test/db` both returned HTTP 200.
- Migration 096 remained effective: staff deduplication used 10 rows for 10
  executions; the former support-message OR query did not appear.

Measured remaining families over the ten-hour sample:

1. Recommendation delivery status report: 203,256 rows / 8 runs / 25,407
   average rows.
2. Notification email-status updates: 182,256 rows / 24 runs / 7,594 average
   rows for the multi-user shape, plus a smaller single-user shape.
3. Staff badge aggregation: 130,878 rows / 73 runs / 1,792 average rows.
4. Email-outbox health aggregation: 50,446 rows / 11 runs / 4,586 average rows,
   concentrated in the latest hour.

## Non-negotiable safety rules

- Preserve unrelated Live Package work already present in the shared worktree.
  Before implementation, require a clean tree or an isolated branch/worktree;
  never stage or deploy those changes with this release.
- If Friday work begins before the 00:00 UTC reset (03:00 Asia/Amman), measure
  only and defer migration writes until after the reset.
- Capture a Time Travel bookmark before every production migration.
- Use a new migration number chosen from the repository state on Friday; do not
  assume 097 because that number is already present in current Live Package
  work.
- One phase, one focused migration/code change, one commit, and one production
  verification checkpoint. Do not bundle all four opportunities.
- Before a migration, require: today's writes + estimated index entries + a
  40,000-row operational buffer < 100,000. If this fails, defer the migration.
- Preserve recommendation and support delivery ordering, email alert semantics,
  exact badge truth, notification history, and mutation-triggered refreshes.
- No date cap on unread/open truth. No deletion, archiving, marking old rows as
  read, or queue repair without separate explicit approval and reconciliation.
- Every changed SQL path needs a production-shaped SQLite contract,
  result-equivalence coverage, and `EXPLAIN QUERY PLAN` asserting the intended
  index. An unexpected scan blocks deployment.
- Apply schema first, verify plans, then deploy Worker. Pages should not deploy
  unless a frontend behavior actually changes.
- After each phase, check D1 rows read/written, Worker health, database health,
  cron schedules, relevant authenticated behavior, and error evidence. Stop on
  regression or ambiguous telemetry.

## Phase 0 — Friday re-baseline and isolation gate

Read-only until the go/no-go report is accepted:

1. Verify Cloudflare identity, branch/upstream, worktree isolation, current
   migration ledger, and latest production Worker version.
2. Measure since-reset D1 totals plus 1-hour and 6-hour query families. Confirm
   whether Friday's idle recommendation period actually lowers traffic.
3. Inspect exact production table sizes, relevant index lists/info, schema, and
   query plans. Record current per-query rows, runs, duration, and results.
4. Inspect email-outbox health counts and error evidence. A genuine stale or
   dead-letter condition is an operational incident, not merely a query-cost
   problem; do not optimize it away.
5. Explain why the recommendation report ran eight times even though its known
   caller is daily maintenance. Check cron/deployment/error evidence before
   changing its SQL.
6. Estimate each candidate migration's index entries and ongoing write
   amplification. Rank phases again using Friday's evidence.

Phase 0 exit: publish a short table of baseline, candidate, expected saving,
write cost, correctness risk, and proceed/defer decision for each family.

## Phase 1 — Email-outbox health aggregation

Reason for first position: it was the largest current-hour reader and each run
averaged about 269 ms, which can also affect single-threaded D1 throughput.

Plan:

1. Confirm whether `hasEmailOutboxAnomaly()` is returning true because of a
   real persistent anomaly. Preserve the cheap indexed existence probe.
2. Prove the current `getEmailOutboxHealth()` result against a production-shaped
   fixture containing pending, due, stale, failed, processing, dead-letter,
   support-reply, sent, null, and boundary-time rows.
3. Prototype split selective aggregates/probes that can use the existing
   `(status, nextAttemptAt)` index. Evaluate narrow additional indexes only for
   uncovered facts such as oldest active creation, support-reply state, or last
   sent time. Do not add a broad index without measured net savings.
4. Keep the exact response and alert threshold/content. Do not hide anomalies,
   reduce delivery priority, or make scheduled failures fatal.
5. Compare exact old/new result sets and D1-style rows read. Deploy only if the
   reduction is material and ongoing index-write cost remains small.

Phase 1 stop rule: if the full aggregation runs only during a real rare anomaly,
fix/understand the incident and defer query code unless projected normal-day
savings justify the added complexity.

## Phase 2 — Notification email-status updates

This is the strongest direct index candidate.

Plan:

1. Validate both exact updates used by `markNotificationEmailSent()` and
   `markNotificationEmailsSent()` against production schema and plans.
2. Test a narrow non-unique partial composite index shaped like
   `(batch_id, user_id) WHERE batch_id IS NOT NULL`. Confirm it supports both
   single-user equality and bounded `IN (...)` batch updates.
3. Reconcile its benefit with the existing partial history index and production
   legacy indexes; do not create a redundant equivalent.
4. Measure eligible index entries before application. Apply only under the
   daily write-buffer rule, then verify exact update plans without modifying a
   real notification row.
5. Deploy schema declaration/tests and Worker only if application code changes;
   an index-only phase needs no Pages deployment.

Phase 2 success target: reduce thousands of rows read per email-status update to
the matching batch/user rows while preserving idempotent `email_sent = true`.

## Phase 3 — Recommendation delivery status report

The current 24-hour status aggregate has an index-order mismatch: production
has status-first delivery indexes, while the report starts with a creation-time
range. However, an index alone may still read every delivery in the 24-hour
window, so this phase begins with a frequency and cardinality diagnosis.

Plan:

1. Explain the eight observed executions of a nominally daily check. Eliminate
   duplicate invocation/retry causes before tuning the query.
2. Compare exact plans and row counts for:
   - the current grouped query;
   - a covering `(createdAt, status)` candidate;
   - bounded per-status counts using existing `(status, ..., createdAt)` paths;
   - a durable daily summary only if neither query option produces material
     savings and its extra writes/consistency model are justified.
3. Preserve the exact sent/failed/pending/skipped/dead-letter totals and anomaly
   ratio. Cover status variants, empty windows, boundary timestamps, and rows
   older than 24 hours.
4. Prefer fixing duplicate scheduling or a narrow covering index over a new
   summary table. A summary table is a separate design decision, not an assumed
   weekend change.

Phase 3 stop rule: accept “no code change” if the report is truly once daily or
if every correct alternative still reads approximately the same 24-hour rows.

## Phase 4 — Staff badge aggregation

Production already has an index shaped for `(userId, isRead, actionUrl)`.
Therefore another similar index will not solve the measured 1,792 rows per run;
the cost represents exact unread truth for users with accumulated notifications.

Plan:

1. Verify the exact existing index and plan, per-user unread cardinality, route
   grouping, role fan-out, and actual visible-tab request rate.
2. Reconfirm that the 120-second visible-only polling and immediate mutation
   invalidation are working. Do not slow freshness further without a separate
   UX decision.
3. Compare two designs only if the daily cost remains material:
   - transactionally maintained per-user/per-route unread counters with a
     reconciliation path; or
   - short-lived Worker-side caching with immediate invalidation after every
     notification create/read/mark-all operation.
4. Test multi-recipient fan-out, null routes, duplicate notification attempts,
   individual read, route read, mark all, concurrent updates, and cache/counter
   recovery. Exact total and by-route results must match the source table.

Phase 4 stop rule: prefer no change over a counter/cache design that risks stale
badges or adds more D1 writes than the roughly 131k reads saved per ten hours.

## Saturday validation and closeout

1. Compare at least one clean post-phase measurement window with Friday's
   baseline. Attribute savings per fingerprint; do not rely only on total D1.
2. Run focused contracts, the critical cycle, TypeScript, Worker build, and
   application build if frontend/server code changed.
3. Apply/deploy only the next independent phase whose gates pass. Do not proceed
   merely because quota is available.
4. Verify health, D1 connectivity, delivery schedules, email-outbox behavior,
   staff badges, notification email indicators, and recommendation anomaly
   reporting.
5. Update project memory and this runbook with measurements, migration hashes,
   bookmarks, commit/deployment IDs, deferred decisions, and rollback commands.
6. Commit and push each validated phase with a narrow release message. End with
   a clean worktree and a final safe/unsafe daily projection.

## Expected Friday interaction

User message: `go`

Codex response/action: acknowledge this runbook, detect any newer repository or
production state, execute Phase 0 read-only, report the refreshed ranking, and
then begin only the first approved implementation phase. If this thread or file
is unavailable, reference:

`docs/d1-weekend-optimization-plan-2026-09-04.md`
