# Navigation search and D1 budget

Date: 2026-11-14. Scope: search tuning requested by the owner after pausing broader signed-in QA. Billing is unchanged.

## Search behavior

**Find a page** filters the already-authorized navigation list in the browser. Opening it, typing, clearing, pinning favorites and closing it add zero search API requests, SQL reads or SQL writes. It does not fetch or prefetch destination records. Visiting a selected page still loads that page normally. The existing shared session/activity handling also remains; ordinary keyboard/pointer activity can trigger its existing throttled heartbeat.

The separate, pre-existing **full-admin record search** searches users, orders, courses, articles and keys. It previously submitted after a 300 ms typing pause. It now waits for Enter or the bilingual Search button, trims the submitted term, requires at least two characters, and caps input at the existing server maximum of 200 characters. Changing the draft hides previous results until submission. A request in progress disables another submission. Errors show an explicit retry instruction.

Fresh results are cached in the existing in-memory query cache for five minutes. Mount, focus, reconnect, polling and automatic retries are disabled for this search. Reopening and submitting a fresh cached term reuses it; deliberately submitting the current term again refreshes it once. No search result is persisted to browser storage. Student/staff permissions, result categories and destination links remain unchanged.

## SQL and CPU assessment

There is no backend, SQL, schema, index, cron, retention or provider change. Page search remains zero additional SQL reads. Record search invokes the same five SELECT statements only after explicit submission. Each statement returns at most 20 matches, but its existing `%term%` predicates can scan the corresponding table; a result limit is not a row-read limit. This release reduces accidental/repeated invocations, without claiming a fixed per-search row budget or abuse protection. An indexed exact/prefix record-search design remains a separate improvement if usage warrants it; preserve substring behavior until that tradeoff is reviewed.

The actual existing helper was executed through the real D1 adapter against the schema-only production fixture with synthetic matches, nullable user phone/key email, no matches and blank input. Blank input issued no SQL; nonblank input issued five statements. Local EXPLAIN documented the five expected existing table scans. Read-only production metadata and individual EXPLAIN checks reconcile the physical schema and plans; no customer search was executed in production. No new scan is introduced. Expected Worker CPU impact is neutral for page search and lower in aggregate for record search because typing/refocus/retry no longer invokes it. CPU has not been benchmarked.

## Verification and evidence

TypeScript, the application build, SEO/private-route checks and 36 navigation/search/badge tests pass. An isolated Chrome check with intercepted API responses passed ten groups: eight local page-search combinations (student/admin, Arabic/English, 320/1440 px) and two record-search lifecycles. It verified zero feature requests while typing, Enter/button submission, draft/result separation, focus/reconnect suppression, cache reuse after reopening, deliberate refresh, no automatic error retry, explicit retry and narrow-screen fit. All eight record requests were mocked; there were no JavaScript exceptions or production receipts. The existing shared activity throttle was primed before measuring feature requests. The owner's real browser/session was not used; broader QA remains paused.

Private reports, exact SQL, schema reconciliation, local/live plans, build/test logs and browser evidence are ignored under `output/d1-search-guardrail-2026-11-14/`.

## Current Free-plan readiness

Read-only guardrail generated at **2026-11-14 19:33:36 UTC**, before this frontend tuning:

| Metric | Trailing 24 hours / size | Internal assessment |
|---|---:|---|
| D1 rows read | 1,832,902 | Pass; 36.7% of daily Free allowance |
| D1 rows written | 12,098 | Pass; 12.1% of daily Free allowance |
| Database storage | 461,357,056 bytes | Caution; 88.0% of the runbook's 524,288,000-byte ceiling |

Overall **CAUTION**, because of storage. This is a rolling sample, not a complete UTC-day quota measurement or a forecast. The largest sampled read families were notification batch history (336,808 rows), notification-retention grouping (194,488), recent outbox status grouping (180,648) and staff badge grouping (142,976). Their optimization is outside this search-only release; do not silently change notification/retention behavior or perform cleanup.

Official [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) were checked on this date: Free includes 5 million reads/day, 100,000 writes/day and a 500 MB maximum per database. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) also require evaluating the 100,000 daily requests, 10 ms CPU and per-invocation query/subrequest constraints; D1 Free permits 50 queries per invocation. This change adds no paid-only dependency, but does not certify the entire application/account for an immediate downgrade.

Before a billing change, follow `d1-free-plan-guardrail-runbook.md` and `d1-free-plan-pre-downgrade-plan-2026-09-28.md`: prefer seven complete UTC days under targets (three minimum only for owner-accepted urgency), review database growth and other account storage, confirm Worker CPU/request/query limits and error evidence, and complete the runbook smoke checks. Production cleanup or a billing change still needs explicit owner authorization. Do not rerun historical cleanup or change retention merely to turn this report green.

## Release

Frontend-only safeguard prepared for the existing production Pages project. Worker `31364cc0-2688-44bb-acc7-ccbd01889a44`, migration 135 and announcement choices remain in place. Previous frontend for rollback: Pages `88a66b00-3dda-4626-bf10-5d648b5f407e`. Reverting to it restores automatic record-search typing requests, so prefer a forward fix for UI regressions. No financial/accounting action, package, customer message or billing-plan change is part of this work.
