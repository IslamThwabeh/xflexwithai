# Cloudflare D1 Free-Tier Optimization — Small-Task Release Plan

Date: 2026-08-24
Status: Recommendation 1, the survey-notification SQL hotfix, Tasks 2.2-2.4, sent-history Task 7.1, and recommendation Tasks 3.1-3.5 are deployed. Task 3.6 is measurement-only; the next decision requires the complete UTC 2026-08-27 post-release sample, available after 2026-08-28 03:00 Asia/Amman.

Local implementation progress on 2026-08-24:

- Task 0.2 completed locally: `pnpm run test:critical-cycle` now covers 23 files / 156 tests.
- Task 1.1 completed locally: an exact-SQL, indexed anomaly probe was added and validated independently before scheduler integration.
- Task 1.2 completed locally: the minute scheduler now gates the full diagnostic behind the indexed anomaly probe while keeping delivery work first.
- Task 1.3 completed locally: detailed Admin Email Logs health refresh is now five minutes while visible, pauses while hidden, refreshes on focus, and still invalidates immediately after a manual drain.
- Recommendation 1 deployed from `ebb3aca`: Worker `0330d947-a12b-44a1-942a-1221c0a84bd8` and Pages `9d06e2aa-dd1f-4867-8523-33baf0784821`. Both schedules, health endpoints, private headers, exact frontend asset, production index plans, and bounded live probes passed.
- Immediate monitoring exposed an unchanged survey-notification insert using `ON CONFLICT(dedupe_key)` against production's partial unique index. The exact application SQL now uses targetless `ON CONFLICT DO NOTHING`; a production-shaped contract test covers non-null dedupe and repeatable null keys.
- Hotfix gates pass: 24 files / 158 critical-cycle tests, 107 files / 588 full tests, TypeScript, application build, Worker build, focused survey tests, and diff hygiene.
- No database migration, production data repair, schedule change, or Pages redeploy is required for the survey hotfix.
- August 25, 2026 (complete UTC day) used 7,628,225 rows read and 25,385 rows written. Reads fell 33.28% from August 24's 11,434,205, but remained 52.56% above the 5,000,000-row free limit and 117.95% above the 3,500,000 internal target.
- The latest rolling-24-hour sample on August 26 reported 8,650,778 rows read, down 20.72% from the original 10,912,314 sample. The outbox-health family itself fell from approximately 1.46 million rows/day to about 70 thousand rows in the latest rolling day, confirming Recommendation 1 worked but was insufficient by itself.
- Production already has `idx_staff_notif_isRead` and `idx_staff_notif_actionUrl`, and read-only `EXPLAIN QUERY PLAN` confirmed both badge queries use covering index searches. Task 2.1 is therefore skipped: adding another overlapping index would increase writes/storage without improving this plan.
- Task 2.2 added one grouped staff-badge query and protected endpoint returning `{ total, byRoute }`; the two legacy endpoints remain available for rollback.
- Task 2.2 local gates pass: exact production-shaped SQL and index-plan tests, authorization tests, 26 files / 162 critical-cycle tests, 114 files / 607 full tests, TypeScript, application build, Worker build, and diff hygiene.
- Task 2.2 was released from commit `75840c6` as Worker version `83f692e6-fd30-4a5c-9d50-0d6535d3bab5`. Both health domains returned 200, both cron schedules were preserved, and anonymous access to `staffNotifications.badgeCounts` returned 401. The frontend still used the legacy endpoints during this stage.
- Task 2.3 was released from commit `29513c9` as Pages deployment `773da9dc`. Production and preview route smoke passed, private admin headers remained intact, and the production dashboard asset contained the combined endpoint without either legacy passive query.
- Task 2.3 gates pass: focused badge contracts, 27 files / 164 critical-cycle tests, 115 files / 609 full tests, TypeScript, application build, Worker build, and diff hygiene.
- Task 2.4 is validated locally: combined badge polling pauses while the document is hidden and refetches on visible/focus without changing the 30-second visible cadence or any support-inbox polling.
- Task 2.4 gates pass: focused visibility contracts, 27 files / 165 critical-cycle tests, 115 files / 610 full tests, TypeScript, application build, Worker build, and diff hygiene. The unauthenticated local preview rendered the app shell; authenticated request timing remains a production smoke/measurement item because local preview has no staff session or API proxy.
- Task 2.4 was released from commit `ac53dd2` as Pages deployment `4ccb41cb`. Production and preview returned 200 with identical dashboard assets; visibility handling and the combined endpoint were present, both legacy passive badge queries were absent, private admin headers remained intact, and the production API health check passed.
- Read-only production profiling found 28,559 batched `user_notifications` rows: 861 in one day, 1,330 in three days, 2,687 in seven days, and 8,182 in thirty days. The current and date-filtered plans both scan the full table because production has no `created_at` index; a UI-only date cap would therefore not reduce D1 rows read.
- Task 7.1 was applied from commit `7abda83` after all local gates passed. Pre-migration Time Travel bookmark: `00001175-000002e8-000050d3-a6b6310d56b44467c65800eb30afdcc9`; post-index bookmark: `00001175-000002ef-000050d3-e840ed51130789d8430773c81793a144`.
- Index construction wrote 29,280 index entries and did not update notification records. Production reconciliation confirmed the non-unique partial index on physical columns `created_at, batch_id`, zero foreign-key violations, no row loss during concurrent notification growth, and an indexed `created_at>?` range search with no `user_notifications` table scan. Migration 090 is recorded exactly once as `schema_migrations.id = 31`.
- The August 26 rolling-day sample identifies the recommendation family as the September 1 blocker: thread summary used 4,037,990 rows across 187 runs, stale delivery reconciliation used 1,049,497 across 398 runs, and open-root listing used 570,934 across 526 runs. These three alone exceed the 5 million daily allowance.
- Production `recommendationMessages` has 1,125 rows (348 roots, 729 results, 47 updates) but only separate `threadStatus, createdAt` and `createdAt` indexes. The exact summary plan scans both the outer table and its correlated child lookup.
- Task 3.1 is validated locally as migration 091: one non-unique composite index covers root ordering plus child/result lookups without adding overlapping indexes. Its production-shaped test preserves null-status, duplicate-result, and orphan legacy rows; removes child/root scans; and passes 29 files / 167 protected tests, 117 files / 612 full tests, TypeScript, both builds, and diff hygiene.
- Before Task 3.1, a full production D1 export was saved under the ignored private backup directory at `tmp/private-backups/2026-08-26-before-091-recommendation-index/xflexwithai-production-before-091-20260826-181028.sql` (310,908,725 bytes; SHA-256 `8F194BA673BC48CA72E0B9BC23926DE3C6BF66BCB08C6BF5963AFFDCD462946D`). Pre-migration Time Travel bookmark: `00001175-0000038f-000050d3-9acef8d1bd406a489f378f1318802e61`.
- Migration 091 was applied from commit `6beec09`; post-index bookmark: `00001175-00000395-000050d3-3b1ed2666eaa8ece208674dca39d5972`. It created 1,126 index entries without changing any of the 1,125 recommendation-message rows and is recorded once as `schema_migrations.id = 32`.
- Production plans now search the new index for summary result existence, open roots, child hydration, and stale-delivery result checks. Foreign-key integrity is clean. The exact aggregate summary probe returned the same totals while reading 1,141 rows versus the prior 21,593-row average, an immediate approximately 94.7% reduction.
- Task 3.2 keeps the public summary shape unchanged but splits the former unfiltered table aggregate into root-only and child-only aggregates executed in parallel. Both predicates align with `idx_recommendation_messages_parent_type_created_id`; do not recombine them into one unfiltered aggregate without first passing the exact production-shaped plan contract.
- Task 3.2's SQL contract executes the ORM-generated SQL against physical production column names, proves exact equivalence with the legacy aggregate for empty, null-status, open, closed, duplicate-result, orphan-update, root-result, and child-recommendation cases, and rejects any plan that scans `recommendationMessages` or the correlated `child` table.
- Local Task 3.2 gates passed: 29/29 protected recommendation tests, 169/169 critical-cycle tests across 30 files, 614/614 full tests across 118 files, TypeScript, the application/server production build, and the Worker build. No migration or production data write belongs to this task.
- Task 3.2 deployed from commit `c56d41f` as Worker version `1ce2c5b9-d52b-46c7-8b28-bdbd9ea800c7`. Both health endpoints returned 200, anonymous `recommendations.threadSummary` returned 401, and both existing cron schedules were preserved.
- Read-only production reconciliation returned 348 roots (17 open, 331 closed, 1 needing a result), 729 result messages, and 47 updates with `changed_db = false` and `rows_written = 0`. Root and child aggregates read 365 and 776 rows respectively (1,141 total), equal to the already-indexed post-091 legacy probe. Therefore Task 3.2 removes the plan-level table scan and locks index-safe growth, but its current-data row saving must not be counted in addition to Task 3.1's approximately 94.7% reduction.
- Task 3.3 is locally validated as a frontend-only change: authorized admins/analysts poll `threadSummary` every 60 seconds only while the document is visible, hidden and unauthorized/logged-out states make no passive summary requests, and focus or hidden-to-visible return refreshes immediately. All existing mutation invalidations remain intact; `publishState` remains one second and admin `openThreads` remains 30 seconds for their separate decisions.
- Task 3.3 gates pass: focused polling contracts, 31 files / 172 critical-cycle tests, 119 files / 617 full tests, TypeScript, the application/server production build, the Worker build, and diff hygiene. No Worker change, D1 migration, or production data write belongs to this task.
- Task 3.3 deployed from commit `bab3a4e` as Pages deployment `08b3e864` (`https://08b3e864.xflexwithai.pages.dev`). Production and preview returned 200 for public, auth, and admin-recommendation routes; private headers remained `noindex, nofollow` and `no-store, private`; both served the same exact `AdminRecommendations-BiPIw0XC.js` bundle with the visibility gate, 60-second summary cadence, focus refresh, one-second `publishState`, 30-second admin `openThreads`, and mutation invalidations. The unchanged Worker health returned 200/production and anonymous summary access returned 401. No Worker deploy or D1 write occurred.
- Task 3.4 is locally validated as a frontend-only change: authorized admins/analysts poll `openThreads` every 60 seconds only while visible, hidden and unauthorized/logged-out states make no passive feed requests, and focus or hidden-to-visible return refreshes immediately. Existing mutation invalidations remain intact; `publishState` remains one second and admin `threadSummary` remains 60 seconds.
- Task 3.4 gates pass: two focused polling contracts, 32 files / 175 critical-cycle tests, 120 files / 620 full tests, TypeScript, the application/server production build, the Worker build, and diff hygiene. No Worker change, D1 migration, or production data write belongs to this task.
- Task 3.4 deployed from commit `b01fd9a` as Pages deployment `5f9fe5f0` (`https://5f9fe5f0.xflexwithai.pages.dev`). Production and preview route/header smoke passed and served the same exact `AdminRecommendations-r9TlUXrY.js` bundle with both protected 60-second cadences, visible/focus behavior, the unchanged one-second `publishState`, and immediate open-thread invalidations. The unchanged Worker health returned 200/production and anonymous open-thread access returned 401. No Worker deploy or D1 write occurred.
- Task 3.5 is locally validated as a frontend-only change: eligible signed-in clients poll `openThreads` every 60 seconds only while visible; hidden, ineligible, and logged-out states make no passive feed requests; focus or hidden-to-visible return refreshes immediately. Reaction, mute, and unmute invalidations remain immediate, while `activeAlerts` remains 15 seconds and recommendation email delivery is unchanged.
- Task 3.5 gates pass: three focused polling contracts / 9 tests, 33 files / 178 critical-cycle tests, 121 files / 623 full tests, TypeScript, the application/server production build, the Worker build, formatting, and diff hygiene. A local static-browser smoke served `/recommendations` and loaded the compiled app shell; authenticated API timing is covered by the focused contract because the static preview intentionally has no `/api/trpc` backend. No Worker change, D1 migration, production API mutation, or production data write belongs to this task.
- Task 3.5 permits a maximum passive visible-page delay of 60 seconds for a recommendation published elsewhere; returning to the page refreshes immediately, and email delivery timing is unchanged. Task 3.6 must measure one complete UTC day before any decision about the 15-second `activeAlerts` or one-second analyst `publishState` loops.
- Task 3.5 deployed from commit `a866c3c` as Pages deployment `95b59d6a` (`https://95b59d6a.xflexwithai.pages.dev`) after the isolated Task 3.4 soak remained clean. Production and preview served the exact locally validated `Recommendations-D9PHm4BO.js` bundle with SHA-256 `79BF7400C0D3FAA6F2943BDA5687D90CE84AE1CD27EAA0CDD419621558256040`; private route headers remained `noindex, nofollow` and `no-store, private`; API health returned 200 and anonymous open-thread access returned 401. No Worker deploy, migration, D1 write, or production API mutation occurred.
- Task 3.6 collection window: Task 3.5 went live during UTC 2026-08-26. Use UTC 2026-08-27 as the first complete post-release day; it closes at 2026-08-28 03:00 Asia/Amman. The tomorrow-night review must capture total D1 rows read/written, rows and runs for recommendation summary/open-root/open-thread/stale-reconciliation fingerprints, and Worker error/limit evidence. Do not tune `activeAlerts` or `publishState` before this evidence is reviewed.

