# Staff notification lifecycle plan — 2026-09-15

## Decision and objective

Treat staff notifications as an operational inbox without treating them as the
system of record. Reduce D1 badge reads and stop routine support alerts from
growing without bound, while preserving support conversations, audit evidence,
and the original read state of every notification.

This plan supersedes the earlier prohibition on notification archiving only for
the narrowly defined, reversible workflow below. It does not authorize deletion,
blanket read-state changes, or retention changes for any other table.

## Production evidence captured for Phase 1

Read-only production aggregates on 2026-09-15 established:

- `staff_notifications`: 25,851 rows and approximately 19.5 MB of logical
  payload; 23,458 rows are unread.
- 20,376 rows are older than 30 days, including 18,202 unread rows; these older
  rows contain approximately 15.3 MB of logical payload.
- `new_support_message` and `human_escalation` account for 24,503 rows (94.8%).
- No existing staff notification has a nonblank `dedupe_key`.
- The grouped badge query consumed 858,958 rows in the rolling 24-hour Insights
  window: 377 executions averaging 2,278 rows read.
- `recommendation_deliveries`, at approximately 159.3 MB of logical payload, is
  materially larger than `staff_notifications`. Its retention is explicitly out
  of scope because it contains delivery evidence with different obligations.

Logical payload excludes index overhead, SQLite page allocation, and free pages;
it is suitable for relative sizing but is not an exact physical table size.

## Product policy

1. The active staff inbox shows unarchived notifications only.
2. Routine support notifications become archive-eligible after 30 complete days.
3. Initial archive eligibility is restricted to `new_support_message` and
   `human_escalation`.
4. Archiving preserves the row and its original `isRead` value. It never changes
   or deletes the corresponding support conversation or message.
5. Financial, order, payment, key-blocking, moderation-failure, email-delivery,
   recommendation-delivery, activation-failure, security, and audit events are
   not automatically archived by this project.
6. Future support notifications are coalesced per conversation and staff user so
   badges represent actionable conversations rather than accumulated messages.
7. Physical deletion is not part of this plan. It requires a later, separately
   approved retention policy, verified backup, restore rehearsal, and legal or
   operational review.

## Non-negotiable safeguards

- One implementation phase at a time, with a clean worktree and isolated commit.
- No production write occurs in Phases 1–4.
- Every archive mutation has an `archiveBatchKey`; rollback targets only that
  batch and restores `archivedAt`, `archiveReason`, and `archiveBatchKey` to null.
- Archive selection requires all predicates: allowlisted event type, unarchived
  row, and `createdAt` strictly older than the UTC cutoff.
- The archive job is idempotent, bounded, and reports selected/updated counts.
- Existing `isRead`, notification content, metadata, and timestamps are not
  rewritten during archiving.
- The underlying support tables remain untouched.
- Migration deployment and historical archive backfill occur on different UTC
  days to preserve D1 write headroom.
- Before each production-write step: current UTC-day writes + estimated writes
  + a 40,000-row reserve must remain below 100,000. Otherwise defer.
- Capture the current D1 Time Travel bookmark before every production migration
  or backfill.
- Any count mismatch, unexpected query plan, elevated error rate, or support
  workflow regression stops the release.

## Phase 1 — Detailed plan and evidence (current phase)

Deliverables:

1. Record the product policy, measured baseline, exclusions, rollback design,
   write-budget gate, and success criteria in this document.
2. Review all staff-notification readers and mutations, including list, badge,
   mark-read, mark-by-route, mark-all, creation, and event dispatch.
3. Confirm that support conversations/messages are the durable source records;
   staff notifications are navigation and attention records.
4. Freeze the initial archive allowlist to the two support event types above.
5. Define the phase boundary: no schema, code, or production changes in Phase 1.

Exit gate: owner accepts this plan. Any request to include another event type,
delete rows, or change the 30-day window returns to Phase 1 for re-evaluation.

## Phase 2 — Archive model and active-query work

Scope:

1. Add nullable `archivedAt`, `archiveReason`, and `archiveBatchKey` columns to
   `staff_notifications` in schema definitions and an additive migration.
2. Add separately deployable indexes for active badge access, archive-candidate
   selection, and batch-key rollback, validated by production-shaped `EXPLAIN
   QUERY PLAN`. Separating the migrations permits one index build per UTC day.
