# XFLEX Project Memory

Last updated: 2026-07-03

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
- When writing raw Wrangler SQL against `email_delivery_logs`, use the physical snake_case column names: `recipient_email`, `recipient_user_id`, `event_type`, `template_id`, `error_message`, and `created_at`. Drizzle maps these to camelCase in TypeScript (`recipientEmail`, `eventType`, etc.), but raw D1 SQL with camelCase will fail.
- For production D1 verification where result rows matter, prefer one `SELECT` per Wrangler command. Multi-statement SQL files may return only execution summaries instead of each result set.
- Latest Worker deploy completed on 2026-06-05 with version `6d231d23-f38e-485e-8064-c3177ec840eb`.
- Latest Pages deploy attempt on 2026-06-05 for commit `b347e28` failed during Cloudflare asset upload with `POST /pages/assets/upload -> 502 Bad Gateway`; manual dashboard upload of `dist/public` is the fallback.
- Latest production D1 migration applied on 2026-06-05: `database/migrations/050_first_package_activation_anchor.sql`.
- On 2026-06-21, the user reported completing the Worker/frontend deployment for the timed-service activation and email reliability release. The exact Cloudflare deployment version/commit was not recorded in this session.
- Production D1 migration `database/migrations/055_timed_service_activation_email_outbox.sql` was applied by Codex on 2026-06-21 before deployment.
- Migration `055` Cloudflare bookmark: `00000ebe-0000002c-00005091-24213355c43c1b020dcc1e96230ee7bf`.
- Pre-migration production recovery export:
  `tmp/prod-backups/xflexwithai-before-055-20260621-152725.sql`.
- Migration `055` is additive and must not be rerun manually: it added timed-service activation audit/waiver fields, deadline indexes, `email_outbox`, and `email_outbox_campaigns`.
- Production Worker schedules are now:
  - `* * * * *` for overdue timed-service repair and bounded email-outbox draining.
  - `0 5 * * *` for existing daily lifecycle/retention/reminder work, which is 08:00 Asia/Amman.
