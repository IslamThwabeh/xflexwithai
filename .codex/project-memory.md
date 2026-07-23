# XFLEX Project Memory

Last updated: 2026-07-24

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
- When the user asks Codex to deploy "from your end", use the `cloudflare-deploy` skill, check `npx wrangler whoami`, commit and push first, then deploy Worker before Pages:
  1. `git add .`
  2. `git commit -m "<meaningful release summary>"`
  3. `git push origin main`
  4. `npm run build && npm run deploy:worker && npm run deploy:pages`
- If the release includes a database migration or schema read by new Worker code, get explicit user approval and apply the production D1 migration before `npm run deploy:worker`.
- Pages deploy script: `pnpm run deploy:pages`.
- Production Worker deploy script is `pnpm run deploy:worker`.
- Worker deploy command expands to `wrangler deploy dist/worker.js --config wrangler-worker.toml --env production`.
- D1 database binding: `xflexwithai-db`.
- Remote production D1 query pattern:
  `npx wrangler d1 execute xflexwithai-db --remote --config wrangler-worker.toml --env production --command "SELECT ..."`
- During investigations, Codex may inspect the production D1 database directly with Wrangler read-only `SELECT` queries to collect evidence. Any production write, repair, migration, or data change needs separate explicit user approval.
- When writing raw Wrangler SQL against `email_delivery_logs`, use the physical snake_case column names: `recipient_email`, `recipient_user_id`, `event_type`, `template_id`, `error_message`, and `created_at`. Drizzle maps these to camelCase in TypeScript (`recipientEmail`, `eventType`, etc.), but raw D1 SQL with camelCase will fail.
- For production D1 verification where result rows matter, prefer one `SELECT` per Wrangler command. Multi-statement SQL files may return only execution summaries instead of each result set.
- Latest production Worker deploy completed on 2026-07-18 with version `55910eb1-9a91-47cd-9915-bf7ab9bcc88d` for release commit `04f3468` (`Add audited package key configuration`).
- Latest successful Pages deployment was on 2026-07-18 for release commit `04f3468`, with preview `https://30fbf774.xflexwithai.pages.dev`. A historical 2026-06-05 upload failed with `POST /pages/assets/upload -> 502 Bad Gateway`; if that Cloudflare error recurs, manual dashboard upload of `dist/public` remains the fallback.
- Latest production D1 migration applied as of 2026-07-19 is `database/migrations/072_package_key_configuration_audit.sql`.
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
- Migration `database/migrations/062_admin_broker_report_and_password_rotation.sql` was applied to production by Codex on 2026-07-07 before deployment. It additively added `admins.passwordChangedAt` and broker-onboarding report/paging indexes. Cloudflare bookmark: `00000f2d-00000d69-000050a1-069bf24bd2e178e23edc53091684086c`. Post-migration verification confirmed the `admins.passwordChangedAt` column exists.
- Admin broker report and admin password renewal release was committed as `a9b3196 Add admin broker report and password renewal`, pushed to `origin/main`, then deployed by Codex on 2026-07-07 using `npm run build && npm run deploy:worker && npm run deploy:pages`. Worker version: `9f08afc8-e98f-4117-8533-9033d1c6b461`. Pages preview: `https://9991b4d4.xflexwithai.pages.dev`.
- Phased staff/student engagement release was committed as `da85992 Add phased staff and student engagement features`, pushed to `origin/main`, and deployed by Codex on 2026-07-12. Production backup before migrations: `tmp/prod-backups/xflexwithai-before-phases-063-068-20260712-215252.sql`. Worker version: `5925eb99-6ffe-4047-9f07-47edc49a9695`. Pages preview: `https://cb37d852.xflexwithai.pages.dev`.
- Production D1 migrations `063_staff_performance_foundation.sql`, `064_student_surveys_foundation.sql`, `065_student_survey_blocking_flag.sql`, `066_loyalty_rewards_foundation.sql`, `067_student_community_foundation.sql`, and `068_student_job_eligibility_foundation.sql` were applied and recorded in `schema_migrations` on 2026-07-12 with `source = codex_wrangler`.
- Post-deployment verification on 2026-07-12 confirmed production URLs `/`, `/ar`, `/en`, and `/auth` returned 200; Worker health returned `status=ok`; new feature flags remained `false`; and subscription/enrollment counts were unchanged: `packageSubscriptions` 59/59 active, `lexaiSubscriptions` 22/21 active/1 pending activation, `recommendationSubscriptions` 60/50 active/4 pending activation, `enrollments` 64/64 active.
- Engagement workflow integrity/task-alert release was committed as `1bf0fdc Fix engagement workflows and task alerts`, pushed to `origin/main`, and deployed by Codex on 2026-07-13. Worker version: `bfdc4726-42da-4629-bfea-1afc4c04a3d4`. Pages preview: `https://9cec8f57.xflexwithai.pages.dev`.
- Fixed package-key ILS pricing/reporting release was committed as `0f96227 Fix package key ILS pricing reports`, pushed to `origin/main`, and deployed by Codex on 2026-07-15. Worker version: `40793937-b7b2-4998-aa31-7d1696dffe0c`. Pages preview: `https://307c336d.xflexwithai.pages.dev`. No database migration was required.
- Production D1 migration `069_loyalty_redemption_integrity.sql` was applied before the Worker deployment and recorded in `schema_migrations` with `source = codex_wrangler`. It adds atomic request validation/reservation and rejection-refund triggers. Cloudflare bookmark: `00000f4d-000010c6-000050a7-16d9dbf16e2d7e62ba970e9400340a04`. Production had zero reward redemptions before and after migration.
- Post-deployment verification on 2026-07-13 confirmed Worker health returned `status=ok`; production `/ar`, `/en`, and `/auth` returned 200; `/` followed its expected redirect to 200; and the Pages preview followed its redirect to 200.
- Account-level terms acceptance gate release (`420393f Require account-level terms acceptance`) was deployed by Codex on 2026-07-17. Production backup before migrations: `tmp/prod-backups/xflexwithai-before-terms-gate-20260717-004203.sql`. D1 migrations `070_order_linked_package_activation.sql` and `071_account_terms_acceptance_gate.sql` were applied and recorded in `schema_migrations` with `source = codex_wrangler`. Migration bookmarks: `00000f6f-00000622-000050aa-a309998c36b954c80ca06765d4ad75d0` for 070 and `00000f6f-00000628-000050aa-855716e6d3b3fe2d4b5936209c72d2c8` for 071.
- The 2026-07-17 terms-gate deployment used Worker version `e74f5bfb-62ba-4407-9e87-32c9b161830a` and Pages preview `https://2a8d39b6.xflexwithai.pages.dev`. The frontend asset `index-fkqK7Dw1.js` was confirmed live on production and preview before enabling `admin_settings.terms_acceptance_gate_enabled = true`. Final smoke confirmed `/`, `/ar`, `/en`, `/auth`, and preview returned 200; Worker health returned `status=ok`; anonymous `auth.termsStatus` correctly returned 401; the package-key database guard existed; and the preserved evidence count remained 13 rows for 12 clients.
- Read-only production terms audit on 2026-07-16 found 62 active package clients: 12 had acceptance evidence on an order (8 v2 and 4 v1), while 50 had no recorded evidence. Existing v1/v2 evidence must be preserved; do not fabricate acceptance for the 50 missing clients.
- Current production client-case baseline from the read-only audit on 2026-07-19:
  - Alaa Al Deek (`users.id = 73`, Basic order `20`) accepted terms v2 and uploaded payment evidence. Under the former order-completion behavior, the package and course enrollment started at `2026-07-12T09:42:26Z`. The Recommendations row remained pending with `maxActivationDate = 2026-07-26T09:42:26Z`; its earlier 26/27-day display was the UI reading the placeholder `endDate` while pending, not proof that timed-service days were being consumed. Production now shows the course completed on 2026-07-14, while broker onboarding remains incomplete. Unless broker readiness completes first, policy activation occurs at the exact July 26 deadline and grants the full configured service duration from that deadline.
  - Obada Brahmeh (`users.id = 96`, Basic order `23`) accepted terms v2 and uploaded payment evidence. His package/enrollment was granted by the former order-approval flow on `2026-07-15T11:39:02Z`, which is why he could begin the course without entering a key. This was historical workflow behavior, not unauthorised anonymous access. The current order-linked flow no longer grants access on approval; it issues an email-bound key that must be redeemed. Obada already has an active package, so attempting an unused fresh Basic key is correctly blocked by the existing-client/fresh-key guard. As of the audit he had 38% course progress, incomplete broker onboarding, and a pending Recommendations deadline of `2026-07-29T11:39:02Z`.
  - Jihad Nassar (`users.id = 98`) had no order row and no payment-proof record. Basic key `registrationKeys.id = 118` was manually created by main admin `1` at `2026-07-16T15:11:12Z` (18:11 Amman) and redeemed at `15:15:50Z`, so no order-approval email could exist. He later accepted terms v2 through the account login gate on `2026-07-17T05:24:53Z`. His package is active; Recommendations remains pending until readiness or `2026-07-30T15:15:50Z`. The new order/payment/terms/key safeguards prevent this fresh-sale path from recurring.
  - These named cases are historical evidence, not instructions to modify their records. Do not bulk-repair or revoke them. Re-query production and obtain explicit approval before any client-specific write or compensation.
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
- Generic activation emails use `email_outbox`. Before the local 2026-07-12 admin-email fix, admin announcements also used `email_outbox_campaigns` and materialized recipient rows gradually, which could stretch all-client announcements over hours.
- Released 2026-07-13 admin-email latency fix: admin notification emails now send immediately. If there is one client recipient, the client is placed in `To`. If there are multiple client recipients, `support@xflexacademy.com` is placed in `To` and clients are hidden in `BCC`; per-client `email_delivery_logs` audit rows and `user_notifications.email_sent` updates are still preserved. Suppression checks are bulk-loaded, and audit persistence failure after provider acceptance does not falsely report delivery failure. This email change has no migration.
- Production read-only diagnosis on 2026-07-12 found an 84-recipient admin bulk campaign from 2026-07-09 was created at `19:42:23Z` and completed at `23:05:26Z`, confirming the delay came from gradual campaign materialization/draining rather than ZeptoMail provider acceptance.
- Email outbox delivery is idempotent through dedupe keys, conditional claims, stale-lock recovery, bounded retries, provider/error auditing, and dead-letter status.
- Admin notification send responses now distinguish in-app recipients (`count`) from queued emails (`emailsQueued`).
- Normal queued-email delivery target is within approximately one minute, subject to provider availability and backlog.
- Student-community notifications are email-first because in-app notifications are not routinely monitored. Staff events for new posts, new comments, reports, ordinary blocked submissions, high-risk violations, repeat violations, and moderation-service failures create staff notifications and private BCC email delivery to admins and users holding `student_community_moderator`.
- Community staff email events use bounded throttles for noisy cases: comments per post 5 minutes, ordinary blocked submissions per user 5 minutes, repeat violations 60 minutes, and moderation failures 60 minutes. New posts, reports, and high-risk violations remain immediate.
- Rejected community text must never be copied into staff/client notification emails. Staff safety emails contain only safe classification metadata, entity/user identifiers, counts, and an admin deep link.
- Community client email events use the durable `email_outbox` with transactional category and idempotent dedupe keys. They cover: another student replying to a post, content hidden/deleted/restored, access suspended/restored, and report outcome. A matching in-app notification remains as a fallback. Self-replies do not email the post owner.
- Client moderation emails omit internal moderator notes and reviewed text. Suspension emails may include the explicit admin-entered client-facing reason and expiry. Community/report email links use `/community?postId=<id>` where available; the student community page honors this deep link.
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
- Staff package-key and revenue calculations use the fixed ILS commercial prices: Basic ₪700, Comprehensive ₪1,700, Basic renewal ₪175, Comprehensive renewal ₪350, and Basic→Comprehensive upgrade ₪1,000. Historic standard USD key rows are normalized to these exact ILS amounts in staff-facing reports.
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

