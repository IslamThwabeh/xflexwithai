# D1 Free-Plan Pre-Downgrade Plan

Date: 2026-09-28
Status: Draft plan. No code, schema, data, deployment, or Cloudflare billing change has been made by this document.

## Purpose

Use the remaining paid-plan headroom to complete the D1 work that would be more constrained after returning to Cloudflare's Free plan. Each phase must be completed separately and then stop for owner approval before the next phase starts.

This plan is intentionally conservative. It treats index creation, archive backfills, production query-plan diagnostics, and broad verification reads as scarce operations once the account is back on Free.

## Current production baseline

Live `wrangler d1 info xflexwithai-db` on 2026-09-28 reported:

- Database: `xflexwithai-db` (`cf374361-2caa-4597-a38d-5cecced7827d`)
- Region: `WEUR`
- Tables: 139
- Database size: 287 MB
- Trailing 24-hour read queries: 60,830
- Trailing 24-hour write queries: 7,150
- Trailing 24-hour rows read: 2,176,135
- Trailing 24-hour rows written: 17,142

Free-plan thresholds and internal operating targets:

- Cloudflare D1 Free daily reads: 5,000,000 rows.
- Cloudflare D1 Free daily writes: 100,000 rows.
- Current internal downgrade target: under 3,500,000 rows read per complete UTC day.
- Current internal steady-state write target: under 60,000-70,000 rows written per complete UTC day.
- Preferred downgrade evidence: seven complete UTC days below target with no D1-limit errors, Worker CPU-limit errors, support/search/recommendation regressions, login issues, or email-maintenance regressions.
- Minimum downgrade evidence: three complete UTC days below target, used only if business urgency outweighs the lower confidence.

## Current top D1 risks

The latest one-day D1 Insights sample identified these read-heavy fingerprints:

1. Support inbox manual search with message-body matching: 1,126,024 rows read across 20 executions, averaging 56,301 rows read per run.
2. Normal support inbox listing: 227,750 rows read across 213 executions, averaging 1,069 rows read per run.
3. Email outbox status grouping by recent creation time: 213,716 rows read across 26 executions, averaging 8,219 rows read per run.
4. LexAI message history by user: 131,856 rows read across 78 executions, averaging 1,690 rows read per run.
5. Staff notification route badge grouping: 101,828 rows read across 111 executions, averaging 917 rows read per run.
6. Episode listing by course: 99,918 rows read across 1,281 executions, averaging 78 rows read per run.
7. Email delivery log provider/request lookup: 88,146 rows read across 56 executions, averaging 1,574 rows read per run.

The current totals are safe, but the support manual-search query is a spike risk: a small number of staff searches can consume a large share of the daily Free allowance.

## Non-negotiable operating rules

1. Complete only one phase at a time.
2. Stop after each phase and ask for owner approval before starting the next phase.
3. Do not combine index creation, historical backfill, retention/deletion, query rewrites, and billing-plan changes in one phase.
4. No destructive data change is authorized by this plan.
5. Additive indexes must be idempotent, non-unique unless separately approved, and deployed through a migration file or explicitly documented manual SQL.
6. Past migrations must not be edited.
7. Every production write phase must capture a fresh D1 Time Travel bookmark before the first write.
8. Every production write phase must check the current UTC-day or trailing write budget before writing.
9. Every optimized SQL path must have a production-shaped SQL contract test and an `EXPLAIN QUERY PLAN` assertion before deployment.
10. Protected application behavior takes priority over D1 savings: support, recommendations, email delivery, package/key access, course access, terms gates, financial records, and staff-session rules must remain correct.
11. Manual production queries must avoid selecting personal message content, email bodies, payment evidence, secrets, or unnecessary user-identifying values. Use aggregate counts, query plans, and schema/index catalogs whenever possible.
12. If a phase reveals an unexpected production shape, stop and write a short finding before implementation continues.

## Phase approval cadence

Each phase ends with a short handoff containing:

- What changed.
- Commit hash or deployment ID, if applicable.
- D1 Time Travel bookmark for any production write phase.
- Rows read/written by any production migration or backfill.
- Tests and builds run.
- Production smoke checks run.
- Current D1 usage after the phase.
- Residual risk and recommended next phase.

After the handoff, stop. The next phase starts only after explicit owner approval.

## Phase 0 - Freeze Baseline And Finalize Scope

Goal: establish the exact starting point and decide which phases are approved for execution before downgrade.

Scope:

1. Record the current git commit and dirty worktree state.
2. Re-run `wrangler d1 info xflexwithai-db`.
3. Capture one-day D1 Insights sorted by reads, writes, and execution count.
4. Capture seven-day D1 Insights sorted by reads if the CLI returns stable output.
5. Record the current D1 Time Travel bookmark.
6. Confirm whether any planned production work outside this D1 sequence is scheduled in the same UTC day.
7. Confirm owner appetite for: support search rewrite, additive indexes, notification archive/payload work, email monitoring indexes, LexAI history index, and Free-plan switch timing.

