# XFLEX Project Memory

Last updated: 2026-06-06

## Project Overview

- Local project path: `C:\Users\islamt\website-xflexwithai`.
- GitHub repo: `https://github.com/IslamThwabeh/xflexwithai`.
- Production website: `https://xflexacademy.com`.
- Stack: Cloudflare Pages + Cloudflare Worker + R2 + D1 SQLite.
- Frontend: React + Vite under `frontend`, with build output in `dist/public`.
- Backend Worker entry: `backend/_core/worker.ts`, bundled to `dist/worker.js`.
- Local/server backend entry for non-Worker build: `backend/_core/index.ts`.
- Main router: `backend/routers.ts`.
- Database wrapper/helpers: `backend/db.ts`.
- SQLite schema source: `database/schema-sqlite.ts`.
- Key tables to remember: `admin_settings`, `supportMessages`, `userRoles`, `users`, `email_delivery_logs`, `recommendationSubscriptions`, `lexaiSubscriptions`, `registrationKeys`, `packageSubscriptions`.

## Deployment

- Production frontend is Cloudflare Pages project `xflexacademy`.
- Manual Pages upload artifact is `dist/public`.
- Full build command: `npm run build` or `pnpm run build`.
- Full deploy sequence when Wrangler Pages works: `npm run build && npm run deploy:pages && npm run deploy:worker`.
- Pages deploy script: `pnpm run deploy:pages`.
- Production Worker deploy script is `pnpm run deploy:worker`.
- Worker deploy command expands to `wrangler deploy dist/worker.js --config wrangler-worker.toml --env production`.
- D1 database binding: `xflexwithai-db`.
- Remote production D1 query pattern:
  `npx wrangler d1 execute xflexwithai-db --remote --config wrangler-worker.toml --env production --command "SELECT ..."`
- During investigations, Codex may inspect the production D1 database directly with Wrangler read-only `SELECT` queries to collect evidence. Any production write, repair, migration, or data change needs separate explicit user approval.
- Latest Worker deploy completed on 2026-06-05 with version `6d231d23-f38e-485e-8064-c3177ec840eb`.
- Latest Pages deploy attempt on 2026-06-05 for commit `b347e28` failed during Cloudflare asset upload with `POST /pages/assets/upload -> 502 Bad Gateway`; manual dashboard upload of `dist/public` is the fallback.
- Latest production D1 migration applied on 2026-06-05: `database/migrations/050_first_package_activation_anchor.sql`.
- Wrangler Pages deploy can fail because Cloudflare returns `POST /pages/assets/upload -> 502 Bad Gateway`; if it recurs, manual dashboard upload of `dist/public` is a practical fallback.

## Email And Notifications

- Central email sender is `backend/_core/email.ts`, function `sendEmail`.
- Outbound automated emails are logged to `email_delivery_logs` with status, errors, and metadata.
- Logged email flows include staff alerts, welcome/milestone emails, recommendation alerts, trade results, and admin bulk notifications.
- Admin dashboard for email logs is in Admin Notifications -> `Email Delivery Logs` tab.
- Email logs support grouped and detailed views, category filters, date presets, and offset paging; grouped rows intentionally combine the same email batch sent to multiple recipients.
- Recommendation email inactivity filter was removed: recommendation alerts, updates, and trade results are sent regardless of recent `lastInteractiveAt`.
- Recommendation email event types include `recommendation_alert`, `recommendation_update`, and `trade_result`.
- Admin bulk email audit logs each recipient individually as `admin_bulk_notification`.
- Recommendation delivery outbox rows store subject/body snapshots for alert, update, and result emails so audit rows remain inspectable later.

## Known Fixed Bugs / Lessons Learned

- Episode prerequisite skip for no-quiz episodes was fixed.
- Admin chat list loads newest first.
- `admin_settings` insert should use `INSERT OR REPLACE` behavior where appropriate.
- Support email trigger is inside `createSupportMessage` when `senderType = 'client'`.
- Client support chat message text selection/copy was fixed.
- Email delivery logging is the audit trail for outbound emails and should be preserved when adding email flows.
- For support/chat changes, check both client and admin surfaces; they often implement similar behavior separately.
- For bug report evidence, existing storage column is still `imageUrl`; avoid schema churn unless there is a strong reason.
- Wrangler Pages deploy can fail from Cloudflare upload 502 even when the app build is valid; manual dashboard upload of `dist/public` is a practical fallback.
- Package keys dashboard now shows student name and service expiry; backend enrichment must use explicit joins for users instead of Drizzle correlated subqueries, which previously repeated the same name across rows.
- Renewal keys must not receive fresh-student 14-day protection when they are renewing existing active/expired timed services; they start now or stack from current active expiry.
- Case-by-case production repairs are preferred for subscription/key issues; do not bulk repair affected users without explicit approval and an audit trail.
- Recommendation publish timing: the one-minute client notification wait applies only to new top-level recommendations. Older open recommendation updates/results are allowed immediately and are silent unless posted inside an active publish window.
- Admin recommendation workspace fetches all open root recommendations through `recommendations.openThreads`, so old open trades stay visible outside the recent-feed pagination cap.
- Admin recommendation workspace counters should be sourced from a backend thread summary, not from whatever rows are loaded in the current view.
- Admin recommendation archive/history should use dedicated thread-history queries with D1-safe chunked hydration; do not use the recent `recommendations.feed` query as the archive source.
- Recommendation monthly reports should score official results from `result` replies posted in the selected month. `update` replies are management context and should be excluded from win rate/pips unless explicitly reviewed/converted.