## Orders, Terms, And Key Issuance

- A new package sale must originate from an order. Bank-transfer orders cannot be approved without a trusted uploaded payment-proof URL and recorded terms acceptance.
- Completing an order does not grant package/course/service access. It creates an order-linked, email-bound activation key and sends/displays that key; the client must redeem it to start the package.
- Account-level terms acceptance is versioned in `user_terms_acceptances`. The login gate covers legacy/manual-entitlement clients who lack current evidence; existing v1/v2 order evidence is imported/preserved rather than fabricated.
- Fresh and Basic→Comprehensive upgrade keys cannot be issued as free-standing manual keys. Renewal inventory remains the supported manual key-manager path.
- At order approval, the key manager must choose the service duration for each package item. The automatically generated key therefore does not force a fixed period.
- An active unused order-linked package key can be edited for entitlement days, key-redemption deadline, and internal configuration notes. Every configuration change is audited. Once redeemed, its configuration is immutable; extra time must use the renewal/extension workflow.
- Do not restore the former behavior where marking an order completed directly creates package subscriptions/enrollments. That behavior explains Obada's historical case and bypassed the intended key-redemption checkpoint.
- Do not restore unrestricted manual fresh-package keys. Jihad's historical case demonstrated that this bypasses order evidence, approval email, and checkout terms acceptance.
- Order notification emails must show the stored order total and currency. Staff-facing commercial/revenue reporting must use the canonical fixed ILS amounts and must not derive Comprehensive ₪1,700 as ₪1,750 from a historic USD value or ad-hoc conversion. Basic was verified at ₪700 and did not have the +₪50 defect.

