# Live Expert messaging

Verified locally and deployed to production on 2026-10-26. Production serves the exact verified messaging bundles; health, private-route headers, and anonymous API denial checks passed.

Clients enter through **Live Package → Message your Live Expert**, at `/live-package/messages`. The expert uses `/admin/live-expert`. Conversations are separate from general support, with one thread per client/cohort, text, private screenshots, unread counts, and unanswered-first ordering. Arabic, English, and mobile layouts are supported.

## Access and operations

- Assign the `live_expert` role to the intended staff account in `/admin/roles`. This role does not grant general support, finance, or student-list access.
- A full admin chooses the expert for **new** conversations, availability copy, and grace days in the inbox's **Messaging settings**. The default grace period is seven days after the cohort ends; the maximum is 90. Copy does not promise a response time until the admin configures one.
- Existing conversations keep their assigned expert. Admins can explicitly reassign a selected thread; the former expert immediately loses access unless independently authorized as a full admin.
- Clients can start messaging after their enrollment is activated, including before classes begin. Revoked enrollment or an expired messaging period disables new messages and uploads for both participants. Historical threads and sent screenshots remain readable by their authorized participants and admins. Permanent recording access does not extend messaging access.
- Every thread, message-history, read-cursor, upload, and screenshot request checks the authenticated participant or admin. General support staff cannot browse expert messages. Admin oversight does not consume the expert's unread cursor and is disclosed in the client interface.
- Screenshots are PNG/JPEG/WebP, at most 2 MB, checked by signature and size, and stored under randomized keys in a dedicated private R2 bucket. There are no public attachment URLs. The app fetches the image after authorization, using private/no-store API responses.
- Unsent screenshots expire after 24 hours. The existing daily maintenance invocation removes up to 100 expired pending uploads with an indexed query. Sent images are preserved.
- Message retries use a unique client nonce and an atomic D1 batch. History is paginated in 50-message pages; delta polling and inbox refresh pause while the page is hidden. Polling is 15 seconds for open conversations and 30 seconds for inbox/workspace summaries.
- New client messages create a bell notification and an urgent queued email for the assigned expert only. Expert/admin replies notify that conversation's client only. One bell entry is maintained per conversation and recipient; opening/reading the incoming messages clears it. Admin oversight does not clear the expert's unread state.
- Email alerts contain a sign-in link, with no message text or screenshots. Messages in the same clock minute share one email per conversation, direction, and recipient. Delivery uses the existing minute scheduler and normal retries; provider acceptance is not a guarantee of inbox delivery.
- Before dispatch, email delivery rechecks current recipient email, account access, assigned expert role, email preference, and whether incoming messages are already read. A read conversation or changed/reassigned/blocked recipient is skipped. Bell alerts remain available when email is off.
- Clients control **Live Expert Replies** in `/profile`. Experts control **Email me when clients send new questions** in `/admin/live-expert`. Both default on. Customer reply links include `cohortKey`, so historical or multi-cohort clients land in the relevant conversation.
- Migration 131 adds `alerts_enqueued` with default 1 for existing messages. Only newly inserted messages explicitly start at 0. Message storage, bell updates, email enqueue, and the handled flag commit atomically, preventing a historical backlog or duplicate alerts on retries.

## Local verification

Use the project Node runtime:

```powershell
. ./scripts/use-project-node.ps1
npx --no-install vitest run server/liveExpertMessaging.test.ts server/staffNotificationBadgeRoutes.test.ts
npm run check
npm run test:critical-cycle
npm run build
npm run build:worker
node --import tsx scripts/verify-live-expert-local.ts
```

The local browser fixture copies **schema only** from `xflexwithai.dev.db`, adds required migrations, and creates synthetic clients, experts, support, and admin accounts in a new ignored `tmp/live-expert-qa-*` directory. It prints paths to browser storage-state files and serves `http://127.0.0.1:3410`. Screenshots use an in-memory private-storage stand-in. It does not copy customer rows or send external notifications. Keep storage states and database files out of Git.

Verify two clients cannot see each other's threads; the assigned expert can reply/open screenshots; an unassigned expert and support-only staff are denied; admins can configure/reassign; expired/revoked clients retain read-only history; and Arabic/mobile layouts remain usable.

