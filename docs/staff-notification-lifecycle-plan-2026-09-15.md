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
2. Add a small Archive section to the staff notification page if product review
   confirms staff need self-service history; otherwise retain API-only recovery
   for the first release and avoid a Pages deployment.
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

### Phase 5B — Archive-candidate index on a later UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Apply migration 116, verify its ledger entry and `EXPLAIN QUERY PLAN`, then
   stop for the remainder of the UTC day.
3. Do not archive historical rows on the index-creation day.

### Phase 5C — Rollback index on a third UTC day

1. Re-run the write-budget gate and capture a fresh Time Travel bookmark.
2. Apply migration 117 and verify batch-key rollback uses the named index.
3. Stop for the remainder of the UTC day and do not archive historical rows.

### Phase 5D — Reversible archive backfill on a fourth UTC day

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

## Phase 6 — Post-deployment verification

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