## Goal

Reduce production D1 reads from the observed 10.9 million rows per trailing 24 hours to below 3.5 million rows per complete UTC day, while preserving every customer, support, recommendation, email, course, key, and staff-session rule.

The work is intentionally split into small releases. A task is not allowed to share a release with the next task. The next task starts only after the current task passes its local gates, production smoke, reconciliation, and short soak.

## Non-negotiable protected cycle

Every task must preserve all of these behaviors, even when the task does not directly edit that area:

- The `* * * * *` Worker schedule and bounded email/recommendation drain remain active.
- Human support replies keep their reserved transactional email lane and approximately one-minute delivery target.
- Recommendation deliveries retain priority, BCC privacy, suppression checks, dedupe, stale-delivery reconciliation, eligibility revalidation, and provider-acceptance audit.
- New top-level recommendations keep the client-notification wait/lock. Old-thread updates and results keep their established behavior. The analyst `publishState` one-second refresh is not part of this optimization.
- Recommendation thread mute, result-before-close, cumulative-pips reporting, and current recipient eligibility remain unchanged.
- Staff inactivity remains 15 minutes with a two-minute warning. Polling must never count as real interaction.
- Course access remains lifetime for qualifying paid-course enrollment owners. Quiz progression, explicit failed-quiz bypass, and soft watch-progress repair remain unchanged.
- Basic and Comprehensive package rules remain unchanged, including old-student blocking, renewal stacking, Basic-to-Comprehensive upgrade handling, Comprehensive-to-Basic protection, configurable study period, terms evidence, order-linked activation, and pending timed-service activation.
- Account suspension, refund, service deactivation, and key activation protections remain server-enforced.
- Existing operational history is not deleted, deduplicated, rewritten, or backfilled by these tasks.
- Indexes are additive, idempotent, and non-unique. Past migrations are never edited.
- Private routes retain authentication, `noindex`, and private/no-store behavior.

