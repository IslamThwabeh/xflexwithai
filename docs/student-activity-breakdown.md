# Students activity breakdown

The Students card now says **Clients with active packages**. Selecting it preserves the existing package filter and expands a recommendation audience tree below the cards. The card has a hover description; each information button supports a tooltip on hover/focus and a popover on click/tap. English and Arabic are supported.

Package counts are distinct non-staff clients with a package marked active. Recommendation totals count subscription records whose saved active flag is set, including expired, paused, and pending records. These populations are separate; recommendation records must not be presented as a subset of package clients.

The tree partitions recommendation records using the existing delivery audience rules: paused, pending, expired, then account/staff/email/preferences checks. Remaining eligible subscriptions are deduplicated by client. Additional nonzero exclusions and duplicate eligible records appear automatically. Eligibility describes the audience for a new alert; it does not establish delivery or reading, and muted follow-up threads may have smaller audiences.

## Read behavior and cost

- `reports.recommendationAudience` has the same staff authorization as `reports.subscribers` and returns aggregate diagnostics only.
- It calls the shared read-only audience reader. It never invokes activation repair or queues notifications. Send-time repair and delivery behavior are preserved.
- The frontend mounts the query only while the tree is expanded, reuses its cache for one minute, disables focus refresh and automatic retry, and adds no interval polling. Refresh is manual.
- One existing joined audience query reads the small recommendation subscription table. Account/control joins use primary-key/unique indexes; analyst role checks use existing bounded chunks and the `(userId, role)` unique index. No schema or index change is needed. The only additional Worker work occurs when the breakdown loads or is manually refreshed; no extra work is added to notification sending.
- SQL contract tests execute the actual reader against physical production column names and check query plans and zero writes. At the 95-active-record fixture there is one subscription query and two bounded role queries. The subscription scan is intentional for this on-demand aggregate; cost grows with the subscription table and should be revisited before adding polling or materially increasing volume.

## Verification

- 32 focused tests passed across audience SQL/route coverage and existing recommendation workflow/delivery coverage.
- TypeScript, the application production build, and the Worker build passed.
- Playwright checked expansion/collapse, hover/focus and click descriptions, 390px layout without horizontal overflow, and Arabic RTL using synthetic fixtures rather than customer records.
- Local screenshots and browser fixtures are in ignored `output/playwright/students-breakdown-*` files.
- No production data changes, migration, or deployment performed.

## Production release preflight — 2026-10-21

- 40 focused tests passed, including the existing production recording CORS behavior preserved in a separate commit.
- Production `EXPLAIN QUERY PLAN` confirms primary-key account joins and the existing unique client notification control index. The only scan is the small subscription table, already documented for this on-demand aggregate.
- Release uses the existing `codex/live-package-phase-a` branch and deploys the Worker before Pages. No database migration is required.
