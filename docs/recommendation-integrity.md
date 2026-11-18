# Published recommendation integrity

Implementation approved by the owner on 18 November 2026. **Local implementation; not released to production.** Historical deletions, restoration and retrospective customer notices are out of scope.

## Behaviour

- Preserve the existing one-minute advance alert, immediate publishing after unlock, session expiry, polling and schedules. No extra draft timer.
- New roots require a BUY/SELL direction, positive numeric entry, SL and TP1. SL and targets must be on the correct sides; optional TP2/TP3 must progress beyond earlier targets. Structured levels are authoritative and the publisher must review the text against them. Prices use the existing decimal field convention.
- Entry type is explicitly selected: immediate or pending. Existing roots retain an unknown historical entry type (`legacy`), are ineligible for pending cancellation, and do not acquire an invented immediate-entry email label. Do not infer pending status from free text or reclassify old records.
- Published roots, updates and results cannot be deleted or rewritten, including by full admins. Legacy API mutations fail closed; database triggers protect stored originals. Clarifications append a new update. No new mutation deletes historical records.
- Pending cancellation requires the publisher's explicit confirmation that entry never triggered, an open pending root and **no existing follow-ups of any kind**. Unknown activation requires BO review; active positions use an update/early-close instruction. This conservative gate prevents cancelling a thread with recorded results. There is no broker integration proving activation.
- Cancellation atomically appends a permanent bilingual notice, closes the root with `cancelledAt`, and inserts email outbox plus in-app rows. Early-close instructions append a notice without cancelling or closing the root: the manager must record the actual outcome and then close the thread. The notification does not execute an order at a broker.
- Clarifications never overwrite original prices or score as results. Result corrections require full-admin authority and a reason, with an atomic before/after audit. The audit is append-only. Managers still report cumulative milestones under the existing model; these are human-entered reports, not independently verified broker results.
- Reports keep cancelled pending entries and breakeven contributions separately. Win rate is wins divided by wins plus losses; zero period contribution is breakeven, not a win. Existing month boundaries and UTC storage remain unchanged. Management prose is never interpreted as pips, even if its reason contains numbers.

## Delivery and isolation

The `management` delivery kind uses the existing recommendation BCC/retry/provider system and has priority over initial recommendation sends. It is deliberately outside ordinary stale-update and orphan-result suppression, so a closed/cancelled root or expired publishing session cannot discard the notice. No new cron exists.

The audience is restricted to the original root's delivery records, including clients online at publication. It never expands to unrelated/new subscribers. Current account, staff/analyst exclusion, matching email, notification-control/preference checks and permanent email suppression remain enforced. Expired subscriptions do not suppress management notices to the original audience; thread muting does not suppress them. Missing, blocked and staff/analyst accounts are excluded when preparing the audience. Unsafe account changes after preparation, opted-out clients and permanent suppressions produce skipped/suppressed delivery records in full-admin monitoring. Provider acceptance is not inbox delivery. Existing bounded retries/dead-letter visibility remain; no unlimited retry promise.

Both outbox and in-app rows are in the same atomic D1 batch as cancellation. A UUID prevents duplicate notice creation on retry; event/user uniqueness prevents duplicate queued mail. The batch uses only bound SQL parameters (rehearsal maximum 26 per statement, below D1's 100). No provider is called inside the transaction. A failed response can be retried with the same request ID. A missing original audience fails rather than marking the trade cancelled without notifications.

Each manager sees only their own existing feed/report scope and may manage only their own root. Cross-manager management returns an unavailable response without author details. Full-admin global oversight remains unchanged. Clients see academy-branded content, no actor identity or audit details. New customer timestamps use `shared/academyLocale.ts` and Palestine/Asia-Hebron seasonal time. Original UTC timestamps and explicit report timezone choices are preserved.

## Verification

- Synthetic SQLite/D1 tests cover retained legacy rows, immutable originals/results, cancellation after follow-ups, ownership, explicit confirmation, original bilingual audience, HTML escaping, rollback on queue failure, idempotent retries and append-only result correction.
- Local rehearsal reconstructs the actual production table/index/trigger definitions, applies migration 136, and executes actual helpers for management, send-time eligibility, stale reconciliation, reports, scoped feeds and audited corrections. All records are synthetic and external fetch is disabled.
- TypeScript, focused recommendation tests, the protected critical cycle, application/Worker builds, private-page SEO checks, and isolated Arabic/English desktop/mobile UI checks form the release gates. Exact final results are recorded in project memory after verification. No actual client trade, email or cancellation is used for QA.
- Ignored evidence: `output/recommendation-deletion-review-2026-11-18/`; browser artifacts: `output/playwright/recommendation-integrity/`.

Completed local gates: **38 files / 262 critical tests**, TypeScript, production frontend/server/Worker builds, SEO/private-page checks, four bilingual viewport groups, four additional permission/validation/retry checks and two required-copy groups. Arabic mobile panels and the full-admin report were visually inspected. All business requests were synthetic/intercepted; actual production roles/inboxes and physical Safari were not exercised.

## Production release and recovery

1. Review and commit only this feature's files; preserve the separate paid-efficiency investigation and pre-existing memory edits.
2. Reconcile the live migration ledger and verify the four new columns, audit table, unique index and integrity triggers are absent. Record a fresh recovery bookmark and aggregate message counts. Do not rerun migration 136.
3. Apply `136_recommendation_integrity.sql` once and record it using the existing ledger convention. The migration adds metadata/empty audit storage, builds one uniqueness index and installs triggers; it creates no emails or notices and performs no historical repair. Reconcile counts and schema before continuing.
4. Deploy Worker before Pages, preserving live bindings, variables and all schedules. The short migration-first window intentionally blocks old edit/delete actions; new management actions are not advertised until the new frontend is live. Health, authorization, exact artifact and private-cache checks must pass.
5. Use synthetic/intercepted UI verification after deployment. Real BO/manager inbox checks require a deliberately authorized real business action, not a fabricated customer trade.

For a code rollback, keep the additive columns, audit rows and integrity triggers. Older code may show edit/delete buttons, but those actions remain blocked. Older code does not understand the new management delivery kind and must **not** become the sole queue consumer while management mail is pending: keep the compatible delivery worker or a reviewed forward fix until those notices are accounted for. Never restore the whole production database, remove message history or undo client cancellation state as routine rollback.

## العربية

تبقى مهلة التنبيه الحالية دقيقة واحدة دون تأخير إضافي. تُلزم التوصية الجديدة بالدخول ووقف الخسارة والهدف الأول، ويُمنع حذف الرسائل المنشورة أو تغيير أصلها. الإلغاء متاح فقط لأمر معلّق يؤكد المدير عدم تفعيله ولم تُنشر له أي متابعة. تبقى التوصية والإلغاء في السجل، وتُحفظ الإشعارات والبريد معًا. الإغلاق المبكر تعليمات للعميل، ثم تُسجّل النتيجة الفعلية دون محو ربح أو خسارة. تصحيح النتائج للإدارة الكاملة فقط مع السبب وسجل القيم السابقة واللاحقة. يُحافظ على عزل المديرين، ولا تُكشف هوياتهم للعملاء أو لبعضهم. لا إصلاح أو استعادة للحذف التاريخي ضمن هذا الإصدار.