## Package Key Lifecycle Rules

- Packages are lifetime course access plus timed services:
  - Basic: course forever + Recommendations for the key/service age.
  - Comprehensive: course forever + Recommendations and LexAI for the key/service age.
- Readiness for timed services is exactly:
  `(course completed OR course admin-skipped) AND (broker completed OR broker admin-skipped)`.
- Admin/support skip means that gate is considered ready. If both gates are ready, pending timed services should start immediately.
- Fresh key + fresh student: course access starts immediately; timed services stay pending until readiness or the configurable study/protection deadline.
- Fresh key + existing/old student must be blocked before consuming the key, and support/key managers/admins must be notified by in-app staff notification and email.
- Existing/old student means any active/expired package subscription, any LexAI/Recommendations subscription history, or any previously activated package key.
- Renewal key + existing active student: stack from current service expiry.
- Renewal key + expired student: start from now.
- Renewal key + new/migrated student: allow activation, but timed services remain pending until readiness/admin skip or the configurable protection deadline.
- Basic active -> Comprehensive renewal/upgrade is allowed:
  - LexAI gets only the new Comprehensive key age.
  - Recommendations gets the new Comprehensive key age plus any remaining Basic Recommendation days.
- Comprehensive active -> Basic renewal is blocked until the Comprehensive LexAI service period is no longer active/pending.
- The protection window is configurable via `study_period_days`; do not hardcode 14 days in lifecycle code.
- `users.firstPackageActivatedAt` stores/derives the original package activation anchor so upgrades do not reset the protection window.
- Pending timed-service rows use `maxActivationDate` plus placeholder `endDate`; activation derives the actual service days from that pair so LexAI and Recommendations can have different durations.

## Support Media Uploads

- Commit `80b948e` added short video upload support to client support chat, admin support chat, and bug reports.
- Shared frontend media helpers live in `frontend/src/lib/supportMedia.ts`.
- Client support chat is `frontend/src/pages/SupportChat.tsx`.
- Admin/support chat is `frontend/src/pages/AdminSupport.tsx`.
- Client bug report panel for `/support?tab=bugs` is `frontend/src/components/SupportBugReportsPanel.tsx`.
- Admin bug report review is `frontend/src/pages/AdminBugReports.tsx`.
- Backend support upload and bug report upload validation live in `backend/routers.ts`.
- Support message DB schema comments are in `database/schema-sqlite.ts`; no migration was needed because `attachmentType` and `attachmentDuration` already existed.

## Current Media Rules

- Images: max 5 MB.
- Generic chat files: max 5 MB.
- Voice notes: max 2 MB.
- Videos: max 100 MB and must be shorter than 60 seconds.
- New support chat videos are stored under R2 prefix `support/videos/`.
- New bug report videos are stored under R2 prefix `bug-reports/videos/`.
- Frontend checks video duration before upload via browser metadata.
- Backend requires video duration metadata and rejects duration `>= 60` seconds for support chat and bug report evidence uploads.
- Bug reports still store evidence in the existing `imageUrl` column for compatibility, but UI copy now says screenshot/video/evidence.

## Verification Run

- `pnpm run check` passed.
- `pnpm test` passed on 2026-06-05: 21 test files, 78 tests.
- `pnpm run build` passed.
- `pnpm run build:worker` passed.
- Focused lifecycle tests passed: `server/packageKeyLifecycle.test.ts`, `server/timedServiceActivation.test.ts`, `server/packageKeyRenewalEligibility.test.ts`, `server/markEpisodeComplete.test.ts`, and `server/brokerFreezeAndSkipRoutes.test.ts`.
- Browser smoke could not be completed in Codex because the in-app browser backend reported `iab` unavailable.

## Future Hardening

- Do not rely only on browser duration checks; for stronger abuse prevention, add server-side video probing or a quarantine process before long-term R2 retention.
- Consider signed/private access for support evidence URLs if evidence may contain sensitive client data.
- Add R2 lifecycle cleanup for rejected bug reports, deleted support messages, and abandoned uploads.
- Manual QA before release should cover client/admin chat image upload, short video upload, 60s+ rejection, oversized rejection, existing voice notes, `/support?tab=bugs` evidence submit, and admin bug evidence playback on mobile and desktop.

## User Working Style

- User is non-developer and prefers low-token, practical instructions.
- When user reports a bug, first ask them for targeted PowerShell search output, usually with `Select-String` or concise `rg` alternatives.
- For production-only symptoms, inspect production D1 read-only with Wrangler when useful before guessing from code.
- Then provide a short prompt they can paste into VS Code AI/Copilot/Cursor.
- Keep those prompts focused on file paths, line numbers, and exact code changes; avoid long explanations.
- Preferred verification/deploy loop after fixes: build, deploy Pages, deploy Worker, then smoke test.