- Migration `database/migrations/056_recommendation_delivery_priority.sql` was initially prepared on 2026-06-22 and later applied to production. It additively creates `idx_rec_deliveries_status_kind_created` on `recommendation_deliveries(status, eventKind, createdAt, id)`.
- Production application of migration `056` read 11,941 rows and wrote 5,900 index entries; this was index construction, not modification of 5,900 business records. Cloudflare bookmark: `00000ec4-00001f32-00005092-b8b7c4078f9df3fb50a741d01f919baa`.
- Migration `database/migrations/059_fix_email_delivery_log_timestamp_default.sql` was applied to production on 2026-06-27 after the app produced legacy `email_delivery_logs.created_at = 'CURRENT_TIMESTAMP'` rows. It rebuilt `email_delivery_logs` with `created_at TEXT NOT NULL DEFAULT (datetime('now'))`, preserved 17,862 rows, and recreated `idx_email_delivery_logs_created_at`, `idx_email_delivery_logs_recipient_email`, and `idx_email_delivery_logs_status`. Cloudflare bookmark: `00000ee7-0000020e-00005096-0b9b3e6371d965180da477a114bbedeb`.
- Migration `database/migrations/060_schema_migrations_tracking.sql` was applied to production on 2026-06-27. It created `schema_migrations` plus `idx_schema_migrations_applied_at`; Codex recorded migrations `059` and `060` in that table. Cloudflare bookmark: `00000ee7-00000214-00005096-2faa70207cd77d4f75c5ff001a10e37a`.
- Migration `database/migrations/061_quiz_level_bypass.sql` was applied to production on 2026-07-01 before the user's deployment. It additively added `user_quiz_progress.is_bypassed INTEGER NOT NULL DEFAULT 0` and `user_quiz_progress.bypassed_at TEXT` so students can confirm bypass after a failed level quiz without marking the quiz as passed. Pre-migration export: `tmp/prod-backups/xflexwithai-before-level-quizzes-20260701-131159.sql` (about 124 MB). Production verification confirmed `user_quiz_progress` row count stayed at 161 before/after the migration. On 2026-07-01 Codex recorded `061_quiz_level_bypass.sql` in `schema_migrations` with `source = codex_wrangler`.
- The user completed the deployment for the level-quiz release on 2026-07-01. Post-deployment QA confirmed production API health, frontend route health, desktop/mobile browser smoke, live tRPC smoke, D1 schema/data sanity, TypeScript, focused quiz tests, full test suite, frontend build, and Worker build.
- Release order for the 2026-06-22 hotfixes:
  1. Apply migration `056`.
  2. Deploy the production Worker/backend.
  3. Deploy the Cloudflare Pages frontend.
  4. Run recommendation, support-email, and multi-tab staff-session smoke tests.
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
- Recommendation publishing no longer sends recipient emails synchronously. Publishing creates `recommendation_deliveries` rows, and the minute Worker drains them in bounded batches.
- Generic activation and admin-announcement emails use `email_outbox`; large admin sends first create one `email_outbox_campaigns` envelope and materialize recipient rows gradually.
- Email outbox delivery is idempotent through dedupe keys, conditional claims, stale-lock recovery, bounded retries, provider/error auditing, and dead-letter status.
- Admin notification send responses now distinguish in-app recipients (`count`) from queued emails (`emailsQueued`).
- Normal queued-email delivery target is within approximately one minute, subject to provider availability and backlog.
- On 2026-06-22, production recommendation-email complaints were traced to queue starvation rather than provider failure. In-app notifications were immediate and ZeptoMail sends succeeded, but generic email work consumed half of the shared 10-email minute budget and recommendation rows drained at only 5 recipients/minute.
- Recommendation delivery now has priority over generic/bulk outbox work. Publishing also starts a bounded post-response Worker drain through `ExecutionContext.waitUntil`, with the minute cron remaining as the durable fallback.
- The next email reliability release groups recommendation recipients by event and language and sends one ZeptoMail request with the company mailbox in `To` and up to 50 clients in `BCC`. The ceiling is intentionally conservative versus ZeptoMail's 500 total-recipient limit.
- BCC recommendation batches never combine different events, languages, subjects, or rendered bodies. Client addresses are never placed in `To` or `CC`.
- Individual `recommendation_deliveries` and `email_delivery_logs` rows remain the client-level audit trail. Provider acceptance is correlated using `providerBatchKey` and ZeptoMail `providerRequestId`.
- Recommendation capacity is budgeted by provider requests rather than recipient rows. A frequent run may process up to four recommendation BCC batches while reserving at least six of the shared ten provider-request slots for support and other transactional emails.
- The company `To` copy replaces separately queued recommendation admin copies, preventing duplicate admin traffic and generic-outbox starvation.
- Migration `database/migrations/057_recommendation_bcc_batches.sql` is additive, has not been applied to production, and adds only `providerRequestId`, `providerBatchKey`, and `idx_rec_deliveries_provider_batch`.
- Before claiming recommendation rows, queued deliveries are reconciled:
  - Expired/cancelled alerts are skipped, and a published top-level recommendation supersedes any remaining pre-alert emails from its alert window.
  - Closed or resulted recommendations and stale updates are skipped.
  - Results are skipped if that recipient has no viable root-recommendation delivery.
