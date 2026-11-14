# Navigation V2 and workspace announcement

Status: live on xflexacademy.com. The initial release was `a92e2d0`/`f0c63d7`; signed-in QA corrections `ce919e5` are now pushed and deployed on Pages `88a66b00-3dda-4626-bf10-5d648b5f407e`. Worker `31364cc0-2688-44bb-acc7-ccbd01889a44` and migration 135 remain in place.

## Result and scope

The approved preview is integrated into the existing authenticated layouts. Students use My Learning, Services, Support and More; the account menu retains profile, package, activation/renewal and broker links. Notifications remain in the header. Desktop groups become bottom navigation on mobile. Existing staff-workspace and authorized Live Expert shortcuts remain available.

The admin/staff sidebar regroups the existing 48 catalog destinations into eight categories. Page search, favorites scoped to the signed-in account, saved group expansion, Arabic mirroring, a mobile drawer and accessible close controls simplify navigation. Assigned Employee Training remains a separate group. Unknown future destinations fall back to Other instead of disappearing.

The existing `visibleSections` role, finance-authority and feature-availability filters are preserved. Grouping happens **after** authorization filtering. Existing `ClientLayout` availability/entitlement queries still construct the student destination list. Route guards and server permissions are unchanged. Search and favorites use only those authorized lists. Full-admin record search remains separate from local page search; its old student/key links now point to `/admin/students` and `/admin/package-keys`.

## One-time guidance

Authenticated workspaces show a compact bilingual banner with three tips appropriate to students, staff or admins. It appears only after the new frontend mounts the component. It does not send email, create support messages or backfill notification records.

- **Got it:** persistently dismisses this announcement for the account, across future sign-ins and devices.
- **Remind me next login:** hides it for the current sign-in, including refreshes, and shows it after a later sign-in.
- A failed save leaves the banner visible with a retry message. A failed status request leaves the workspace usable.
- The fixed campaign identifier survives rebuilds. A stale tab cannot undo permanent dismissal.
- Server identity and server `lastSignedIn` determine the account and login. Client input cannot select another account or announcement. Existing negative admin IDs avoid collisions with student/staff IDs.

The login marker uses the account's existing last-sign-in timestamp. Signing in on another device updates that account timestamp; an already-open device may therefore see a deferred announcement after refreshing its auth state. No token, session expiry or login-policy behavior changes.

## Database and runtime cost

Migration `135_interface_announcement_states.sql` adds one empty `WITHOUT ROWID` table with composite primary key `(announcement_id, account_id)`. There is no customer-data backfill or edit to existing tables. Schema source is also represented in `database/schema-sqlite.ts`.

The status procedure performs one selective primary-key read with at most one result row. The frontend caches the result for five minutes, without polling or focus refresh. Explicit user actions perform one primary-key upsert. Permanent dismissal makes later stale writes no-ops. No cron, fanout, provider request or new service package is introduced. Existing customer-terms checks continue to apply.

Navigation grouping/search operates on at most the small authorized catalog; it adds zero SQL reads and no background Worker work. The announcement adds bounded statement work only when requested. No material Worker CPU increase is expected; production CPU has not been benchmarked for this release.

## Verification evidence

Private, synthetic and operational artifacts are ignored under `output/playwright/navigation-v2/`.

- Destination tests cover all 48 catalog paths, every role in `ROLE_PAGE_ACCESS`, future-path fallback, employee training, all 32 student conditional-destination combinations, active-path matching and unavailable storage.
- Actual service SQL runs through the repository D1 adapter against SQLite. Tests cover initial visibility without writes, current/new login deferral, permanent dismissal, retries/stale tabs, account/admin/campaign isolation and indexed access on 2,000 fixture receipts.
- Router tests exercise student/staff/admin ownership, trusted login markers, anonymous denial, the existing customer-terms gate and invalid actions.
- A schema-only production export was restored locally. Applying migration 135 twice preserved all 502 existing schema objects, passed integrity and foreign-key checks, retained receipt choices, and used the composite primary key without scans.
- The exact original role/feature-filter callback was compared with the integrated version, allowing only line-ending differences. Browser scenarios derive their expected destinations from the original implementation.
- TypeScript, the full application/Worker builds and SEO/middleware checks pass. Focused coverage passes 50 tests, the layout suite passes 5 tests, and the established critical workflow cycle passes 231 tests across 33 files.
- The final isolated Chrome pass completed all 75 check groups with zero JavaScript exceptions: 56 role/feature scenarios, six admin language/width layouts, favorites/collapsed-sidebar/record-search interactions, eight student language/width layouts, three audience announcement lifecycles and the optional-status-outage check. Widths include 320/390 px for both workspaces and 1024/1440 px for students. Each eligible student scenario preserved all 18 destinations including profile. Screenshots were visually reviewed in Arabic and English.
- A separate pass waited for each status response to settle and verified initial display, refresh deferral, later-sign-in return and permanent dismissal for all three audiences, with six synthetic action writes and zero JavaScript exceptions. The final Worker deployment dry run also passed.