## Gate applied to every task

1. Record the exact base commit and a read-only production baseline relevant to the task.
2. Add or update a focused regression test before changing behavior.
3. Make one narrowly scoped change and one meaningful commit.
4. Run focused tests, `pnpm run check`, the complete test suite, `pnpm run build`, `pnpm run build:worker`, and `git diff --check`.
5. Every new or changed SQL statement must pass a production-shaped SQL contract test before PRD: execute the exact application query against an isolated SQLite fixture with the physical production table and column names, bind realistic values, cover null/empty/legacy cases relevant to the query, and fail on any missing column or SQLite syntax error. TypeScript compilation or a mocked database test alone is not sufficient.
6. Every optimized read query must also pass `EXPLAIN QUERY PLAN` against that fixture. Assert the intended index name or bounded primary-key search and reject an unexpected full scan where the task exists to remove one. Raw production verification must use the physical column names from `sqlite_master`/`PRAGMA table_info`; do not infer names from Drizzle property names.
7. For a migration: test twice on isolated SQLite, prove it contains no `ALTER`, `DROP`, `DELETE`, `UPDATE`, `INSERT`, or unique index, capture a production Time Travel bookmark, get explicit production-write approval, then apply only that migration.
8. Reconcile row counts and foreign keys after a migration. Use individual read-only production `EXPLAIN QUERY PLAN` commands, not a Wrangler SQL file.
9. Deploy only the component that changed. If both changed, Worker precedes Pages.
10. Run production smoke for the affected flow and the protected-cycle matrix below. Do not create synthetic client emails, recommendations, keys, orders, or entitlements.
11. Observe errors and D1 Insights for at least 30–60 minutes. After each optimization wave, measure one complete UTC day before claiming savings.
12. If any gate fails, stop. Roll back application code to the prior Worker/Pages version. Do not automatically reverse a D1 migration; an unused additive index may remain while the safest recovery is reviewed.