3. Make the normal notification list and combined badge query exclude archived
   rows. Existing read/unread behavior inside the active set remains exact.
4. Add a bounded archive-candidate query and mutation helper accepting cutoff,
   allowlisted types, batch key, and batch size. Do not schedule or run it yet.
5. Add a bounded rollback helper keyed only by `archiveBatchKey`.
6. Do not add caching in this phase; first measure the benefit of reducing the
   active index range so the effects remain attributable.

Exit gate: source review and focused tests show no caller can accidentally see
archived rows in active badge totals, and no archive helper can affect a
non-allowlisted event.

## Phase 3 — Historical access and future coalescing

Scope:

1. Add a paginated, newest-first archive endpoint restricted to authorized staff.
   It returns archived rows separately and never mixes them into active badges.
2. Add a small Archive section to the staff notification page so authorized staff
   retain self-service access to preserved history.
3. Introduce a support-specific coalescing key derived from conversation ID.
   Generic notification deduplication must retain its existing insert-once
   behavior.
4. On a new support message for an existing conversation notification, update
   that notification's presentation fields, set `isRead=false`, clear archive
   fields, and advance its activity timestamp. Do not create another row.
5. Preserve human-escalation severity. The implementation must either upgrade the
   coalesced conversation notification or use a separately documented escalation
   key; tests decide the safer behavior before release.
6. Keep email throttling and email-outbox semantics unchanged.

Exit gate: repeated messages in one conversation create one active notification
per target staff user, reopen it after a new message, and do not suppress a
required escalation or email.

## Phase 4 — Verification and testing

Required automated coverage:

- Migration applies once and remains idempotent.
- Legacy null archive columns behave as active rows.
- Active list and badge results match the pre-change results when no rows are
  archived.
- Archive candidates respect the exact UTC boundary and allowlist.
- Archive preserves `isRead`, content, metadata, and source identifiers.
- Rollback restores only the selected batch.
- Mark-read, mark-by-route, and mark-all never mutate archived history unless an
  explicit archive action requests it.
- Coalescing is isolated by staff user and conversation and is race-safe under
  the unique constraint.
- New activity reopens an archived conversation notification safely.
- Support, staff badge, notification routing, email throttling, and authorization
  regression suites pass.
- `EXPLAIN QUERY PLAN` searches the intended active index and does not perform a
  full `staff_notifications` scan for badge counts.
- TypeScript check, Worker build, and Pages build (only if UI changes) pass.

Required fixture reconciliation:

1. Capture old and new badge/list results over a production-shaped fixture.
2. Archive only eligible rows.
3. Reconcile active + archived totals to the original total exactly.
4. Roll back the batch and prove the original state is restored exactly.

Phase 4 blocks Phase 5 on any unexplained difference.

### Phase 4 verification result — 2026-09-15

- PASS: 48 focused tests across nine notification, support, archive, badge, and
  D1 hot-path suites.
- PASS: 192 tests across the full critical-cycle suite.
- PASS: TypeScript check, Worker production build, and full Pages/application
  production build.
- Migration fixtures preserve every legacy row and value, add the four expected
  indexes, and contain no destructive notification-table SQL.
- Archive fixtures reconcile original total = active + archived exactly; rollback
  restores only its selected batch while preserving notification content,
  metadata, source identifiers, and read state.
- No production migration, backfill, deletion, or deployment occurred in Phase 4.

## Phase 5 — Deployment, migration, and controlled backfill

### Phase 5A — Archive fields, active index, and application release

1. Re-measure UTC-day D1 reads/writes and confirm the write-budget gate.
2. Verify Cloudflare identity, production database, branch, and clean commit.
3. Capture a Time Travel bookmark and pre-migration aggregate counts.
4. Apply migration 115 first; old code safely ignores nullable columns.
5. Verify columns, indexes, migration ledger, and production query plans.
6. Deploy the Worker. Deploy Pages only if Phase 3 added archive UI.
7. Smoke-test health, database connectivity, authenticated badge/list behavior,
   mark-read actions, support-message notification creation, and email behavior.
8. Stop for the remainder of the UTC day. Do not deploy the candidate index or
   backfill historical rows.

#### Phase 5A deployment result — 2026-09-15

- PASS: authenticated Cloudflare account `79e9ff531db92d17c6579430b86a5f3c`
  and production D1 database `cf374361-2caa-4597-a38d-5cecced7827d` matched the
  runbook.