The implemented verification passed 12 real SQLite/D1 messaging tests, the five notification-route tests (including expert access without general-support access), TypeScript, frontend and Worker builds, and diff hygiene. The existing critical suite passed all 33 files / 203 tests before the additional expert notification test was added; the affected notification tests were rerun afterward. Browser QA exercised client questions, expert replies, private screenshots, client separation, admin settings, revoked read-only history, Arabic/mobile layouts, and fresh client/expert pages without console errors after completing the local fixture schema. Images are under ignored `output/playwright/live-expert-*.png`.

## Production rollout

1. Verify `wrangler whoami`. Capture the current Worker/Pages deployment IDs and a D1 Time Travel bookmark. Export schema only if a rehearsal of the latest production schema is needed.
2. Rehearse `database/migrations/130_live_expert_messaging.sql` locally against the schema. The migration is additive and idempotent, includes its migration-ledger entry, and does not modify existing customer/support/package data.
3. Create the R2 bucket `xflexacademy-live-expert-attachments` **with public access disabled**. `wrangler-worker.toml` binds it as `LIVE_EXPERT_ATTACHMENTS_BUCKET` in production only.
4. Apply migration 130 once to production D1 using the production Worker config. Confirm all four new tables, the partial pending-upload index, and exactly one ledger entry.
5. Resolve the intended **live** account by its existing identity and confirm it is unambiguous. Grant only the additional `live_expert` role, preserving existing roles and credentials. Set `live_expert_settings.expert_user_id` to that account's ID (or select it in the admin UI after deployment). Do not infer identity if multiple accounts match.
6. Deploy the verified Worker first, then Pages to the production project `xflexacademy`/branch `main`. Check both health endpoints, private route headers, anonymous API denial, and served bundle hashes.
7. Use authenticated production access for a read-only configuration check. Do not create synthetic customer conversations or send messages to real customers as a smoke test.

For rollback, restore the preceding Worker/Pages releases; leave the additive tables and private bucket in place to preserve conversations. Do not drop tables, delete messages, or remove pre-existing staff roles as a rollback shortcut.

## Deployed release

The email-alert follow-up passed 68 focused tests, the 33-file / 204-test critical suite, TypeScript, production builds, and two rehearsals using production's partial notification indexes. Local browser checks confirmed both queue directions, notification counters, client cohort links, and saved client/expert email preferences. Migration 131 preserves historical messages as handled and adds no notification catch-up.

- Application source: `2452529`, following feature commit `94c6432`.
- Worker version: `b7113a63-f6b9-4247-a3f8-267a1c4ed8e2`, deployed at 100%, preserving D1, the existing R2 bindings, and all four cron schedules.
- Pages production deployment: `0cdbecca-9732-483f-b40f-b8669094e90e`, source `2452529`, preview `https://0cdbecca.xflexwithai.pages.dev`.
- Migration 130 applied once. Two rehearsals on the production schema passed integrity and foreign-key checks. Production migration used 22 row writes; account setup used seven. Recovery bookmarks: before `00001883-00000968-00005110-ac3ddcbcbf7ae0d1f5f4df2ffcc61258`, after `00001883-00000978-00005110-3f1a110c3b66e1665f8153bf42dcae58`.
- Existing staff account **Live**, ID 153, is the configured expert. Its `live_recording_uploader` role is preserved, with only `live_expert` added. Default grace is seven days. All ten current Live enrollments have an unscheduled `not_started` cohort and can ask pre-class questions.
- `xflexacademy-live-expert-attachments` was provisioned with its public development URL disabled and no custom domains. No screenshot is publicly accessible through that bucket.
- Production `/ar`, `/live-package/messages`, and `/admin/live-expert` returned 200. Both private routes return `noindex, nofollow` and `private, no-store`. Worker health and database health returned 200; anonymous expert workspace/inbox requests returned 401 with `private, no-store`.
- SHA-256 hashes of the production entry bundle and all four Live messaging/workspace chunks matched the local build. No synthetic customer conversation, expert reply, or external email was created in production; authenticated message round trips were verified locally.
- Rollback references: previous Worker version `cab4809f-3f70-4d42-9edd-50d9a6e7fd60`; previous Pages deployment `950ecd6b-cd16-49c2-a847-bb6c0aa206aa`.