## Task 0 — Freeze the baseline and regression matrix

### 0.1 Capture the release baseline

- Change: none; save base commit, Worker version, Pages deployment, both cron schedules, D1 24-hour totals, top query families, and relevant table counts.
- Verify: all commands are read-only and report `rows_written = 0` / `changed_db = false` where Cloudflare exposes them.
- Pass: the baseline is sufficient to compare each later task.
- Rollback: not applicable.

### 0.2 Add the cross-cycle test command/list

- Change: create a documented focused suite covering email outbox, support notification delivery, recommendation workflow/delivery/mute, package lifecycle/renewal, timed-service activation/access, course progression, terms, account access, and idle activity.
- Verify: run it unchanged against the current base first.
- Pass: the base is green, so later failures can be attributed to the task under test.
- Rollback: remove only the test-command/document change.

## Recommendation 1 — Stop the minute full-table outbox health scan

### 1.1 Add an indexed anomaly probe without using it

- Change: add a database helper that uses bounded `EXISTS`/`LIMIT 1` searches for stale due rows and dead letters. Keep `getEmailOutboxHealth()` unchanged for detailed admin diagnostics.
- Files: `backend/db.ts` and a focused outbox-health test.
- Verify: isolated SQLite `EXPLAIN QUERY PLAN` uses `idx_email_outbox_status_next_attempt`; helper returns true for stale pending/dead-letter fixtures and false for healthy/sent-only fixtures.
- Pass: no call site changes and the full suite remains green.
- Rollback: revert the helper commit.