## Student Community

- Admin moderation route: `/admin/community`. It is present in the main admin navigation/task bar for full admins and for the `student_community_moderator` role. The client route is `/community`.
- The production feature flag is `admin_settings.student_community_enabled`. Keep it `false` until the safety readiness endpoint confirms all three activation prerequisites: production `OPENAI_API_KEY`, at least one active competitor term, and at least one active prohibited-language term.
- Existing and future client/support accounts are automatically eligible; missing rows in `student_community_access_controls` mean allowed. Do not bulk-copy every user into an access table. Explicit bans are stored with reason, optional expiry, acting admin/moderator, and append-only access audit rows.
- Suspended members are blocked server-side from both reading and writing. Admin/member preparation, access controls, and policy-list preparation remain available while the community feature itself is disabled.
- Every post and comment is moderated before insertion. Deterministic local competitor/prohibited-language rules run before OpenAI `omni-moderation-latest`; OpenAI refusal or unavailability fails closed, so unchecked content is not published.
- Moderation decisions store a content hash and safe policy/category metadata. Rejected raw text is not stored in the community tables or email notifications.
- A third blocked attempt within 24 hours escalates to a repeat-violation staff event. OpenAI categories including threatening hate, violent illicit activity, self-harm intent/instructions, sexual content involving minors, violence, and graphic violence escalate immediately as high risk.
- Migrations:
  - `074_student_community_access_controls.sql`: additive access-control and access-audit tables.
  - `075_student_community_prepublication_moderation.sql`: policy-term and moderation-decision tables.
  - `076_student_community_prohibited_language.sql`: rebuilds the two new moderation tables to support separate competitor and prohibited-language categories while preserving rows. Never run 076 before 075.