The browser harness uses synthetic responses on normal application routes and creates no production account data. This establishes navigation reachability and announcement UI behavior; it does not prove every feature's full production workflow. Existing nested main landmarks were observed in the dashboard layouts and remain an accessibility follow-up outside this navigation release.

## Release gate and recovery

The owner explicitly approved migration 135 and deployment after the completed local verification. The earlier migration approval gate is resolved. Existing authorization covers pushing the reviewed source and tracked release/memory records.

The reviewed migration SHA-256 is `00029300b7562e2b16ef0632522f8e7f48db15b46445cacbf3762ca1913d5cc6`. The schema-only rehearsal snapshot SHA-256 is `f7c280b37d27196a4306033399eed95fc0f2f7800d1b0ba83e619195d87a1d7f`. Production read-only metadata confirmed the receipt table is absent and the existing migration ledger format is compatible. Live receipt-table metadata and query-plan verification follow the approved creation.

The rollout verified Cloudflare authentication, captured the recovery bookmark and deployment baselines, applied only migration 135, reconciled its live schema/ledger/PK/query plan, and deployed Worker before Pages. Do not rerun the migration or clear announcement choices during routine follow-up.

Routine rollback restores the prior frontend and Worker. The additive receipt table may remain; do not restore the whole database or erase choices as a routine code rollback. Emergency Time Travel recovery requires a separately reviewed incident plan because it affects unrelated concurrent business activity.

No package, order, payment, accounting balance, customer message or role assignment is created by QA. Live authenticated student/admin/support workflows and physical-device/Safari verification must be reported separately from synthetic Chrome coverage.

## Production release — 14 November 2026

- Migration 135 is recorded exactly once as `schema_migrations.id = 79`, applied at `2026-11-14 18:17:38` UTC. The live table/columns/composite PK match the rehearsed structure. `EXPLAIN QUERY PLAN` selects `SEARCH interface_announcement_states USING PRIMARY KEY (announcement_id=? AND account_id=?)`, without a scan. The table had zero receipt rows before the Worker/frontend rollout.
- Pre-migration Time Travel bookmark: `00001924-00000e8c-00005123-fbfc7e6a6f14cadd58a3088fe856bf4d`. Migration bookmark: `00001924-00000e94-00005123-a3b47ff768cfc61ad246717917a01b7d`; ledger bookmark: `00001924-00000e9a-00005123-338d5d3963cd0a80fe52c9abeffd5ddb`.
- Worker `31364cc0-2688-44bb-acc7-ccbd01889a44` is active at 100%. Its 31 bindings, including live variables/secrets and all storage targets, and runtime settings match the previous version. All four schedules are preserved: `* * * * *`, `*/5 * * * *`, `30 23 * * *`, `0 5 * * *`.
- Pages production deployment `90bdc9cb-734c-4e96-99b5-1330769fbafd`, source `f0c63d7`, is active on branch `main`. Deployment URL: `https://90bdc9cb.xflexwithai.pages.dev`.
- Live HTTP verification passed nine exact asset SHA-256 comparisons, 16 canonical/deployment route checks, API health and anonymous 401 denials for both new announcement endpoints. Private workspace pages retain `noindex` and `no-store` headers.
- Isolated Chrome passed eight bilingual public check groups using actual public API responses, and all 75 navigation check groups using synthetic account/API responses with the deployed assets. There were zero JavaScript exceptions. The nine simulated announcement action requests were intercepted and created no production receipts. This verifies production assets and navigation behavior without impersonating a production account.
- The measured release SQL commands reported 1,198 rows read and six rows written in total. Table creation reported one read/two writes; migration-ledger insertion reported 61 reads/four writes. Remaining measured reads are schema/ledger/index/query-plan/empty-table verification. These figures exclude normal concurrent application traffic and Cloudflare metadata/Time Travel operations. No new polling, scheduled work or recurring catalog query was added; no production CPU benchmark was performed.
- The existing owner Chrome academy tab was inspected and is on `/auth`, signed out. A request to sign in to the developer test student account is pending. Actual authenticated student, support and admin production workflows, PDF/active-service follow-ups, and physical-device/Safari verification remain unverified in this release. No funds, packages, payments or customer messages were added during deployment/QA.
- Code rollback targets: Worker `ac7fbae3-7516-4454-bdf7-fe7cd0961439` and Pages `d717e4cf-1434-46c7-8a73-6d62633699c1`. Keep the additive table and legitimate user choices; do not restore the whole database for a code rollback.

The initial automatic approval-review attempt failed because its reviewer hit a usage limit, before any deployment command executed. The owner repeated the instruction to proceed; the normal approval retry succeeded. No approval bypass was used. Live verification and private operational evidence are under ignored `output/playwright/navigation-v2/production-release/`.

## Signed-in student verification and navigation corrections

The owner supplied the developer test student session. Native Chrome verification opened all 18 available destinations: dashboard, LexAI, Recommendations, documents, guides, support, community, jobs, quizzes, surveys, package, Live Package, activation, brokers, notifications, points, calculators and profile. Both language versions of page search listed the same permitted set and filtering opened the correct destination. No admin or staff-only route appeared for the student.