### 1.2 Gate the scheduled diagnostic behind the anomaly probe

- Change: in `backend/_core/worker.ts`, run the lightweight probe each minute and call the full health aggregation only when the probe detects an anomaly.
- Verify: scheduled-job tests prove `runFrequentTimedServiceAndEmailJobs()` still runs every minute, healthy state skips the full aggregate, anomaly state still creates the same throttled staff alert, and an anomaly-check failure remains non-fatal.
- Pass: support-reply and recommendation delivery priority tests remain unchanged and green; both cron expressions remain present in the Worker deployment dry run.
- Rollback: restore the prior scheduled health block; the helper may safely remain unused.

### 1.3 Reduce passive Admin Email Logs health refresh

- Change: keep an explicit/manual detailed refresh, but stop full diagnostic polling while the tab is hidden and use a slower visible interval.
- Files: `frontend/src/pages/AdminEmailLogs.tsx` plus a focused source/UI test.
- Verify: opening the page still shows every current health field; “Drain due now” still invalidates and refreshes health immediately.
- Pass: no email send/drain behavior changes.
- Rollback: restore the previous query options.

## Recommendation 2 — Consolidate and slow staff badge reads

### 2.1 Add the staff-badge covering index

- Decision: skipped after production verification. Existing indexes `idx_staff_notif_isRead (userId, isRead)` and `idx_staff_notif_actionUrl (userId, isRead, actionUrl)` already cover the exact count and grouped-route predicates.
- Evidence: production `EXPLAIN QUERY PLAN` reports covering index searches for both legacy queries with zero rows read/written by the diagnostic commands.
- Safety: do not add a duplicate index. Revisit only if the application query shape changes and a new production plan proves the existing indexes insufficient.

### 2.2 Add one combined badge query and endpoint

- Change: add one backend response `{ total, byRoute }` computed by a single grouped query. Keep the two old endpoints temporarily.
- Files: `backend/db.ts`, `backend/routers.ts`, and a focused route/database test.
- Verify: fixtures with null routes, several routes, read rows, and different users exactly match the two legacy endpoint results.
- Pass: authorization remains `supportStaffProcedure`; no frontend change yet.
- Rollback: revert the new endpoint commit.

### 2.3 Switch the dashboard to the combined endpoint at the existing cadence

- Change: `DashboardLayout` consumes the combined response but keeps 30-second polling initially.
- Verify: bell total and every sidebar route badge match before/after fixtures; mark-one, mark-route, and mark-all actions invalidate the combined query immediately.
- Pass: there is no visible badge behavior change, only one request instead of two.
- Rollback: point the layout back to the two legacy endpoints.

### 2.4 Make badge polling visible-only

- Change: pause badge polling when the document is hidden; refetch on visible/focus.
- Verify: fake-timer/browser test records no hidden-tab requests and an immediate refresh on return.
- Pass: staff idle timers are not reset by polling or visibility refresh.
- Rollback: restore the prior query options.

### 2.5 Change the visible badge interval to two minutes

- Change: only the interval, from 30 seconds to 120 seconds.
- Verify: read-action invalidation still updates badges immediately; a newly created alert appears within two minutes without navigation.
- Pass: business accepts the maximum passive badge delay; support inbox message polling remains unchanged.
- Rollback: return the interval to 30 seconds.

## Recommendation 3 — Reduce recommendation summary and open-thread polling

### 3.1 Add recommendation root/child index coverage