No code, schema, data, deployment, or billing change occurs in this phase.

Verification:

- Baseline document includes current totals, top fingerprints, database size, and any known concurrent-production-work risks.
- Worktree status is recorded so unrelated user changes are not accidentally included.

Stop gate:

- Stop and ask owner to approve Phase 1.

### Phase 0 execution record - 2026-09-28

Status: Complete. Read-only production baseline captured. No code, schema, data, deployment, or billing change was performed.

Capture time:

- Local time: `2026-09-28T11:57:16.7041287+03:00`
- UTC time: `2026-09-28T08:57:16.7050415Z`

Repository baseline:

- Base commit: `4b373559a4feb9407c0f6775061ab144fac7fa28`
- Worktree was already dirty before implementation work. Existing modified files:
  - `backend/_core/supportAiKnowledge.ts`
  - `backend/db.ts`
  - `backend/routers.ts`
  - `backend/services/live-package.service.ts`
  - `frontend/src/pages/PackageDetails.tsx`
  - `server/livePackageAvailability.test.ts`
  - `server/livePackageFoundation.test.ts`
  - `server/livePackagePhaseA.test.ts`
- Existing untracked files:
  - `database/migrations/121_live_course_access_and_jumaa_sale_correction.sql`
  - `database/migrations/122_jumaa_live_payment_confirmation.sql`
  - `docs/d1-free-plan-pre-downgrade-plan-2026-09-28.md`
- Git emitted warnings reading the user-level ignore file at `C:\Users\islamt/.config/git/ignore`; this did not block repository status capture.

Production D1 baseline:

- Database: `xflexwithai-db` (`cf374361-2caa-4597-a38d-5cecced7827d`)
- Tables: 139
- Region: `WEUR`
- Database size: 287 MB
- Trailing 24-hour read queries: 61,691
- Trailing 24-hour write queries: 7,202
- Trailing 24-hour rows read: 2,195,948
- Trailing 24-hour rows written: 17,272
- Read replication: disabled
- Current Time Travel bookmark: `000012d8-000005fa-000050f4-184258fcceb05f00d25cbe4937b8a779`

Free-plan status at Phase 0:

- Rows read are 43.9% of the 5,000,000 daily Free limit.
- Rows written are 17.3% of the 100,000 daily Free limit.
- Database size is 57.4% of the 500 MB per-database Free limit.
- Current rolling usage is below the internal 3.5M read and 60k-70k write targets.
- This is a rolling/trailing sample, not a complete UTC-day downgrade approval by itself.

One-day read-heavy fingerprints:

1. Support inbox manual search with message-body matching: 1,126,024 rows read, 20 runs, 56,301 average rows/run.
2. Normal support inbox listing: 236,182 rows read, 221 runs, 1,068 average rows/run.
3. Email outbox status grouping by creation time: 213,716 rows read, 26 runs, 8,219 average rows/run.
4. LexAI message history by user: 131,856 rows read, 78 runs, 1,690 average rows/run.
5. Staff notification route badge grouping: 101,828 rows read, 111 runs, 917 average rows/run.
6. Episode listing by course: 99,918 rows read, 1,281 runs, 78 average rows/run.
7. Email delivery log provider/request lookup: 88,146 rows read, 56 runs, 1,574 average rows/run.

One-day write-heavy fingerprints:

1. Episode progress update: 2,938 rows written, 1,469 runs.
2. `users.lastActiveAt` update: 2,782 rows written, 2,782 runs.
3. Batched email delivery log insert: 2,565 rows written, 45 runs.
4. Staff notification coalescing update: 1,530 rows written, 161 runs.
5. Support message insert: 1,488 rows written, 248 runs.
6. Single email delivery log insert: 889 rows written, 112 runs.
7. Email outbox insert/dedupe: 856 rows written, 271 runs.
8. Email delivery daily aggregate upsert: 675 rows written, 15 runs.
9. `users.lastInteractiveAt` update: 673 rows written, 720 runs.
10. Support conversation timestamp update: 609 rows written, 203 runs.

One-day most frequent fingerprints:

1. `admin_settings` lookup: 7,034 runs, 7,020 rows read.
2. User terms acceptance lookup: 4,195 runs, 11,983 rows read.
3. User lookup by id: 3,237 runs, 3,237 rows read.
4. `users.lastActiveAt` update: 2,782 runs, 2,782 rows written.
5. Email outbox stale lock cleanup: 2,753 runs.
6. Admin lookup by email: 2,593 runs.
7. Recommendation stale-delivery close/result reconciliation: 1,579 runs.
8. Episode progress lookup by user/episode: 1,561 runs.
9. Recommendation delivery queue selection: 1,530 runs.
10. Episode progress update: 1,469 runs.

Seven-day read-heavy fingerprints:

1. Email delivery logs event/template aggregate: 3,533,382 rows read, 18 runs, 196,299 average rows/run.
2. Email delivery logs status summary aggregate: 2,973,144 rows read, 24 runs, 123,881 average rows/run.
3. Engagement events admin/reporting aggregate: 2,111,298 rows read, 21 runs, 100,538 average rows/run.
4. Email delivery logs newest-first listing: 1,569,872 rows read, 8 runs, 196,234 average rows/run.
5. Email delivery logs recipient/name search: 1,537,842 rows read, 12 runs, 128,153 average rows/run.
6. Email outbox status grouping by creation time: 1,234,634 rows read, 154 runs, 8,017 average rows/run.
7. Normal support inbox listing: 1,188,141 rows read, 1,110 runs, 1,070 average rows/run.
8. Support inbox manual search with message-body matching: 1,126,024 rows read, 20 runs, 56,301 average rows/run.
9. Email delivery log malformed-date diagnostic query: 1,003,478 rows read, 14 runs, 71,677 average rows/run.
10. Staff notification route badge grouping: 999,248 rows read, 1,109 runs, 901 average rows/run.

Interpretation:

- The immediate spike risk remains support inbox manual search because only 20 runs consumed over 1.1M rows in the one-day sample.
- The seven-day history says email delivery dashboard/reporting queries are the largest sustained heavy-read family and should remain a dedicated later phase.
- Current total D1 usage is safe for Free in a rolling snapshot, but the plan should continue because paid-plan headroom is useful for index creation, archive verification, and production diagnostics.
- D1 Insights is experimental and rolling. It is useful for prioritization but does not replace complete UTC-day observation before the billing downgrade.

Phase 0 residual questions for owner:

1. Is any other production migration, import, cleanup, deployment, or large admin/reporting task planned for the same UTC day as Phase 1?
2. Is Phase 1 approved to change support search behavior if the implementation keeps normal support inbox freshness intact but makes message-body search more deliberate/bounded?
3. Should Phase 3 email dashboard/reporting optimization remain mandatory before downgrade, given the seven-day evidence?

Phase 0 recommendation:

- Proceed to Phase 1: Support Search Spike Containment.
- Keep Phase 3 in the recommended path because email delivery log reporting is the largest seven-day heavy-read family.
- Do not downgrade billing yet. Complete at least Phase 1, Phase 5, and a complete UTC-day observation window first.

## Phase 1 - Support Search Spike Containment

Goal: remove or bound the largest current read spike before returning to Free.

Why first:

The support search fingerprint read 1,126,024 rows from only 20 runs. That is the highest immediate Free-plan risk because one staff workflow can spike usage even when the daily total looks healthy.

Investigation tasks:

1. Locate the support inbox/list/search query builder.
2. Identify every UI entry point that can trigger support conversation search.
3. Inspect whether support search currently allows broad message-content matching such as `%term%`.
4. Check current indexes on `supportConversations`, `supportMessages`, and `users`.
5. Build production-shaped fixtures for:
   - no search,
   - user-name search,
   - user-email search,
   - phone or client identifier search if supported,
   - message-content search,
   - empty/short search terms,
   - conversations with no visible messages,
   - many messages in one conversation.

Preferred implementation direction:

1. Keep user/name/email search cheap and bounded.
2. Make message-body search deliberate and bounded:
   - minimum term length,
   - recent-message date window,
   - strict result limit,
   - no background polling while search is active,
   - no focus refetch for manual search results,
   - optional explicit "search messages" mode if needed.
3. Avoid unbounded `lower(content) LIKE '%term%'` across all historical support messages.
4. Prefer indexable predicates and bounded subqueries.
5. Keep normal support inbox freshness intact for active support work.

Potential schema work:

- Add an index only if current `EXPLAIN QUERY PLAN` proves the query still scans a hot table and a specific additive index fixes it.
- Possible candidate areas include conversation updated ordering, message conversation/date ordering, or normalized user lookup fields. Do not add speculative indexes.

Tests:

- Query contract test for exact SQL and bound parameters.
- Query-plan test rejects full scans for the common user/name/email search path.
- UI/source test proving manual search is debounced or explicit, has a minimum length, and does not refetch in background or on focus.
- Support inbox tests proving unread counts, latest message, status filters, assignment filters, and escalation indicators still match expected results.

Production verification:

- Deploy Worker and Pages only if needed.
- Smoke support inbox, support search, direct conversation route, unread count, and support message send/reply behavior.
- Compare D1 Insights after a short soak for the support-search fingerprint.
- Do not require a complete UTC-day pass before stopping, but record that complete-day observation remains required before billing downgrade.

Rollback:

- Revert the application commit.
- Leave additive indexes in place unless they cause a verified regression. Index removal requires a separate approved rollback step.

Stop gate:

- Stop after Phase 1 handoff and ask owner to approve Phase 2.

### Phase 1 local implementation record - 2026-09-28

Status: Local implementation and verification complete. No production deploy, no production write, no migration, no Time Travel mutation, and no billing change was performed.

Owner safety context:

- Owner confirmed they are the only developer and are using Codex only in this session.
- Phase 1 was intentionally kept local because the site is running in production.
- Production deployment remains a separate approval step.

Implemented behavior:

1. Normal support inbox search now searches client identity fields only:
   - client name,
   - client email.
2. Message-body search is still available, but it is now explicit:
   - admin/support staff choose `Messages` in the inbox search mode selector,
   - the frontend sends the backend `msg:<term>`,
   - the backend also accepts `message:<term>` for explicit message search.
3. Message-body search requires at least four trimmed characters.
4. Client identity search requires at least two trimmed characters.
5. Too-short manual search terms return no search match instead of silently falling back to the full inbox.
6. Manual search input escapes SQL `LIKE` wildcards (`%`, `_`, and `\`) so user input cannot become an accidental broad wildcard.
7. Message-body search is bounded to recent messages through `SUPPORT_INBOX_MESSAGE_SEARCH_DAYS = 30`, replacing the prior 90-day implicit scan.
8. Admin support manual search no longer refetches on window focus while search is active.
9. Admin support manual search no longer refetches the conversation list on hidden-to-visible return while search is active.
10. Normal inbox polling remains visible-only and unchanged for non-search mode.

Files intentionally changed for Phase 1:

- `backend/db.ts`
- `frontend/src/pages/AdminSupport.tsx`
- `server/supportInboxSearchSafeguards.test.ts`
- `docs/d1-free-plan-pre-downgrade-plan-2026-09-28.md`

Important worktree note:

- `backend/db.ts` already contained unrelated live-package changes before this phase. Those were left intact.
- The repository still contains other unrelated modified and untracked files from prior work. They were not reverted or intentionally included in Phase 1.

Verification completed:

- Focused support/D1 tests passed:
  - `server/supportInboxSearchSafeguards.test.ts`
  - `server/supportPerformanceRoutes.test.ts`
  - `server/d1RemainingHotPaths.test.ts`
  - `server/adminSupportNavigation.test.ts`
  - `server/adminSupportCopy.test.ts`
- Re-run focused support/D1 subset passed after final UI patch:
  - `server/supportInboxSearchSafeguards.test.ts`
  - `server/supportPerformanceRoutes.test.ts`
  - `server/d1RemainingHotPaths.test.ts`
- TypeScript check passed: `pnpm run check`.
- Worker production build passed: `pnpm run build:worker`.
- Full production app/server build passed: `pnpm run build`.
- Diff whitespace check passed: `git diff --check`.

Sandbox note:

- The first Vitest/build attempts were blocked by local sandbox access to project config or esbuild path resolution. The same commands passed after approved local filesystem access.

Expected D1 impact after deployment:

- Ordinary support inbox searches should no longer execute the expensive message-body `supportMessages` search branch.
- The one-day spike fingerprint that read 1,126,024 rows from 20 runs should either disappear or become limited to explicit message searches.
- Explicit message searches can still be expensive, but they are now deliberate, shorter-window, longer-minimum operations.

Residual risk:

- This has not been deployed to production yet.
- D1 savings must be verified with post-deploy D1 Insights and at least one complete UTC-day observation.
- If support staff frequently use explicit `Messages` search, further work may still be needed, such as a dedicated support-message search index/design or full-text search.

Phase 1 recommendation:

- Review the local behavior change.
- If approved, perform a separate production deployment/smoke step for this Phase 1 change only.
- After deployment, observe the support search fingerprint before moving to Phase 2.

## Phase 2 - Complete Safe Notification Archive And Active-Set Work

Goal: finish any remaining reversible notification archive work or active-set reduction that is already approved, while paid-plan write headroom makes it safer.

Why now:

Historical notification archive/index work can involve many writes and verification reads. It is much easier to do before Free-plan enforcement becomes the daily operating constraint.

Preflight:

1. Review `docs/staff-notification-lifecycle-plan-2026-09-15.md`.
2. Confirm whether Phase 5E is fully complete in production.
3. Query only aggregate counts:
   - total staff notifications,
   - active count,
   - archived count,
   - active unread count,
   - archive-eligible candidate count by approved event type,
   - invalid archived rows by allowlist/cutoff/batch rules.
4. Confirm all archive indexes from migrations 115-118 exist.
5. Confirm current UTC-day write usage and reserve at least 40,000 writes for organic traffic unless owner approves a different cap.

Allowed work:

1. Complete remaining approved reversible archive batches, if any candidates remain.
2. Reconcile active + archived = total.
3. Verify original unread states are preserved.
4. Verify support conversations and support messages are unchanged.
5. Verify active badge/list queries exclude archived rows and use the intended active indexes.

Explicitly out of scope unless separately approved:

- Deleting notifications.
- Marking old notifications read.
- VACUUM.
- Retention-policy enforcement.
- Archiving non-support event types.
- Changing support conversation/message records.
- Combining payload normalization with archive backfill.

Tests:

- Migration/archive/badge focused suite.
- Support notification creation/coalescing tests.
- Badge route/read invalidation tests.
- Rollback helper tests keyed by `archiveBatchKey`.

Production verification:

- Capture Time Travel bookmark before any write.
- Archive in bounded batches.
- After every batch, verify updated count, remaining candidate count, active count, archive count, and D1 write usage.
- Stop before the agreed write reserve is crossed.
- Smoke Worker health, database health, support inbox, staff notification list, badge counts, and archive history.

Rollback:

- If archive selection is wrong, use the batch-key rollback helper after owner approval.
- Do not delete or manually rewrite rows as an ad hoc rollback.

Stop gate:

- Stop after Phase 2 handoff and ask owner to approve Phase 3.

### Phase 2 local completion record - 2026-09-28

Status: Complete as a no-op/local verification phase. No code change was required for Phase 2, and no production write, migration, archive backfill, delete, mark-read, VACUUM, deployment, or billing change was performed.

Scope outcome:

- Prior staff-notification archive/index/backfill work is already present and complete for the approved support-notification policy.
- The current implementation already contains:
  - active notification list queries excluding archived rows,
  - active badge queries excluding archived rows,
  - bounded archive history endpoint and UI,
  - archive-candidate query restricted to approved support event types,
  - batch-key rollback helper,
  - future support notification coalescing/reopen behavior.

Read-only production verification:

- Production aggregate check returned:
  - total staff notifications: 26,269
  - active: 5,935
  - archived: 20,334
  - active unread: 5,205
  - `notif-archive-20260919-phase5e` batch rows: 20,334
  - remaining approved archive candidates before `2026-08-20T00:00:00.000Z`: 0
  - invalid archived rows by allowlist/cutoff/reason/batch rules: 0
- Production index catalog contains all required indexes:
  - `idx_staff_notif_active_badges`
  - `idx_staff_notif_archive_candidates`
  - `idx_staff_notif_archive_batch`
  - `idx_staff_notif_archive_history`
- Production `EXPLAIN QUERY PLAN` uses:
  - `idx_staff_notif_archive_candidates` for bounded candidate selection,
  - `idx_staff_notif_archive_batch` for bounded rollback selection,
  - `idx_staff_notif_archive_history` for paginated archive history.
- Wrangler reported `changed_db: false` and `rows_written: 0` for every Phase 2 production check.
- The aggregate count queries read approximately 52,542 rows total. This was an intentional read-only safety check while still on paid-plan headroom.

Focused local verification:

- `server/staffNotificationArchiveQuery.test.ts`
- `server/staffNotificationArchiveMigrations.test.ts`
- `server/staffNotificationArchiveDashboard.test.ts`
- `server/staffNotificationBadgeQuery.test.ts`
- `server/staffNotificationBadgeRoutes.test.ts`
- `server/staffNotificationBadgeDashboard.test.ts`
- `server/staffNotificationCoalescing.test.ts`

Result: 21 tests passed across 7 files.

Decision:

- Do not perform any additional Phase 2 archive backfill or data mutation.
- Do not delete notifications, mark historical rows read, or run VACUUM.
- Keep retention/deletion/payload compaction deferred unless a later database-size or legal/operational decision explicitly approves it.

Phase 2 recommendation:

- Proceed locally to Phase 3: Email Monitoring And Delivery Log Index Work.
- Because seven-day D1 Insights showed email delivery log reporting as the largest sustained heavy-read family, Phase 3 should investigate and optimize query/index shape locally before the single combined push/deploy.

## Phase 3 - Email Monitoring And Delivery Log Index Work

Goal: reduce operational email query reads while preserving email delivery, auditability, and maintenance jobs.

Why:

Email-related reads are not the largest current risk, but they are operationally important. During incidents, email monitoring can run more often. Index work is safer before downgrading.

Target fingerprints:

1. `email_outbox` status grouping by `createdAt`: about 213,716 rows read/day in the latest sample.
2. Full email-outbox health aggregation: about 49,122 rows read/day from only 6 runs.
3. `email_delivery_logs` provider/request/reference/recipient lookup: about 88,146 rows read/day and high average duration.

Investigation tasks:

1. Locate email health, email logs, webhook/provider reconciliation, and admin email monitoring queries.
2. Inspect current indexes on `email_outbox`, `email_delivery_logs`, and daily aggregate tables.
3. Confirm which queries are diagnostic-only, webhook-critical, scheduled-maintenance-critical, or UI-only.
4. Use `EXPLAIN QUERY PLAN` for exact production-shaped SQL.

Preferred implementation direction:

1. Add a narrow index for recent `email_outbox` status/date grouping only if current plans scan too broadly.
2. Add a narrow lookup index for provider request/reference/recipient matching only if it materially reduces scans.
3. Keep the existing anomaly-precheck strategy for full outbox health.
4. Do not remove audit rows.
5. Do not weaken provider webhook idempotency or delivery evidence.

Tests:

- Email outbox health query contract.
- Email provider delivery lifecycle tests.
- Email webhook/reconciliation tests.
- Admin email log tests.
- Query-plan tests proving the target indexes are used.

Production verification:

- Capture Time Travel bookmark before any index migration.
- Apply at most one index migration in this phase unless owner explicitly approves a second one after seeing the write budget.
- Verify ledger row and index catalog.
- Verify `EXPLAIN QUERY PLAN` for the exact target queries.
- Smoke scheduled email health, admin email logs, support reply email lane, recommendation delivery lane, and email provider webhook route if available.

Rollback:

- Prefer leaving additive indexes in place.
- If an index demonstrably regresses writes or storage, perform an index-only rollback as a separate approved action.

Stop gate:

- Stop after Phase 3 handoff and ask owner to approve Phase 4.

### Phase 3 local implementation record - 2026-09-28

Execution mode:

- Completed locally only.
- No production deploy, migration application, or write operation was performed.
- Read-only production checks were used only to validate current state before local changes.

Read-only production safety checks:

- Confirmed migration `123_email_provider_delivery_lifecycle.sql` is recorded in production.
- Confirmed `email_delivery_logs` has `0` rows where `created_at = 'CURRENT_TIMESTAMP'`.
- Confirmed the timestamp repair check returned `changed_db: false`, `rows_written: 0`, and `rows_read: 1`.
- Confirmed current production index catalog contains only the pre-existing single-column delivery-log indexes plus provider correlation indexes and existing outbox indexes.

Local implementation:

1. Added `database/migrations/124_email_monitoring_hot_path_indexes.sql`.
2. Added four additive, idempotent, non-unique indexes:
   - `idx_email_delivery_logs_created_id` on `email_delivery_logs(created_at DESC, id DESC)`.
   - `idx_email_delivery_logs_status_created_id` on `email_delivery_logs(status, created_at DESC, id DESC)`.
   - `idx_email_delivery_logs_event_created_id` on `email_delivery_logs(event_type, created_at DESC, id DESC)`.
   - `idx_email_outbox_created_status` on `email_outbox(createdAt, status)`.
3. Updated `database/schema-sqlite.ts` with the new index declarations.
4. Removed the legacy timestamp-validity `CASE` expression from the delivery-log list ordering after production verified the legacy timestamp repair is complete.
5. Kept email delivery, webhook correlation, audit retention, summary math, and admin filters unchanged.

Local safeguards added:

- Added `server/emailMonitoringHotPathIndexes.test.ts`.
- The test verifies the new migration is additive, idempotent, and non-unique.
- The test verifies the Drizzle schema models the new index names.
- The test verifies the delivery-log list no longer uses the obsolete timestamp `CASE` ordering.
- The test verifies production-shaped SQLite query plans use the new delivery-log and outbox indexes for the measured list, summary, status, event, and outbox-status paths.

Local verification:

- Passed:
  - `pnpm exec vitest run server/emailMonitoringHotPathIndexes.test.ts server/adminEmailLogsPolling.test.ts server/emailOutboxHealthQuery.test.ts server/emailBulkDeliveryControl.test.ts server/d1RemainingHotPaths.test.ts`
- Result:
  - 5 test files passed.
  - 22 tests passed.

Phase 3 handoff:

- Phase 3 is locally complete.
- The production migration is intentionally not applied yet.
- Proceed locally to Phase 4 as part of the owner-approved combined local completion path before one final push/deploy.

## Phase 4 - LexAI History And Course/Episode Hot Paths

Goal: clean up medium-sized recurring read paths that are likely to grow with usage.

Target fingerprints:

1. LexAI message history by user: about 131,856 rows read/day, 1,690 average rows per run.
2. Episode listing by course: about 99,918 rows read/day, 78 average rows per run.

Investigation tasks:

1. Check whether production already has an effective `lexaiMessages(userId, createdAt DESC)` index.
2. Check whether production already has an effective `episodes(courseId, order)` index.
3. Confirm current application queries select only required columns and have reasonable limits.
4. Confirm whether frontend caching for static course metadata is already sufficient.

Preferred implementation direction:

1. For LexAI history, add or adjust only the minimum index needed for `userId` plus newest-first pagination.
2. For episode listing, rely on existing index if present; add no duplicate index.
3. Add static course metadata caching only for published content that can be safely invalidated.
4. Do not cache access, enrollment, progress, quiz state, subscription status, or timed-service state as static data.

Tests:

- LexAI eligibility/access tests.
- LexAI conversation/history query contract.
- Course watch/access/progression tests.
- Episode ordering tests.
- Static course metadata cache invalidation tests if frontend caching changes.

Production verification:

- Capture Time Travel bookmark before any index write.
- Apply only needed indexes.
- Verify production query plans.
- Smoke LexAI page history, course list/details, episode watch page, quiz/progress behavior, and package access.

Rollback:

- Revert runtime caching/query changes if behavior regresses.
- Leave additive indexes unless a regression is verified and owner approves index removal.

Stop gate:

- Stop after Phase 4 handoff and ask owner to approve Phase 5.

### Phase 4 local implementation record - 2026-09-28

Execution mode:

- Completed locally only.
- No production deploy, migration application, or write operation was performed.
- Read-only production index catalog check was used to avoid duplicate indexes.

Read-only production safety checks:

- Checked `sqlite_master` for indexes on production tables `lexaiMessages` and `episodes`.
- Production returned no existing indexes for those tables.
- The catalog check returned `changed_db: false` and `rows_written: 0`.

Local implementation:

1. Added `database/migrations/125_lexai_course_hot_path_indexes.sql`.
2. Added two additive, idempotent, non-unique indexes:
   - `idx_lexai_messages_user_created_id` on `lexaiMessages(userId, createdAt DESC, id DESC)`.
   - `idx_episodes_course_order_id` on `episodes(courseId, "order", id)`.
3. Updated `database/schema-sqlite.ts` with both index declarations.
4. Updated `getUserLexaiMessages` to keep newest-first ordering and add `id DESC` as a deterministic tie-breaker.
5. Updated `getEpisodesByCourseId` to keep lesson-order sorting and add `id` as a deterministic tie-breaker.
6. Confirmed existing frontend course metadata caching is already scoped to stable course/episode definitions and does not cache enrollment or progress truth.

Local safeguards added:

- Added `server/lexaiCourseHotPathIndexes.test.ts`.
- The test verifies the new migration is additive, idempotent, and non-unique.
- The test verifies the Drizzle schema models the new index names.
- The test verifies runtime query ordering remains aligned with the new indexes.
- The test verifies production-shaped SQLite query plans use the new LexAI history and episode listing indexes without temp sort trees.

Local verification:

- Passed:
  - `pnpm exec vitest run server/lexaiCourseHotPathIndexes.test.ts server/courseMetadataCaching.test.ts server/lexaiAccess.test.ts server/markEpisodeComplete.test.ts`
- Result:
  - 4 test files passed.
  - 22 tests passed.

Phase 4 handoff:

- Phase 4 is locally complete.
- The production migration is intentionally not applied yet.
- Proceed locally to Phase 5 as part of the owner-approved combined local completion path before one final push/deploy.

## Phase 5 - Free-Plan Guardrail Script And Runbook

Goal: make post-downgrade monitoring fast, repeatable, and less error-prone.

Deliverable:

A local script and short runbook that reports:

- Current D1 `info` metrics.
- Rows read/write usage as percentages of Free limits.
- Database size as percentage of the 500 MB database limit.
- Top 10 read fingerprints.
- Top 10 write fingerprints.
- Optional top execution-count fingerprints.
- Pass/caution/unsafe status.
- Exact timestamp and whether the result is trailing/rolling rather than complete UTC-day.

Preferred implementation:

1. Add a script under `scripts/` that wraps Wrangler commands and prints a concise Markdown summary.
2. Do not include or print secrets.
3. Use existing Wrangler authentication.
4. Make output copyable into the D1 handoff docs.
5. Fail clearly if Cloudflare credentials are missing.

Status bands:

- Pass: under 3.5M reads and under 60k writes.
- Caution: 3.5M-4.5M reads or 60k-80k writes.
- Unsafe: above 4.5M reads or above 80k writes.
- Block Free downgrade: at or above 5M reads, at or above 100k writes, D1-limit errors, Worker CPU-limit errors, or functional regressions.

Tests:

- Script parsing test using captured fixture output if practical.
- Manual dry run against production.

Production verification:

- Run the script once.
- Confirm numbers match a direct `wrangler d1 info` check.
- Confirm Insights output is labeled experimental and rolling.

Rollback:

- Remove the script or leave it unused. No production change occurs.

Stop gate:

- Stop after Phase 5 handoff and ask owner to approve Phase 6.

### Phase 5 local implementation record - 2026-09-28

Execution mode:

- Completed locally.
- No production deploy, migration application, billing change, or write operation was performed.
- A read-only production dry run was performed using Wrangler `d1 info` and `d1 insights`.

Local implementation:

1. Added `scripts/d1-free-plan-guardrail.mjs`.
2. Added package command:
   - `pnpm run d1:guardrail -- xflexwithai-db --time-period 1d`
3. Added `docs/d1-free-plan-guardrail-runbook.md`.
4. Added `server/d1FreePlanGuardrailScript.test.ts`.

Script behavior:

- Runs read-only `wrangler d1 info <db> --json`.
- Runs read-only `wrangler d1 insights <db> --json` sorted by total reads, total writes, and execution count unless `--skip-insights` is passed.
- Prints copyable Markdown.
- Labels `d1 info` as trailing 24 hours.
- Labels `d1 insights` as rolling and experimental.
- Reports rows read, rows written, and database size as percentages of the Free-plan limits.
- Returns non-zero only for `UNSAFE` status.
- Does not print secrets.

Dry-run result:

- Full read-only guardrail dry run passed.
- Latest light dry run with `--skip-insights` reported:
  - Overall status: `PASS`.
  - Rows read: `2,304,932` / `5,000,000` (`46.1%`).
  - Rows written: `18,003` / `100,000` (`18.0%`).
  - Database size: `286,564,352` / `524,288,000` (`54.7%`).

Local verification:

- Passed:
  - `pnpm exec vitest run server/d1FreePlanGuardrailScript.test.ts`
- Result:
  - 1 test file passed.
  - 3 tests passed.

Phase 5 handoff:

- Phase 5 is locally complete.
- The guardrail is ready for post-deploy observation and downgrade decision support.
- Proceed to Phase 6 after the combined push/deploy, because Phase 6 requires a production-affecting release to be complete before the observation clock starts.

## Phase 6 - Complete UTC-Day Observation Window

Goal: collect enough evidence to decide whether to switch back to Free.

Scope:

1. No production writes, migrations, backfills, deployments, or billing changes during the observation window unless an urgent fix is needed.
2. Measure complete UTC days, not only rolling samples.
3. Record D1 usage, top fingerprints, Worker health, Worker CPU-limit evidence, and functional smoke checks.

Preferred observation window:

- Seven complete UTC days after the last production-affecting phase.

Minimum observation window:

- Three complete UTC days after the last production-affecting phase.

Daily checks:

1. D1 rows read and rows written.
2. Database size.
3. Top read and write fingerprints.
4. Worker errors and CPU-limit errors.
5. Email queue health.
6. Support inbox/search smoke.
7. Recommendation feed/summary smoke.
8. Login/session smoke.
9. Public site and API health.

Pass criteria:

- Every observed complete UTC day is below 3.5M rows read.
- Every observed complete UTC day is below 60k-70k rows written.
- No D1-limit errors.
- No Worker CPU-limit errors.
- No missing support/recommendation/email behavior.
- No new runaway fingerprint appears.
- Database size remains comfortably under 500 MB.

Caution criteria:

- Any complete UTC day reaches 3.5M-4.5M reads.
- Any complete UTC day reaches 70k-80k writes.
- A single query family grows quickly but total usage remains below limits.

Unsafe criteria:

- Any complete UTC day exceeds 4.5M reads.
- Any complete UTC day exceeds 80k writes.
- Any D1 or CPU limit appears.
- Support search, email, recommendation, login, or access behavior regresses.

Stop gate:

- Stop after the observation report and ask owner to approve or reject the Free-plan downgrade.

## Phase 7 - Billing Downgrade Decision And Execution

Goal: switch back to Free only after the evidence supports it.

Pre-downgrade checklist:

1. Observation window passed.
2. No pending index creation.
3. No pending archive backfill.
4. No pending production data repair.
5. No planned large import/export.
6. No active incident requiring high diagnostic read volume.
7. Owner accepts the reduced operational headroom.
8. A post-downgrade monitoring owner and check schedule are named.

Execution:

1. Record final `wrangler d1 info`.
2. Record latest top D1 Insights fingerprints.
3. Switch the Cloudflare plan through the Cloudflare dashboard.
4. Record the exact timestamp and plan state.
5. Run public site, Worker health, database health, login, support, recommendation, and email smoke checks.

Post-downgrade monitoring:

- Check usage after 2 hours.
- Check usage after 6 hours.
- Check at the next UTC-day boundary.
- Check daily for seven days.
- If reads exceed 4.5M or writes exceed 80k in a rolling/trailing sample, pause non-urgent production writes and investigate before the next reset.

Rollback:

- If Free limits are hit or business-critical work is blocked, return to the paid plan and record the trigger.

Stop gate:

- Stop after the billing-change handoff. Future D1 optimization becomes normal maintenance, not part of this pre-downgrade sequence.

## Deferred Work

These are useful but should not block the downgrade unless the observation window fails:

1. Materialized support inbox counters.
2. Full-text search design for support messages.
3. Physical deletion/retention policy for old notifications.
4. VACUUM or database-size compaction.
5. Materialized email dashboard aggregates beyond existing daily aggregates.
6. Cross-isolate cache for stable operational counts.
7. Further throttling of `lastActiveAt` if writes become a constraint again.

## Recommended execution order

1. Phase 0: Freeze baseline and scope.
2. Phase 1: Support search spike containment.
3. Phase 2: Notification archive/active-set completion.
4. Phase 3: Email monitoring and delivery-log indexes.
5. Phase 4: LexAI history and course/episode hot paths.
6. Phase 5: Guardrail script and runbook.
7. Phase 6: Complete UTC-day observation window.
8. Phase 7: Billing downgrade decision and execution.

The minimum practical pre-downgrade package is Phases 0, 1, 2 if any archive work remains, 5, and 6. Phases 3 and 4 are recommended while paid-plan headroom exists, but they can be skipped if Phase 1 removes the spike risk and observation remains comfortably below target.