- Safety gate before migration: 3,494,789 rows read and 29,987 rows written in
  the trailing 24 hours. Pre-migration notification count: 25,875.
- Recovery bookmark before migration:
  `00001259-0000062e-000050e7-4a749f0c90867428f6d58cb9acbb9945`.
- Applied only `115_staff_notification_archiving.sql` (SHA-256
  `6FB2961C6DDDD23C99CC134CABB15EA1CD2BA294E33ECD13D9BC4BAD957F304B`).
  Migration bookmark:
  `00001259-00000677-000050e7-6bfdcc93f7c35d9f90db09bbb82b2302`.
- PASS: the ledger row exists exactly once; all 25,899 notifications observed at
  final reconciliation remained active; zero rows had archive metadata; foreign
  keys were clean; the active badge query used covering index
  `idx_staff_notif_active_badges`.
- Worker version: `f748d9ed-8ae7-42ae-adaa-be0ccc4b4c01`. All three schedules
  were preserved; both health domains and D1 connectivity returned 200; anonymous
  badge and archive access returned 401.
- Pages deployment: `fbcc5700-1868-4653-b580-595a01302183` from commit
  `39a8728`. Preview and production served the same 55,252-byte notification
  bundle; private route headers remained `noindex, nofollow` and `private,
  no-store`; the public site returned 200 after its canonical redirect.
- Final bookmark:
  `00001259-00000729-000050e7-758dc718c05f02b3b8fcf37cc015c3bd`.
  Final trailing-24-hour usage was 3,696,603 rows read and 56,519 rows written.
- A signed-in browser was not connected to the automation session, so the
  authenticated visual walkthrough remains a manual follow-up. No production
  notification, support-message, mark-read, email, archive, or rollback mutation
  was triggered for smoke testing.
- Stop rule active: no migration 116 and no historical archive backfill on this
  UTC day.

### Phase 5B — Archive-candidate index on a later UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Apply migration 116, verify its ledger entry and `EXPLAIN QUERY PLAN`, then
   stop for the remainder of the UTC day.
3. Do not archive historical rows on the index-creation day.

#### Phase 5B deployment result — 2026-09-17

- PASS: executed only `116_staff_notification_archive_candidates.sql` from a
  clean, detached worktree at application commit `fe3cf24`; existing local memory
  edits were not included. The executed file's SHA-256 was
  `6E27C487C7FB44CD64EA934641BFC5195BD23AA14CDE1BE9B9E66F78D23F8182`
  (Git blob `ce1d11e6ad8010463c807c095dcb96c9bb760b8a`).
- Preflight: Cloudflare account and database matched Phase 5A; migration 116
  and its index were absent. There were 26,043 notifications, none archived.
  The conservative 11-hour Insights window showed 12,061 writes; estimated
  index entries plus the 40,000-row reserve gave 78,104, below 100,000.
- Pre-migration Time Travel bookmark:
  `00001267-00000816-000050e9-93aeda65b7ddaeaab34dba24e10d24b0`.
- Migration succeeded with two statements, 52,845 rows read, 26,048 rows
  written, and final bookmark
  `00001267-0000081f-000050e9-4a46daa1d23d2bd15fdbd98f3e03f40f`.
- PASS: the ledger row and non-unique index each exist once. Production
  `EXPLAIN QUERY PLAN` searches covering index
  `idx_staff_notif_archive_candidates` for the approved event types, null
  archive marker, and cutoff; SQLite uses a temporary B-tree for the final
  ordering across the two event types, not a table scan. This is acceptable for
  the bounded 500-row candidate workflow and should be rechecked before backfill.
- PASS: notification count remained 26,043; archived and batch-tagged counts
  remained zero. Worker API health, database health, and public site returned
  HTTP 200. Focused local migration/archive/badge tests passed 9/9.
- No Worker or Pages deployment, archive backfill, notification read-state
  change, or deletion occurred. Stop for the rest of the UTC day; do not apply
  migration 117 or 118 today.

### Phase 5C — Rollback index on a third UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Apply migration 117 and verify batch-key rollback uses the named index.
3. Stop for the remainder of the UTC day and do not archive historical rows.

#### Phase 5C deployment result — 2026-09-18