- Change: one additive migration containing one non-unique composite index on `parentId, type, createdAt DESC, id DESC`. Its prefix covers child/result lookups and its suffix covers deterministic root ordering, avoiding overlapping indexes.
- Verify: existing message/thread counts are identical; duplicate/legacy-compatible rows remain valid; `EXPLAIN` makes open-root and child-hydration queries search the named index and removes the summary's correlated `SCAN child`. The summary's outer aggregate scan remains until Task 3.2.
- Pass: recommendation workflow tests, monthly reporting, mute, and delivery tests all pass.
- Rollback: do not drop the indexes automatically.

### 3.2 Replace the correlated thread-summary scan

- Change: rewrite only `getRecommendationThreadSummary()` using an indexed/pre-aggregated child result set while returning the exact existing shape.
- Verify: old and new queries are run against the same rich fixture and produce byte-equivalent normalized results for open, closed, no-result, result, update, and legacy-null status threads.
- Pass: no router or polling changes in this task.
- Rollback: restore the old query; the indexes may remain.

### 3.3 Slow only the admin thread summary

- Change: move the admin `threadSummary` passive refresh from 30 seconds to 60 seconds while an authorized admin/analyst keeps the document visible; stop passive refreshes while hidden or unauthorized/logged out, and refresh on focus or hidden-to-visible return.
- Verify: publish, update, result, close, delete, override, and mute mutations still invalidate the summary immediately; the focused source contract protects the visibility listener, cleanup, authorization gate, interval, focus behavior, and mutation invalidation.
- Pass: the one-second analyst `publishState` refresh and the admin `openThreads` 30-second cadence are untouched.
- Rollback: restore 30 seconds.

### 3.4 Slow only the admin open-thread feed

- Change: move admin `openThreads` to 60 seconds, visible only, with focus refresh.
- Verify: every existing mutation invalidates the feed; newly published/updated threads appear immediately after the local mutation and within 60 seconds if changed elsewhere.
- Pass: history/archive queries and reporting are untouched.
- Rollback: restore 30 seconds.

### 3.5 Slow only the client open-thread feed

- Risk: high because recommendations are time-sensitive.
- Change: move client `openThreads` from three seconds/background polling to 60 seconds while visible, disable background polling, and refetch immediately on focus.
- Verify: local browser timing proves a remotely published recommendation appears within 60 seconds on a visible page and immediately after returning to a hidden page; reactions and mute still invalidate immediately.
- Pass: the business accepts the up-to-60-second post-publication display delay, and email delivery timing is unchanged.
- Rollback: restore the three-second settings without touching backend queries or indexes.

### 3.6 Re-measure before touching active-alert or publish-state polling

- Change: none.
- Verify: one complete UTC-day D1 sample after Tasks 3.1–3.5.
- Pass: only create a later active-alert task if it is still a material driver. Do not optimize the one-second `publishState` loop without a separate workflow design.

## Recommendation 4 — Add the remaining narrow indexes

Each item below is its own migration, approval, application, reconciliation, and production `EXPLAIN` check. An index is created only if the current query and production plan prove it is needed.

### 4.1 Enrollment lookup index

- Target: user/course entitlement lookups.
- Protected tests: lifetime course ownership, refund/revocation, package access, and course watch progression.

### 4.2 Episode course/order index

- Target: static episode listing by course and order.
- Protected tests: eight level checkpoints, no-quiz behavior, watch-progress repair, and admin episode ordering.

### 4.3 Client-notification indexes

- Target: user/read counts and batch/user lookups.
- Protected tests: notification controls, read/unread state, recommendation eligibility, and per-client suppression.

### 4.4 Points ledger index

- Target: user/reference/date lookups only after a current plan proves a scan.
- Protected tests: ledger integrity and duplicate-reference behavior. Do not add uniqueness.

### 4.5 LexAI history index

- Target: user/date history only after a current plan proves a scan.
- Protected tests: Comprehensive eligibility, pending activation, expiry, freeze, and account restriction.

### 4.6 Run optimization maintenance separately

- Change: run `PRAGMA optimize` only after the required indexes are deployed and only with explicit production-write approval.
- Verify: schema/index catalog, foreign keys, key table counts, and query plans before/after.
- Pass: no business-row count or value changes.

## Recommendation 5 — Remove function-wrapped email joins and correlated key listing

### 5.1 Prove and lock write-time email normalization

- Change: centralize or test the existing normalization contract for every runtime write to `users.email` and `registrationKeys.email`. Do not rewrite production rows.
- Verify: mixed-case/space input is stored normalized, blank nullable key emails remain supported where intended, and uniqueness/business rules remain unchanged.
- Pass: read-only production check still reports zero non-normalized nonblank emails.
- Rollback: revert the normalization-code/test commit.