- Production preflight on 2026-07-24 confirmed `OPENAI_API_KEY`, `JWT_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, and `ZEPTOMAIL_TOKEN` secret names exist; `student_community_enabled = false`; migrations 074–076 were not yet present; and existing community posts/comments/reports/audit tables each contained zero rows. This was read-only evidence collected before deployment.

## Production D1 Storage And Backups

- Read-only storage investigation completed on 2026-07-19. No code or production data was changed.
- Local production SQL export growth:
  - `xflexwithai-before-055-20260621-152725.sql`: 74,346,517 bytes.
  - `xflexwithai-before-level-quizzes-20260701-131159.sql`: 123,947,922 bytes.
  - `xflexwithai-before-phases-063-068-20260712-215252.sql`: 171,860,830 bytes.
  - `xflexwithai-before-terms-gate-20260717-004203.sql`: 189,809,660 bytes.
  - `xflexwithai-before-key-config-20260718-232811.sql`: 192,574,349 bytes.
- The export increased by 118,227,832 bytes (159%, 2.59x) over about 27 days. Recent growth slowed to about 1.4 MB/day versus roughly 4-5 MB/day in earlier intervals; it was not accelerating at the audit point.
- The latest SQL file is larger than billable D1 storage because SQL serialization/escaping adds overhead. Production `xflexwithai-db` was 174,120,960 bytes, and all four account D1 databases totaled about 174,477,312 bytes. Local `.sql` files consume workstation disk only and do not count toward Cloudflare D1 billing.
- Latest 24-hour D1 metrics at the audit point were 5,881,624 rows read and 7,549 rows written. A simple 30-day projection is about 176.4 million reads and 226,470 writes; treat this as a one-day operational snapshot, not a forecast.
- Largest latest-export contributors by UTF-8 INSERT statement size were `recommendation_deliveries` 104.95 MiB (57.15%), `email_delivery_logs` 15.98 MiB, `staff_notifications` 14.99 MiB, `engagement_events` 14.16 MiB, `user_notifications` 11.01 MiB, `email_outbox` 7.04 MiB, and `staffActionLogs` 7.03 MiB. These seven exceeded 95% of the export.
- `recommendation_deliveries` had 15,867 rows for 694 events, zero duplicate `(eventKey,userId)` pairs, and only 640 distinct HTML bodies. The growth is expected under the current per-recipient audit/retry model, but storing the same rendered body per recipient is the main future optimization opportunity; this is not evidence of a retry loop.
- `email_outbox` retained 2,105 terminal `sent` rows with full bodies. General retention was not found for recommendation deliveries, email outbox/logs, staff/user notifications, or engagement events. Existing staff-monitoring retention only compacts `staffActionLogs`/sessions after 90 days and keeps aggregates for 365 days.
- Cloudflare pricing/limits checked on 2026-07-19: Workers Paid included 5 GB account D1 storage, 25 billion monthly rows read, and 50 million monthly rows written; extra storage was $0.75/GB-month, with a 10 GB per-database limit. At the audit point total storage was about 3.5% of the Paid inclusion and query usage projected well below Paid inclusions. Re-check current official pricing before making a future cost claim.
- If the account were Workers Free, the 174 MB production database would be about 35% of the 500 MB per-database cap and the observed 5.88 million daily reads would exceed the 5 million daily Free allowance. Confirm the actual plan and authoritative usage in Cloudflare Billing -> Billable Usage; Wrangler does not identify the plan.
- No emergency deletion is recommended. Future approved hardening should first define legal/support retention, then consider storing one payload per event/batch, stripping or archiving terminal email bodies after 30-90 days, pruning old read notifications after an agreed 90/180-day period, and monitoring actual D1 bytes at 50/70/85% thresholds. Preserve lightweight recipient/status/provider/timestamp audit rows.
- Compressing/rotating old local backups can reduce workstation disk usage but cannot reduce Cloudflare billing. Do not delete production history solely because SQL exports look large.
- Investigation evidence is stored under `tmp/reports/d1-storage-20260719/`, with canonical findings in `artifact.json` and supporting CSV/SQL files. This directory is temporary/ignored and is not a substitute for the project memory.

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
- Package-key fixed ILS pricing release verification on 2026-07-15:
  - `pnpm exec tsc --noEmit` passed.
  - Focused package-key pricing tests passed: 9/9.
  - Full `pnpm test` passed: 51 files, 247 tests.
  - `pnpm run build` and `pnpm run build:worker` passed.
  - Read-only production D1 reconciliation confirmed all nonzero package-key variants use the covered historic USD prices: Basic 200/50, Comprehensive 500/100, and Basic→Comprehensive upgrade 300.
  - Post-deployment Worker health returned `status=ok`; production `/`, `/ar`, `/en`, `/auth`, and the Pages preview returned 200 and referenced the new frontend asset.
- Audited package-key configuration release on 2026-07-18:
  - Release commit `04f3468` (`Add audited package key configuration`) was pushed to `origin/main` before production changes.
  - Order approval still requires terms acceptance and bank-transfer evidence, but the key manager must now choose each package key's service duration before issue; the generated code remains order-linked and email-bound.
  - Active, unused package keys can be edited for service duration, key-redemption deadline, and internal configuration notes. Activated key configuration is immutable; later service time must use the renewal/extension workflow.
  - Migration `072_package_key_configuration_audit.sql` adds editor metadata, an append-only configuration-history table, insert/update audit triggers, and an activated-key immutability trigger.
  - `npm run check` passed. The full suite passed 54 files / 262 tests; focused package activation/lifecycle/timed-service tests passed 36/36, and the final migration/API rerun passed 10/10.
  - `npm run build` and `npm run build:worker` passed. Desktop and 390x844 browser checks passed for order approval, custom 45-day configuration, unused-key editing, audit history, and the mobile edit action with zero final console errors.
  - Migration `072` passed a fresh isolated local D1 smoke: 30→45 day history was recorded with staff/admin actors, history deletion was rejected, and activated-key edits were rejected.
  - Full production backup completed before migration: `tmp/prod-backups/xflexwithai-before-key-config-20260718-232811.sql` (192,574,349 bytes).
  - Migration `072` applied at D1 bookmark `00000f7d-0000033c-000050ac-c1f3e43e26c66d51eacb8b7cda8be497` and was recorded in `schema_migrations` with source `codex_wrangler`.
  - Pre/post reconciliation remained unchanged: 115 registration keys (67 activated, 48 unused), 66 package subscriptions, and 71 enrollments. No historical audit rows were fabricated.
  - Worker version `55910eb1-9a91-47cd-9915-bf7ab9bcc88d` deployed successfully. Pages deployment URL: `https://30fbf774.xflexwithai.pages.dev`.
  - Production `/`, `/ar`, `/en`, `/auth`, and Pages preview returned 200 and referenced `assets/index-gB-exknF.js`; Worker `/health` returned `status=ok`; anonymous `packageKeys.list` returned the expected 401.