- The business owner approved up to two small weekend enhancements per day.
  This changed the one-index-per-day cadence for September 18 only; the
  40,000-row write reserve, separate preflight, bookmark, and verification gates
  remained mandatory for each index. No archive backfill was authorized for the
  index-build day.
- The rolling 24-hour D1 read figure was 3,252,097 (not an exact UTC-day quota
  counter). An eight-hour Insights window spanning all of the new UTC day showed
  56,849 reads and 949 writes before Phase 5C. The conservative one-index budget
  was 66,992 writes including the 40,000 reserve. Production health and a real
  public course read returned HTTP 200. Phase 5B ledger/index and its indexed
  query plan remained intact; 26,071 notifications existed, with none archived.
- Applied only `117_staff_notification_archive_rollback.sql` from a clean
  detached worktree at commit `fe3cf24`; executed-file SHA-256
  `0E36C4C7F5306AF5BAA338902F17FF5F0AFC94AEF911BC3E2A2ED2A65CC71C76`.
  Pre-migration Time Travel bookmark:
  `00001271-000001be-000050ea-60e8ee9e8048d51e035ab9f6e58154e4`.
- D1 executed two statements, reading 52,344 rows and writing 26,076 rows;
  final bookmark:
  `00001271-000001c4-000050ea-2daa3e9e19bc885519a99b53a37ddc66`.
  Its ledger row and index exist exactly once. Production `EXPLAIN QUERY PLAN`
  searches covering index `idx_staff_notif_archive_batch` for bounded rollback
  selection. Notification count stayed 26,071, with zero archived or batch-tagged.
  API, database, and real public D1 reads returned HTTP 200.

### Phase 5D — Archive-history index on a fourth UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Apply migration 118 and verify paginated history uses the named index.
3. Stop for the remainder of the UTC day and do not archive historical rows.

#### Phase 5D deployment result — 2026-09-18

- After Phase 5C verification, a fresh eight-hour Insights sample showed 951
  writes. Conservatively adding Phase 5C's measured 26,076 writes, Phase 5D's
  estimated 26,071 entries, and the 40,000-row reserve gave 93,098, below
  100,000. The latest notification count was 26,071; migration 118 and its index
  were absent. The fresh pre-migration Time Travel bookmark was
  `00001271-000001c6-000050ea-d78f173d41b26acb359b82a663822c89`.
- Applied only `118_staff_notification_archive_history.sql` from the same
  clean detached worktree; executed-file SHA-256
  `56866B799703B34668EDB518B8E3447A9F69DE5A52FB663AE5CBB50C78AE4150`.
  D1 executed two statements, reading 52,368 rows and writing 26,076 rows;
  final bookmark:
  `00001271-000001cc-000050ea-783f4acc4a113e38e5496e7396a1ee6e`.
- PASS: migrations 115–118 and all four archive/active indexes are present.
  Production `EXPLAIN QUERY PLAN` searches covering index
  `idx_staff_notif_archive_history` for paginated user history. The total
  remained 26,071; archived and batch-tagged totals remained zero. Worker API,
  D1 connectivity, a real public D1 read, and the public site returned HTTP 200.
  Focused migration/archive/badge tests passed 9/9 before either index build.
- No Worker or Pages deployment, notification delete, mark-read, or historical
  archive backfill occurred. The day is closed to further production changes.

### Phase 5E — Reversible archive backfill on a fifth UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Preview candidate count and event-type distribution; it must reconcile to the
   approved allowlist and cutoff.
3. Archive in batches of at most 500 rows with one release-specific batch key.
4. After every batch, verify updated count, remaining candidates, active badge
   count, Worker health, and D1 writes. Stop before the safety reserve is crossed.
5. Reconcile original total = active total + archived total, with no deleted rows.
6. Record the batch key, cutoff, counts, bookmark, version, and operator time.

Rollback: deploy the prior Worker if application behavior regresses. Nullable
columns and non-unique indexes may remain. If the backfill is wrong, run the
batch-key rollback helper and reconcile totals before continuing.

### Phase 5E execution — 2026-09-19 (partial, quota-gated)

- PASS: the pre-write preview found 20,334 eligible active rows before the
  backfill: 18,607 `new_support_message` and 1,727 `human_escalation`. The
  deterministic cutoff was `2026-08-20T00:00:00.000Z`.
- Captured the fresh pre-write Time Travel bookmark
  `00001283-00000c06-000050eb-e004131054040337a9e1cfcd81921689`.