The initial guidance rendered correctly in Arabic and English. Remind me next login saved through the real API, disappeared, and remained hidden after full refreshes and navigation across the workspace. Actual next-sign-in return and permanent dismissal on this account were not exercised; those paths retain their earlier actual-SQL and synthetic browser coverage.

The existing course played and paused successfully; the dashboard retained its accurate 3%/one-lesson progress and exemption distinction. The library displayed ten documents, and the authenticated overview PDF rendered in Chrome's viewer with 20 pages. The entitled Live workspace and its protected recording also played and paused successfully. LexAI and Recommendations correctly presented this account's expired-service gates while course/documents remained accessible. Support, notifications, points, calculator updates, community, job eligibility, submitted-survey status, package details, profile and broker status loaded. The activation form was inspected without submitting a key. No order, payment, package, credit, refund, role, support message, community post or application was submitted. Only normal viewing/engagement, the announcement deferral and language-preference test actions occurred.

The QA round identified three navigation corrections within the approved release:

1. The Arabic page-search close button overlapped the heading. Its position now mirrors to the left, the header reserves space, its accessible label is localized, and its target is 44 × 44 px.
2. A changed language could revert when another routed layout mounted with an older account cache. The client updates only the cached language preference immediately, scopes in-flight intent to that account, keeps the intent through delayed saves/revalidation, and then refreshes the existing account query once. Other preferences and account fields are preserved; stale completions cannot overwrite a different account. There is no role, login, session-expiry or server authorization change.
3. Admin page search was mounted inside the mobile drawer, so the top-bar search could not open it with the drawer closed. The dialog now stays mounted outside the drawer. Search and sidebar share the same account-scoped favorites, authorized destinations, notification-read callback and full-admin record-search restriction. Opening search from the drawer closes the drawer.

Focused verification passes 11 client-layout lifecycle tests and 33 navigation/catalog/badge tests. TypeScript, application build and SEO/middleware checks pass. Eighteen browser regression groups cover both language-switch directions with delayed acknowledgements and refreshes, student/admin dialogs in Arabic/English at 320/390/1024/1440 px, header/close geometry, localized close labels, keyboard closure, mobile top-bar/drawer search and shared favorites. The full 75-group navigation regression also passed, with zero JavaScript exceptions across all 93 groups.

The language correction adds one existing `auth.me` refresh per successful explicit language change. It does not poll. The actual unchanged `getUserById` SQL was executed against an isolated production-schema fixture; local and read-only production query plans select the users integer primary key without a scan, with at most one account result. Existing context/session checks and ordinary activity handling remain unchanged. The dialog/favorites changes add zero SQL reads. No Worker deployment or migration is required for these frontend corrections.

Remaining findings in pages unchanged by this navigation follow-up:

| Finding | Priority | Reproduction and expected behavior |
| --- | --- | --- |
| Quiz interface remains Arabic in English mode | Medium | Open Quizzes with the shell in English. The static page headings and controls in `QuizLevels.tsx` remain Arabic. Quiz content can retain its authored language, but interface labels should follow the selected locale. |
| Broker completion overstates service access | Medium | An account with completed broker onboarding and expired timed services sees “You now have access to LexAI and Recommendations” in `BrokerOnboarding.tsx`, while both services correctly show expired access. Completion copy should reflect actual service status. |
| English dashboard singular grammar | Low | One completed lesson renders “1 lessons completed” in `StudentDashboardOverview.tsx`. Use the singular form for one. |

These three findings are recorded for a separate copy/localization cleanup; this QA follow-up does not change them. Authenticated admin/support accounts, paid actions, physical phones and Safari remain outside this real-account round. Native screenshots and private account details were not added to tracked source. Operational/synthetic evidence remains ignored under `output/playwright/navigation-v2/signed-in-qa/`.

### Corrective frontend release and live closeout

The verified corrections are committed and pushed as `ce919e5`. Pages production deployment `88a66b00-3dda-4626-bf10-5d648b5f407e` is active on `main`, source `ce919e5`, at `https://88a66b00.xflexwithai.pages.dev`. This follow-up makes no Worker deployment, migration, role change or financial/account adjustment. Frontend rollback target is `90bdc9cb-734c-4e96-99b5-1330769fbafd`; it retains the original V2 functionality but also the three corrected navigation issues.

Post-release checks passed nine exact asset hashes, 16 route checks, API health and anonymous 401 responses for both announcement endpoints. All 18 targeted regression groups also passed against the published assets with simulated account/API responses and zero JavaScript exceptions.

The real signed-in account was then refreshed onto the new release. The Arabic page-search heading and close button are separated, and the localized close control works. English persisted from Documents to Dashboard; Arabic then persisted from Dashboard to Documents and back again. The account's original Arabic preference was restored and Chrome was left on the Arabic dashboard. The deferred announcement stayed hidden through these fresh loads and navigations. No next-login cycle, permanent announcement dismissal, paid action or administrative write was performed during this account round.