### 5.2 Rewrite single registration-key email lookups

- Change: replace runtime `LOWER`/`TRIM` predicates only where Task 5.1 proves both sides are normalized.
- Verify: activated, unused, order-linked, email-bound, expired, and missing-key fixtures return exactly the same result; `EXPLAIN` searches the email index.
- Pass: no key lifecycle decision code changes.
- Rollback: restore the original predicate.

### 5.3 Rewrite user-to-key joins and terms client detection

- Change: separately replace normalized-email function joins used for entitlement/terms detection.
- Verify: a result-equivalence test covers manual legacy entitlement, order evidence, fresh/old student, staff, no-entitlement, and current/missing terms acceptance.
- Pass: `TermsAcceptanceGate` remains fail-closed on verification errors.
- Rollback: restore the original joins.

### 5.4 Rewrite the admin package-key listing

- Risk: high because the page informs key-management decisions.
- Change: replace correlated latest-subscription lookups with joined/pre-aggregated latest LexAI and Recommendation rows. Do not alter activation or redemption mutations.
- Verify: old/new result equivalence covers Basic, Comprehensive, renewals, upgrades, active, expired, frozen, pending, unused, activated, duplicate history, nulls, exact ILS prices, service days, client name, and expiry.
- Pass: package-key lifecycle, renewal eligibility, pricing, configuration immutability, terms, order-linked activation, and timed-service suites all pass.
- Rollback: restore only the listing query.

## Recommendation 6 — Cache stable reads and throttle activity writes

### 6.1 Confirm the existing terms cache; do not duplicate it

- Current finding: `TermsAcceptanceGate` already uses a five-minute `staleTime`, disables focus refetch, and invalidates after acceptance.
- Change: add a regression test if coverage is missing; make no runtime change unless measurement shows another repeated terms call.
- Pass: acceptance immediately clears the gate and errors remain fail-closed.

### 6.2 Cache public course metadata

- Change: add appropriate client query `staleTime` for published course metadata only. Do not cache user access, enrollment, progress, quiz, or timed-service state as static data.
- Verify: course/episode admin mutations invalidate the affected public queries; a student still receives updated course content after invalidation/reload.
- Pass: lifetime access and progression tests remain green.
- Rollback: remove the cache options.

### 6.3 Throttle `lastActiveAt` writes with one conditional update

- Risk: medium-high because activity supports online/inactivity decisions.
- Change: make `touchUserActivity()` write at most once per chosen short window using a conditional `UPDATE`; do not add a read-before-write. Do not change `lastInteractiveAt` or staff-session heartbeat behavior.
- Verify: repeated authenticated polling produces one write per window; a genuine request refreshes an expired value; five-minute online detection, inactivity outreach boundaries, 15-minute staff idle, and cross-tab/IME activity tests remain correct.
- Pass: polling never extends real staff interaction and recommendation behavior remains based on `lastInteractiveAt` where designed.
- Rollback: restore unconditional non-blocking touch behavior.

### 6.4 Measure writes as well as reads

- Change: none.
- Verify: one complete UTC day after Task 6.3, comparing rows written and inactivity/email outcomes to baseline.
- Pass: writes decrease with no missed genuine-activity state transition.

## Recommendation 7 — Bound admin sent-notification history

This is safe only for the explicitly historical admin view. It must not be reused for unread badges, entitlement/access checks, open recommendation threads, or any workflow where old unresolved state remains active.

### 7.1 Add a partial sent-history range index

- Change: add one idempotent, non-unique partial index on `user_notifications(created_at DESC, batch_id) WHERE batch_id IS NOT NULL`.
- Verify: execute the migration twice against a production-shaped SQLite fixture; preserve duplicate, null-batch, empty-batch, and legacy-compatible rows; `EXPLAIN QUERY PLAN` for the bounded query must search the named index and must not scan `user_notifications`.
- Production gate: capture a Time Travel bookmark and receive explicit production-write approval before applying this migration. Reconcile row count and `foreign_key_check` afterward.
- Rollback: do not drop the additive index automatically; leave it unused while reviewing the safest recovery.

### 7.2 Add a bounded endpoint without switching the UI

- Change: accept a validated history period and compile an explicit `created_at >= ?` predicate for bounded periods. Keep an explicit all-history mode and the same 30-batch result limit.
- Verify: exact application SQL executes against physical production column names with realistic cutoff, null, empty, and legacy fixtures. Three-day results match the equivalent slice of all history and the named index is used.
- Pass: authorization remains admin-only; recipients, delivery summaries, send behavior, and existing invalidation remain unchanged.

