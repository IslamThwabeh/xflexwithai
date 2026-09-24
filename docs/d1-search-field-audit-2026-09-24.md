# D1 Manual Search Safeguards — Production Handoff

Date: 2026-09-24
Status: Implemented, migrated, tested, and deployed to production. Observe complete UTC days before returning the Worker to the Free plan.

## Purpose

Prevent manual search fields from creating unbounded D1 reads through per-keystroke requests, focus refetches, background polling, or application-side filtering of a full user list.

## Production release record

- Pages deployment: `53cae1f9-c39d-457b-abc2-df2c6de64a0a`
- Worker deployment: `1d6a1feb-2600-4c66-8b87-4f1140a222fc`
- Search-index migration: `database/migrations/130_support_client_prefix_search.sql`
- Migration indexes: `idx_users_support_email_lower`, `idx_users_support_name_lower`, and `idx_users_support_phone`
- Migration result: 919 rows read, 459 rows written, database size 284.18 MB
- Post-migration Time Travel bookmark: `000012b4-000002b4-000050f0-2f6f250194a3cb78002d2df97b8d0961`
- Release commits: `530913e` bounded support search; `da81cdd` debounced/manual searches and prefix indexes; `f9aea75` automatic-refetch protections; `412765b` build stabilization; `64a843a` deployment record.
- Daily email maintenance remains scheduled at `30 23 * * *` (02:30 Asia/Amman), before the 03:00 local D1 quota reset.

## Non-regression contract

The following rules are part of the D1 capacity boundary and must not be removed casually:

1. Support client search executes a bounded SQL prefix query. It must never load all users into the Worker and filter them in application memory.
2. Support results remain capped at 50 records and select only the five fields needed by the UI.
3. Onboarding, broker report, recommendation history, community member, loyalty-point, and engagement searches use the shared 400 ms debounce and require at least two trimmed characters.
4. The API independently enforces the two-character minimum for global search, LexAI search, support inbox/search, recommendation history, community, engagement, onboarding, broker report, support-client, and loyalty-point searches. Frontend validation alone is insufficient.
5. Manual search queries do not refetch on window focus, in the background, or on an interval. Support inbox polling is paused while a manual search is active.
6. Admin and public global search retain their existing debounce/minimum-length protection and do not refetch on focus.
7. LexAI search has no 15-second refresh while search is active and does not refetch on focus.
8. Email-log search remains explicit through **Apply** and does not refetch on focus.
9. Partial contains searches (`%text%`) must not be reintroduced for the support user directory. Prefix ranges and the named indexes are the approved safer behavior.

Any future search change must have a focused test covering minimum length, debounce/manual execution, focus/background behavior, result limit, selected columns, and the SQL query plan where applicable.

## Verification completed

- Consolidated search gates passed before release; the final release run passed 30/30 focused tests.
- TypeScript, Worker build, and the production application build passed.
- The application build completed with 7,536 modules and generated 36 public plus 6 article SEO pages.
- Production site, Pages deployment, and Worker health smoke checks returned HTTP 200 with expected routing.
- Migration reconciliation and foreign-key checks were clean.

## Free-plan observation gate

Do not judge the change from a partial or rolling day. Measure complete UTC days (00:00–23:59 UTC; quota reset is 03:00 Asia/Amman).

- Internal go target: less than 3.5 million D1 rows read and less than 70,000 rows written on every observed day.
- Platform ceilings: 5 million rows read and 100,000 rows written per UTC day on D1 Free.
- Require no D1-limit errors, Worker CPU-limit errors, login failures, missing support/recommendation results, or email-maintenance regressions.
- Because the release occurred during 2026-09-24 UTC, the first complete post-release day is 2026-09-25 UTC and closes at 03:00 Amman on 2026-09-26.
- Prefer seven complete days (2026-09-25 through 2026-10-01), with the downgrade decision after 03:00 Amman on 2026-10-02. Three complete days is the minimum evidence, not the preferred production safety margin.

The rolling 24-hour D1 Insights sample taken on 2026-09-24 showed approximately 3.192 million rows read and 27,115 rows written across the top 100 fingerprints. This is encouraging but is not an exact complete-day total, includes migration/diagnostic activity, and is not sufficient by itself to approve Free-tier operation.