- Student-community release candidate verification on 2026-07-24:
  - `pnpm check` and `git diff --check` passed.
  - Full test suite passed: 63 files / 312 tests.
  - Focused community/notification suite passed: 12 files / 62 tests.
  - `pnpm build` and `pnpm build:worker` passed; Vite emitted only the existing large-chunk warning.
  - Secret scan across changed/untracked release files found no committed OpenAI/ZeptoMail key values.
  - Live local OpenAI moderation QA previously confirmed a safe message was allowed, deterministic prohibited language was blocked locally, and threatening text was blocked by OpenAI. Local QA records were cleaned and the local feature flag was returned to `false`.

## Future Hardening

- Installed local Codex skills for future implementation workflows on 2026-07-05: `cloudflare-deploy`, `playwright`, `security-best-practices`, `security-threat-model`, `gh-fix-ci`, and `gh-address-comments`. `openai-docs` is already available as a system skill, so do not duplicate-install it.
- Use `cloudflare-deploy` before production Worker/Pages deploys or when diagnosing Wrangler/Cloudflare deployment failures.
- Use `playwright` for browser smoke, regression checks, and UI verification on desktop/mobile, especially for auth, checkout, support chat, course watch, admin dashboards, and Arabic/English routes.
- Use `security-threat-model` before changes touching auth, OTP, sessions, roles, package keys, payments, R2 uploads, recommendation publishing, or production repair paths. Use `security-best-practices` for secure implementation review before merging/deploying those changes.
- Use `gh-fix-ci` and `gh-address-comments` when PR checks or review comments need investigation through GitHub.
- Do not add recommended third-party website/runtime packages just because a skill or repo exists. Treat React Email, Umami, PostHog, Sentry/GlitchTip, Uptime Kuma, TanStack Table, and axe-core as backlog candidates. Add each only when tied to a specific product goal, acceptance criteria, privacy/licensing review, implementation plan, tests, and deploy/rollback path.
- Do not rely only on browser duration checks; for stronger abuse prevention, add server-side video probing or a quarantine process before long-term R2 retention.
- Consider signed/private access for support evidence URLs if evidence may contain sensitive client data.
- Add R2 lifecycle cleanup for rejected bug reports, deleted support messages, and abandoned uploads.
- Design and approve D1 operational-history retention before the database approaches plan thresholds. Prioritize normalization/archive of repeated `recommendation_deliveries` bodies and terminal `email_outbox` payloads; do not implement destructive cleanup without retention requirements, a backup, reconciliation queries, and explicit production-write approval.
- Manual QA before release should cover client/admin chat image upload, short video upload, 60s+ rejection, oversized rejection, existing voice notes, `/support?tab=bugs` evidence submit, and admin bug evidence playback on mobile and desktop.

## User Working Style

- User is non-developer and prefers low-token, practical instructions.
- When user reports a bug, first ask them for targeted PowerShell search output, usually with `Select-String` or concise `rg` alternatives.
- For production-only symptoms, inspect production D1 read-only with Wrangler when useful before guessing from code.
- Then provide a short prompt they can paste into VS Code AI/Copilot/Cursor.
- Keep those prompts focused on file paths, line numbers, and exact code changes; avoid long explanations.
- Preferred verification/deploy loop after fixes: build, deploy Worker, deploy Pages, then smoke test.
