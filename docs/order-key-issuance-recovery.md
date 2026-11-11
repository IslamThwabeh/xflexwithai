# Payment approval and key issuance recovery

Payment confirmation and entitlement delivery are separate facts. The existing
financial batch marks an order completed and persists one immutable confirmation
and ledger event. Package/course/service access still starts only when the
customer redeems the email-bound key. No renewal, upgrade, Live, readiness,
protection-window, price, terms, receipt or role policy changes in this release.

## Prevention and recovery

Before confirming a paid renewal, an indexed probe checks for another active,
unused renewal key for the normalized customer email and package. Its redemption
deadline does not erase its entitlement: expired unused keys still require an
operator's review. Existing manual-key creation/assignment normalizes email.
The unchanged database duplicate triggers also cover legacy email spelling and
concurrent issuance; a race can still leave confirmed cash awaiting issuance.
No existing customer's key is automatically closed, consumed or replaced.

Order Management now distinguishes payment confirmed/key issuance pending,
key ready, redeemed, redemption expired, deliberately closed and historical
review. Finance owner/managers can retry missing issuance on completed orders
with an existing immutable confirmation. The retry submits no payment fields,
does not recognize cash again, and preserves existing key configuration. A
closed key cannot be reopened through this retry. Historical completed orders
without confirmation remain in reconciliation. Support remains read-only.

Customers see a payment-confirmed/key-pending explanation instead of the old
claim that every completed order without a key was activated directly. Closed
and redemption-expired keys are labelled and offer support rather than an
unusable activation action. The normal approval email path is preserved; its
payload builder is shared with an explicitly authorized recovery through the
existing critical transactional outbox.

## Data cost and verification

No migration, new index, polling or scheduled task is introduced. Order status
reads are chunked through existing primary-key, payment-confirmation unique and
partial `(orderId, packageId)` indexes. The renewal preflight uses
`idx_registration_keys_assignment(email, activatedAt, isActive)` and runs only
on an approval/retry action. Existing fresh/upgrade/Live issuance paths do not
gain this renewal lookup. Status projection is linear in the loaded rows.

Local SQL fixtures and the production schema rehearsal execute the exact queries
and assert indexed plans without scans. Live read-only plans confirm those same
indexes. Verification passed 44 focused tests, all 231 critical-cycle tests,
22 additional focused SQL/financial-policy tests, TypeScript, application/Worker
builds, generated SEO checks and diff hygiene. A production-schema rehearsal
used the real issuance helper, verified configuration-preserving repeat calls,
replayed the exact guarded repair SQL, and rejected duplicate application
atomically. No synthetic production account, payment or redemption was created.
Synthetic Playwright checks passed desktop/mobile owner recovery, a retry without
financial input, and Arabic mobile customer pending/closed-key states. The
recovery email's existing provider webhook reports delivered. A genuine signed-in
production staff/customer screen session was not used for QA.

## Authorized case closure

The owner explicitly verified with the team that the older unused renewal was
closed and no additional service days were due. The scoped repair deactivated
only that older unused credential, retained its original completed order and
payment evidence, and recorded the owner's instruction in the audit. It did not
fabricate a redemption timestamp. It issued one current 30-day renewal key from
the existing confirmed order and queued its ordinary notification/email. Before
and after snapshots matched for payment history, service dates, account identity
and existing Live access at the repair checkpoint. During final read-only
verification, the customer's account normally redeemed the delivered key.
The activation audit confirms success, and both existing timed services now
have renewal activation with exactly the current 30-day period, expiring
11 December 2026, Palestine time. The old key remains closed. No additional
payment or previous-key entitlement was applied.

Private recovery snapshots, guarded SQL, schema rehearsal, Time Travel bookmark
and operational evidence are under ignored `tmp/private-handoffs/`. They are not
support-AI knowledge or student-facing content.

## Staff checklist and closeout

1. Verify the receipt and terms through the existing authorized approval flow.
2. If an unused renewal key conflicts, review the referenced key/order before
   approval. Expiry alone does not authorize closing the entitlement. Record the
   verified decision and reason before an authorized closure.
3. If payment is confirmed but key issuance is pending, a finance owner/manager
   uses **Retry key issuance**. Keep the existing order and payment confirmation.
4. When a key is ready, the customer redeems it from the activation page. Key
   managers can use **View package keys** to locate the assigned credential.

This case is closed: the previous unused key is closed, the current key was
delivered and redeemed, and the current 30-day renewal is active. No further
repair, key issuance, activation or email resend is pending for that order.
Do not rerun its private repair SQL. Future renewals follow the normal workflow.
The existing limit remains: signed-in production screens were not exercised as
QA; the recorded real redemption and provider delivery were verified read-only.

## Production release — 2026-11-11

- Implementation `9d31178` is pushed to `origin/codex/live-package-phase-a`.
- Worker `522d3cc3-6a68-4b14-93e2-1f65fd44f548` was published before
  Pages `0e88c2fb-bb53-4b28-8d2c-799bb1fe1671` (production branch `main`,
  source `9d31178`). Preview: <https://0e88c2fb.xflexwithai.pages.dev>.
- Worker deployment preserved live variables, all existing D1/R2 bindings and
  the four schedules. There was no schema migration or new recurring work.
- Seven live route checks passed, including API/database health, public/private
  pages and anonymous rejection of order list/detail APIs. Private order pages
  retain noindex and private/no-store headers. Entry, Admin Orders and Order
  Detail assets matched the exact tested local SHA-256 hashes. The preview
  serves the same release entry.
- Previous recovery targets are Worker
  `fedec938-3564-46c6-a1ee-4c40319efa88` and Pages
  `fd146426-aa2d-4b48-93d6-6e216eb8ea5a`. Code rollback must preserve the
  owner's separate audited data correction; do not restore the entire database
  or reopen the older key as part of an application rollback.