- Archived 8,000 rows in sixteen separately verified 500-row batches using
  batch key `notif-archive-20260919-phase5e`. D1 measured 2,500 writes per
  batch, or exactly 40,000 writes total (five writes per archived row).
- PASS: 8,000 batch-tagged rows reconcile exactly: 7,400
  `new_support_message` and 600 `human_escalation`; 6,423 unread states were
  preserved. All rows match the approved event allowlist, cutoff, archive
  reason, and non-null archive timestamp; invalid batch rows = 0.
- PASS: the table reconciled as 26,130 total = 18,130 active + 8,000 archived;
  D1 connectivity returned normally. No notification was deleted or marked
  read, and no support conversation/message row was changed by the backfill.
- STOP: 12,334 eligible rows remain. The rolling 24-hour D1 counter reached
  51,333 writes after the batch, so further production mutation was stopped to
  preserve the agreed 40,000-row safety reserve and organic write headroom.
- Storage note: reversible archiving improves the active badge/list working set
  but does not reclaim physical D1 space. Database size was 363,282,432 bytes
  after the backfill; physical deletion/VACUUM remains a separate, explicitly
  deferred retention decision.

Next safe step: observe one complete UTC day, then continue the same batch key
on a fresh write-budget day only if the gate passes. Do not combine the
remaining backfill with index creation, payload normalization, deletion, or
VACUUM.

### Phase 5E continuation — 2026-09-20 (partial, quota-gated)

- PASS: authentication, D1 connectivity, prior-batch reconciliation, and the
  archive allowlist/cutoff checks passed before mutation. The current UTC-day
  Insights sample contained approximately 22,000 writes.
- Captured the fresh pre-write Time Travel bookmark
  `00001289-00000110-000050ec-edbb62a6e8dcee5f50b57058dc2dcb79`.
- Archived 6,000 additional rows in twelve 500-row batches using the existing
  batch key `notif-archive-20260919-phase5e`. Each batch again measured exactly
  2,500 writes, for 30,000 writes total.
- PASS: 26,172 total rows reconcile exactly as 12,172 active + 14,000 archived.
  All 14,000 batch-tagged rows remain within the approved event allowlist and
  cutoff; invalid batch rows = 0. Their original unread states remain preserved.
- The active unread working set fell to 11,380. A total of 6,334 approved rows
  remain eligible for a later quota-gated batch day.
- STOP: post-change rolling counters were 3,849,763 reads and 37,788 writes;
  no additional production mutation was attempted. Database size was
  367,857,664 bytes. Archiving reduces the active query set but does not reclaim
  physical storage.

Next safe step: measure the complete September 20 UTC day, then finish the
remaining 6,334 eligible rows on a fresh write-budget day. Retention/deletion
and payload normalization remain separate changes.

Later on September 20, the BO-authorized ceiling was tightened to 75,000 UTC-day
writes while preserving at least one million reads for clients. Six additional
500-row batches archived 3,000 rows for exactly 15,000 writes. The update
subqueries and final compact reconciliation consumed approximately 97,000 reads
in total. Final verification passed: 26,172 total = 9,172 active + 17,000
archived; active unread = 8,410; batch invalid rows = 0; original unread state
was preserved for 15,331 archived rows; and D1 connectivity remained healthy.
Exactly 3,334 approved candidates remain. Estimated September 20 UTC-day writes
after this continuation were approximately 67,000, leaving about 8,000 writes
for organic and scheduled activity below the 75,000 operating ceiling. No more
production D1 reads or writes should be initiated for this UTC day.

### Phase 5E completion — 2026-09-21

- The operating gate reserved at least 20% of both free-tier daily allowances:
  1,000,000 reads and 20,000 writes. The pre-change 18-hour Insights sample was
  approximately 2,682,678 reads and 30,838 writes.
- Captured the fresh pre-write Time Travel bookmark
  `0000128c-000001b8-000050ed-064cf517ec83f21a7bcb644b2268842c`.
- Archived the final 3,334 eligible rows in six 500-row batches and one 334-row
  batch. D1 measured exactly 16,670 writes. The update queries and final
  reconciliation used approximately 76,535 reads.
- PASS: no candidates remain. The table reconciled exactly as 26,215 total =
  5,881 active + 20,334 archived. All archived rows share the approved event
  allowlist, cutoff, reason, and batch key; invalid batch rows = 0. Original
  unread state remains preserved for 18,618 archived rows.