- Recommendation claim ordering is newest actionable recommendation first, then alerts, updates, and results. Do not restore simple FIFO ordering for time-sensitive trading messages.
- Human support replies now always enqueue a transactional client email, regardless of whether the client is online. This applies to replies in existing conversations and staff-initiated conversations.
- Support reply emails use `eventType = support_client_reply`, `templateId = support_client_reply`, and dedupe key `support_reply:<supportMessageId>`.
- `support_client_reply` rows are prioritized ahead of bulk announcements inside the generic email outbox. Bot replies, polling, edits, and deletes do not generate support reply emails.
- As of 2026-06-25/26 email reliability fixes, the minute Worker drains a reserved `support_client_reply` lane before generic campaign work. Admin Email Logs exposes Outbox Health and a manual "Drain due now" action. Expected support reply delay should stay near the digest window rather than drifting to 30+ minutes.
- Staff alert emails must be deduped by normalized recipient email across configured notification emails and staff-role recipients. This prevents one person receiving duplicate operational alerts when they are both configured in `admin_settings.notification_emails_json` and present as a staff user.
- Timed-service activation repair alerts must not expose raw SQL in the visible email body. Use admin-friendly content; keep raw errors only in metadata/logs.
- Daily timed-service expiry staff alerts are digested: the `0 5 * * *` Worker still sends client renewal reminders individually, but staff/admin receive one `subscription_expiring` digest per daily run. The digest groups one client/package/end-date row with services such as `LexAI + Recommendations`, renders as a table in email, and keeps dashboard notification text plain. The event uses the existing staff BCC batch path with `support@xflexacademy.com` in `To`, avoiding one ZeptoMail provider request per expiring subscription or per staff recipient.
- Passwordless `auth.requestLoginCode` intentionally no-ops for users whose `loginSecurityMode` is `password_plus_otp`. Those users must submit email/password through `auth.login`; after a valid password, the app creates a `login_stepup` OTP and sends the email code. When investigating "no token received" reports, check `users.loginSecurityMode` first, then `email_delivery_logs` for `event_type = 'login_code'`, and remember `authEmailOtps` only retains active/non-expired OTP rows.

## Known Fixed Bugs / Lessons Learned

- Episode prerequisite skip for no-quiz episodes was fixed.
- The old episode-quiz mapping treated `episode.order - 1` as the quiz level, which caused quiz questions to appear unrelated to episode content. The course now uses eight level checkpoints instead of per-episode quiz checks.
- Course episode progression is supportive, not punitive: watch progress should help unlock lessons, but missing playback tracking should not strand students.
- Episode watch completion threshold is intentionally soft: 10% of episode duration with a 30-second minimum. Do not restore the old 70%/60-second hard gate.
- If a student tries to open the next episode and the previous episode is incomplete only because watch progress was not captured, the app should ask for confirmation, then mark the previous episode complete and open the next episode.
- Student confirmation may repair missing watch tracking only; it must not bypass a real configured quiz that the student has not passed.
- Level quiz bypass is now explicit and student-confirmed only after a failed/attempted level quiz at the level checkpoint. It records `is_bypassed` and `bypassed_at`, unlocks the next level, and does not set `is_completed`/passed.
- Missing, empty, or malformed episode quizzes must be treated as not required (`required: false`, `passed: true`) and must never block the next episode.
- Course progress capture should save on time updates plus pause, ended, tab hide, and episode switch; backend progress writes must remain monotonic so watched seconds never decrease and completed episodes stay completed.
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
- A pending timed-service state must take precedence over its placeholder `endDate`; a short key must not appear expired while still inside the protection window.
- Timed-service access, recommendation email eligibility, and deadline consumption must change together. A client must never consume deadline-anchored service time while remaining blocked from the service or its recommendation emails.
- Staff inactivity remains 15 minutes and must be extended only by real user interaction, never by support polling or other background requests.
- The frontend idle guard now synchronizes genuine activity across tabs using a per-user local-storage timestamp. An inactive tab must not log out a staff member who is actively typing in another tab.
- Real activity detection includes direct `input`, `beforeinput`, Arabic/IME composition, keyboard, pointer/mouse, touch, click, and scroll events. Cross-tab activity resets local timers but does not emit duplicate server heartbeats.

## Course Level Quiz Journey

