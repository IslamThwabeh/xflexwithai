# Student support welcome

New students receive one Arabic welcome in their existing consolidated support
conversation after successful fresh package-key redemption. Payment approval
issues a key; redemption is the existing point that grants academy access.
Unactivated accounts, staff, renewal-only and upgrade-only activations do not
receive it. A durable receipt prevents duplicates even after a chat message is
deleted. Migration 134 records existing students as excluded without messaging
them. There is no backfill campaign.

The welcome asks for a proposed introductory Zoom call time, states that the
team must confirm it, publishes Sunday–Thursday 15:00–19:00 Asia/Amman hours,
and directs student follow-up to website support only. It links to the bilingual
`/guides/home-screen` guide and explains that the home-screen shortcut is not a
separate native application and has no unread-count badge. Students should
monitor email and website account notifications, and respond in support chat.

The guide is also reachable from Support and the guide library, including while
survey access is blocked. It uses labelled browser-menu illustrations, not real
iOS/Android screenshots. Safari and Chrome instructions link to official vendor
documentation; menu wording may vary by browser and OS version.

## Delivery and recovery

`backend/services/student-welcome.service.ts` commits the message, conversation
handoff, in-app notification, urgent transactional email-outbox entry, and receipt
in one atomic D1 batch. Conditional writes prevent duplicates from concurrent
activation retries. The outbox uses the existing support-reply delivery/retry
pipeline. The welcome cannot confirm or create a Zoom booking.

The conversation is left unassigned unless already assigned, is reopened when
necessary, and has AI paused so appointment replies reach human support. A
student or staff member may explicitly resume AI using existing controls.
The normal client-message notification path alerts staff when the student replies.
Activation remains successful if welcome setup fails; reopening support retries
delivery before loading the conversation history.

## Rollout

1. Apply `database/migrations/134_student_support_welcome.sql` once using the
   project's normal migration ledger. Its exclusion seed must run before the
   new Worker receives traffic.
2. Deploy the API Worker, then the frontend. The guide URL is private and
   inherits `/guides` authentication, survey allowance and noindex handling.
3. Verify with an authorized new test student: redeem a fresh package key,
   check the welcome and notification, confirm the outbox email arrives, and
   reply with a proposed time to confirm support receives the message.

No production database, customer account, email, or deployment was changed
during local implementation. SQLite tests use an isolated in-memory database.
TypeScript, 91 focused tests across six suites, frontend and Worker builds passed.
Browser visual QA was unavailable because the browser access host was offline;
the illustrations and mobile layouts still need a real-device visual check.

## Release preflight — 2026-11-10

- The critical-cycle release gate passed 227 tests across 33 files. TypeScript,
  SEO middleware checks, and diff hygiene passed.
- A schema-only production export was restored into an isolated SQLite database.
  Synthetic `.invalid` fixtures verified migration exclusions, welcome delivery,
  repeat calls, database integrity and foreign-key checks against the actual
  production table definitions. No production customer data was exported.
- Production is on source `fb85aa7` before this release. Migration 134 is absent;
  the aggregate preflight found 116 existing students to exclude.
- D1 pre-change recovery bookmark:
  `00001912-00000ab2-0000511f-aa1fb4d07686739887753f7b9fe0175f`.
- Browser automation remained unavailable. A screenshot of the existing
  WhatsApp browser window was rejected to protect unrelated private content;
  no screenshot of that window was taken. Native-browser isolation did not
  produce a reviewable preview. Browser/device visual QA remains unverified.

## Production release — 2026-11-10

- Implementation commit `5c11cf1bf94776c870afa44dc444c1c5ce43f711` is pushed
  to `origin/codex/live-package-phase-a`.
- Migration 134 is recorded exactly once. Verification found 116 receipts,
  all exclusions for existing students, and zero delivered welcomes from the
  migration. Apply cost: 580 rows read and 122 rows written; database size
  429,219,840 bytes. Post-apply recovery bookmark:
  `00001912-00000ad4-0000511f-10b9948a9998a237769127b36972c5c0`.
- Production Worker version `e4be1e11-e43f-4f69-9078-5bbdc0f52717` is deployed
  with source tag `5c11cf1`, existing variables preserved, all five D1/R2
  bindings and the four existing schedules retained.
- Pages production deployment `cf7500f3-b879-4aca-877d-4931310de26c` on `main`
  reports source `5c11cf1`: `https://cf7500f3.xflexwithai.pages.dev`.
  Primary guide URL: `https://xflexacademy.com/guides/home-screen`.
- The full production build generated the app shell, 36 public pages and six
  article pages. Generated-output SEO checks passed.
- Post-deploy smoke checks passed: production `/ar`, `/guides/home-screen`,
  `/support` and `/guides` all returned 200 with the new release entry asset.
  Private routes retained noindex and no-store headers. API health and database
  health returned 200; anonymous `supportChat.myConversation` returned 401.
- The entry, guide library, home-screen guide, welcome copy and support-chat
  JavaScript assets returned 200 and exactly matched local SHA-256 hashes.
- No real student was impersonated and no synthetic production account,
  activation, support message or email was created for QA. Real-device visual
  review and a real student/inbox end-to-end check remain unverified.