- PASS: D1 connectivity remained healthy. No notification was deleted or marked
  read, and no underlying support conversation or message was changed.
- Conservative post-change estimate, including the measured manual work, was
  approximately 2.76 million reads and 47.51 thousand writes. This left about
  2.24 million reads and 52.49 thousand writes—well above the requested 20%
  client reserve. Insights had not yet ingested the manual batch at the final
  check, so these post-change totals are arithmetic estimates rather than a
  same-minute dashboard claim.
- Database size was 373,506,048 bytes after completion. Phase 5E is complete;
  further physical-size reduction requires a separately approved retention or
  payload-normalization change.

## Phase 6 — Post-deployment verification

### Current handoff — 2026-09-18

- Phases 5A–5D are complete. Phase 5A released the application and active
  index; Phases 5B–5D were index-only. Phase 5E historical backfill has **not**
  been executed. No historical notification has been archived, deleted, or
  marked read by this project. Each production phase's recovery bookmark and
  verification evidence are recorded above.
- A separate Pages-only idle-session correction shipped from commit `fe3cf24` as
  Pages deployment `4fb0ae23-303c-4d20-91a7-722edfec4ce9`. It prevents initial
  mount, reload, and visibility restoration from being counted as activity while
  preserving a fresh window after explicit password/admin/OTP login and extension
  from trusted user or cross-tab activity.
- That correction added no polling, Worker work, D1 read/write path, notification,
  or UI prompt; the existing two-minute idle warning remains the only warning.
  Verification passed 20 focused tests, 194 critical-cycle tests, TypeScript, and
  the full production build. No Worker or database deployment accompanied it.
- The 2026-09-16 observation is encouraging but not a final quota measurement:
  7,357 rows appeared in the latest-hour Insights sample and 373,898 in the
  six-hour top-100 sample. The 5,261,645 `d1 info` figure was trailing 24 hours,
  not current UTC-day usage.
- A complete UTC-day measurement remains necessary before claiming D1 savings;
  `d1 info` is a rolling 24-hour counter and Insights is experimental. The
  index-only phases are not expected to lower active badge reads while zero rows
  are archived.
- The BO-approved low-traffic weekend exception allowed separate, gated Phase
  5C and 5D index builds on September 18; both passed. On September 19, review a
  complete September 18 UTC-day read/write window, production health, archive
  query plans, and the active/archived reconciliation. Only then consider the
  reversible Phase 5E backfill. Preview exact cutoff/event-type candidates,
  repeat the write-budget and Time Travel gates, and stop if any count, read
  state, support behavior, or health signal is ambiguous. Never backfill on an
  index-build UTC day.

Immediate checks (first 60 minutes):

- Worker and database health remain HTTP 200.
- No elevated authentication, support, notification, or email errors.
- Badge/list queries return expected active values.
- New support activity creates or reopens exactly one conversation notification.
- Archive counts and active + archived reconciliation remain stable.

Measurement checks:

1. Inspect D1 Insights after two hours for an obvious regression, without
   claiming final savings.
2. Measure one complete 00:00–24:00 UTC day after Phase 5A.
3. Measure another complete UTC day after Phase 5B.
4. Compare grouped badge rows read, executions, average rows per execution,
   total D1 reads/writes, notification inserts, and support response behavior.

Success thresholds:

- No notification or underlying support data deleted.
- Exact active + archived row reconciliation.
- No missed support escalation or email regression.
- Grouped badge average rows read falls by at least 60% from the 2,278 baseline.
- Grouped badge total rows read falls below 350,000 per rolling day under similar
  staff activity.
- Total D1 rows read moves below 4.0 million as an interim threshold; the existing
  long-term target remains below 3.5 million per UTC day.
- UTC-day writes remain below 60,000 during steady state and below 100,000 during
  a separately approved backfill day.

If badge savings miss the threshold, diagnose query plans and workload mix before
adding cache. If behavior regresses, roll back first and investigate second.

## Explicitly deferred decisions

- Physical deletion or VACUUM of staff notifications.
- Retention for `recommendation_deliveries`, email evidence, audit logs, financial
  records, orders, or support messages.
- A global one-month retention rule for all notification types.
- Materialized counters or cross-isolate cache. These remain later options only
  if archive/coalescing measurements leave insufficient D1 headroom.