- Arabic-first UX is the priority for course and quiz flows; desktop and mobile must both be checked before release.
- The student watches multiple episodes to complete each course level, then sees the level quiz only at the final episode of that level.
- Current course level checkpoints map episode orders as:
  - Level 1: episodes 1-14.
  - Level 2: episodes 15-17.
  - Level 3: episodes 18-20.
  - Level 4: episodes 21-25.
  - Level 5: episodes 26-36.
  - Level 6: episode 37.
  - Level 7: episode 38.
  - Level 8: episode 39.
- Quiz enforcement applies only at a level checkpoint. Intermediate episodes should not show or require a quiz just because a quiz with the same numeric index exists.
- A student who fails a level quiz should be advised in Arabic to rewatch/review the level and retry the exam.
- If the student confirms that they understand and still want to continue, the app may bypass that level quiz, unlock the next level, and keep an audit trail through `quiz_level_bypass` engagement plus `user_quiz_progress.is_bypassed`.
- Passing a later attempt clears any previous bypass state for that quiz level.
- Support/team review should validate that each of the eight level quizzes covers the content in its level range, not only a single episode.
- Key expiry and timed-service activation rules are intentionally unchanged by the quiz-level release. LexAI/recommendations activation still follows the existing stable implementation: service time starts after course and broker readiness or after the configurable protection deadline, whichever comes first.

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
- Pending timed-service rows keep `maxActivationDate` as the separate protection deadline; placeholder `endDate` stores only the key/service age from the activation anchor, so the protection window is not added to service life.
- Timed services activate at the earliest of:
  - Both readiness gates becoming ready.
  - The exact `maxActivationDate` protection deadline.
- If processing happens after the protection deadline, the effective `startDate` remains the exact deadline and `endDate` is deadline plus the key manager’s selected entitlement days.
- Protection-expiry activation records `activationReason = protection_expired`, `activationProcessedAt`, and separate `courseWaivedByPolicy` / `brokerWaivedByPolicy` flags.
- Policy waiver does not modify actual course progress, `completedAt`, `isAdminSkipped`, broker onboarding rows, or `brokerOnboardingComplete`.
- Other activation reasons are `requirements_completed`, `manual`, `renewal`, and `legacy`.
- Timed-service activation updates are conditional on `isPendingActivation = true`, so concurrent page access, recommendation publishing, and cron repair cannot double-activate a row.
- Recommendation audience calculation repairs overdue pending states before selecting recipients.
- Client LexAI and Recommendations pages display policy activation, actual course/broker readiness, effective start, and expiry.
- Activation creates an in-app notice and queues a transactional activation email.
- Previously affected clients are reviewed for compensation case by case; no automatic historical extension or recommendation replay is performed.
- Admin API `subscriptions.activationAudit` reports overdue/policy-activated clients and inaccessible intervals for review.
- Timed-service cron repair now performs a schema-health preflight before querying readiness columns such as `enrollments.isAdminSkipped`, `lexaiSubscriptions.maxActivationDate`, and activation audit fields. If schema is missing, repair is skipped and a controlled schema-mismatch staff alert is sent instead of raw SQL failure content.

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
- Release verification on 2026-06-21:
  - `pnpm check` passed.
  - Full `pnpm test` passed: 24 files, 105 tests.
  - Targeted activation/course/broker/renewal/LexAI tests passed: 41/41.
  - Targeted recommendation/email/notification tests passed: 25/25.
  - `pnpm build` and `pnpm build:worker` passed.
  - Migration `055` applied successfully to a fresh isolated local D1 fixture.
  - Production schema preflight found no migration-name collisions.
  - Post-migration production verification confirmed all 8 activation fields, 2 outbox tables, and 5 indexes.
  - Subscription totals and Ayah/Walaa records were unchanged by the migration.
  - Production outbox tables were empty immediately after migration.
  - No overdue pending recommendation users existed immediately before deployment.