### 7.3 Default the admin history view to three days

- Change: make three days the default on the admin sent-history panel and provide explicit 7-day, 30-day, and all-history choices. Changing the period refetches the same endpoint and collapses any expanded batch that is no longer visible.
- Verify: the admin can retrieve older batches deliberately, expand a visible batch, send a notification, and see the new batch immediately under every compatible period.
- Pass: only the historical listing is bounded; alert inbox, unread truth, and notification creation/delivery are unchanged.

### 7.4 Measure the history family

- Change: none.
- Verify: compare the sent-history query fingerprint after one complete UTC day. Confirm default calls use an indexed range search and all-history calls occur only through explicit admin selection.
- Pass: the family falls materially from the observed approximately 506 thousand rolling-day rows without a functional regression.

## Recommendation 8 — Redesign persistent support alerts only if still necessary

These tasks are intentionally blocked until Batch 1 is measured and the business owner approves notification semantics. They must not be mixed with query/index optimization.

### 8.1 Approve the notification contract

- Decide whether unread truth belongs to the support conversation, whether one staff alert per conversation/assignee is sufficient, when reopening should occur, and which events still require separate alerts/emails.
- No code or data change.

### 8.2 Profile the proposed rule read-only

- Quantify affected staff, conversations, unread rows, escalations, assignments, and the exact one-time reconciliation impact.
- No personal message content is selected.

### 8.3 Implement future-alert dedupe/upsert only

- Change future `new_support_message` notification creation so repeated messages update one actionable conversation alert according to the approved contract.
- Do not touch historical rows in the same task.
- Verify client/admin support, assignment, escalation, email, unread inbox, and direct-route behavior.

### 8.4 Align read behavior

- Make opening the correct conversation/route mark only the approved alert scope read, including direct page/deep-link entry.
- Verify another conversation's alert remains unread and polling does not mark messages read accidentally.

### 8.5 Reconcile old unread support alerts separately

- Risk: destructive production data change.
- Requires a written owner rule, exact preview counts, Time Travel bookmark, explicit production-write approval, audited bounded SQL, and post-write reconciliation.
- Never infer or fabricate historical read state.

### 8.6 Define retention separately

- No deletion is allowed until legal/support retention, audit fields to preserve, age threshold, backup, dry-run counts, rollback, and monitoring are approved.

## Production verification matrix

After every deployed task, run only the rows relevant to the change plus all critical rows marked below:

| Flow | Minimum verification |
|---|---|
| Worker schedules | Both cron expressions present; health endpoints 200 |
| Support email | Existing queue/service tests; no live synthetic email |
| Recommendation | Workflow, delivery, BCC, mute, summary/feed tests; no live synthetic recommendation |
| Staff alerts | Role authorization, badge totals/routes, read invalidation |
| Package/key | Lifecycle, renewal, pricing, configuration, activation navigation |
| Timed services | Pending/readiness/deadline/access and retry tests |
| Course | Lifetime entitlement, episode progression, quiz gates/bypass |
| Terms/order | Fail-closed status, acceptance invalidation, order evidence/key boundary |
| Account access | Suspend/login restriction/refund/service deactivation tests |
| Staff sessions | 15-minute policy, real interaction, cross-tab, hidden polling |
| Data integrity | Relevant pre/post counts; `foreign_key_check`; no history deletion |
| Privacy/security | Protected endpoint authorization and private route headers |

## Measurement checkpoints and stop rules

- After Recommendation 1: confirm the outbox-health family collapses without delivery anomalies.
- After Recommendation 2: confirm staff badge query count and rows read decrease, with badge freshness accepted by staff.
- After Recommendation 3: measure a complete UTC day. This is the first major go/no-go point.
- After Recommendations 4–6: measure another complete UTC day.
- Target: below 3.5 million reads/day. Stop optimization and monitor if stable.
- Caution: 3.5–4.5 million. Continue only with the remaining proven hot path.
- Unsafe: above 4.5 million. Design counters/cache or proceed to the approved support-alert redesign before relying on Free.
- Any functional regression, missing notification, incorrect entitlement, altered package rule, idle-session defect, authorization failure, or data mismatch stops the sequence immediately, regardless of D1 savings.

## Recommended first executable task

Start with Task 0.2, then Task 1.1. Task 1.1 is additive application code with no call-site effect, so it gives us the safest first proof that the test-and-release discipline works before changing production query behavior.
