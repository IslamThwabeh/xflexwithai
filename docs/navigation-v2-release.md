# Navigation V2 and workspace announcement

Status: implemented locally; production is pending the separate migration approval below. Source and verification closeout are recorded below. Not deployed.

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

The browser harness uses synthetic responses on normal application routes and creates no production account data. This establishes navigation reachability and announcement UI behavior; it does not prove every feature's full production workflow. Existing nested main landmarks were observed in the dashboard layouts and remain an accessibility follow-up outside this navigation release.

## Release gate and recovery

Project memory requires separate explicit approval for a production D1 migration. Finish local/browser verification and present migration 135 for that approval before applying it. Source push authorization already exists in this conversation.

After approval: verify Cloudflare authentication, capture a fresh Time Travel bookmark and deployment baselines, reconcile live schema/ledger metadata, apply only migration 135 and record it once in `schema_migrations`. Verify live table columns/PK and exact status-query plan, then deploy Worker before Pages. Preserve live variables, four schedules and all storage bindings. Verify production routes, anonymous denials and exact asset hashes.

Routine rollback restores the prior frontend and Worker. The additive receipt table may remain; do not restore the whole database or erase choices as a routine code rollback. Emergency Time Travel recovery requires a separately reviewed incident plan because it affects unrelated concurrent business activity.

No package, order, payment, accounting balance, customer message or role assignment is created by QA. Live authenticated student/admin/support workflows and physical-device/Safari verification must be reported separately from synthetic Chrome coverage.