- Release-candidate verification on 2026-06-22 covers three hotfixes:
  - Recommendation queue prioritization, immediate bounded drain, and stale-delivery suppression.
  - Multi-tab/IME-safe staff activity tracking while preserving the 15-minute policy.
  - Always-on transactional email for human support replies.
  - Full test suite result before final QA: 27 files, 114 tests passed.
  - `pnpm check`, `pnpm build`, and `pnpm build:worker` passed.
  - Final QA rerun after the pre-alert sequencing safeguard again passed all 27 files / 114 tests.
  - Migration `056` applied successfully twice to an isolated local D1 database; the query plan used `idx_rec_deliveries_status_kind_created`.
  - Isolated D1 behavior checks confirmed a pre-alert is valid before publication and stale after its recommendation is published, and `support_client_reply` outranks an older `admin_bulk_notification`.
  - The earlier read-only production preflight confirmed migration `056` was not yet present at that moment; it was subsequently applied successfully as recorded above.
- BCC recommendation release verification on 2026-06-22:
  - Full test suite passed: 28 files, 117 tests.
  - `pnpm exec tsc --noEmit`, `pnpm run build`, and `pnpm run build:worker` passed.
  - Focused BCC, queue, and recommendation workflow tests passed: 19/19.
  - Tests verify BCC privacy, the 50-recipient ceiling, one provider request for a grouped batch, whole-batch retry, and rejection of non-identical content.
  - Migration `057` executed successfully against an isolated in-memory SQLite schema.
  - No production migration, push, or deployment was performed by Codex for this release.
- Email/timed-service hardening verification on 2026-06-27:
  - `pnpm exec tsc --noEmit` passed.
  - Focused tests passed: `server/timedServiceActivation.test.ts`, `server/supportChatNotifications.test.ts`, and `server/emailOutboxService.test.ts` (20 tests).
  - Full `pnpm test` passed: 29 files, 120 tests.
  - `pnpm run build:worker` passed and produced `dist/worker.js`.
  - `pnpm run build` passed; Vite emitted only the existing large-chunk warning.
  - Migration `060_schema_migrations_tracking.sql` smoke-tested successfully against in-memory SQLite.
  - Production D1 post-migration verification confirmed `email_delivery_logs` has runtime `datetime('now')` default, 17,862 rows were preserved, `schema_migrations` contains `059` and `060`, and no new `timed_service_activation_failure` notifications appeared after the fix/migration point.
- Level-quiz release verification on 2026-07-01:
  - `pnpm exec tsc --noEmit` passed.
  - Focused quiz regression tests passed: `server/markEpisodeComplete.test.ts`, `server/userQuizProgress.test.ts`, and `server/userQuizSubmitAccess.test.ts` (17 tests).
  - Full `pnpm test` passed: 29 files, 124 tests.
  - `pnpm run build` passed; Vite emitted only the existing large-chunk warning.
  - `pnpm run build:worker` passed.
  - Production backup completed before migration: `tmp/prod-backups/xflexwithai-before-level-quizzes-20260701-131159.sql`.
  - Migration `061_quiz_level_bypass.sql` applied successfully and was later recorded in `schema_migrations`.
  - Production D1 verification confirmed the bypass columns exist, `user_quiz_progress` has 161 rows, `bypassed_rows = 0`, `bypass_missing_timestamp = 0`, and `quizzes` has exactly 8 levels from 1 to 8.
  - Live tRPC smoke verified public reads and expected login-required behavior for protected quiz endpoints.
  - Headless browser smoke passed on desktop and mobile for `/ar`, `/en`, `/auth`, `/quiz`, and `/course/1`; no console errors, page crashes, or failed requests were observed.
- Subscription-expiry staff digest release verification on 2026-07-02:
  - `pnpm exec tsc --noEmit` passed.
  - Focused digest test passed: `pnpm vitest run server/subscriptionExpiryDigest.test.ts` (2 tests).
  - Production D1 read-only login-token investigation confirmed `email_delivery_logs` remains the delivery source of truth; `authEmailOtps` may be empty after cleanup/expiry.

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
