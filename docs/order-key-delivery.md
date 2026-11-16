# Order approval and automatic key delivery

Implementation `620b09648bad05a01790055a8e39dc0dd5332429` was committed and
pushed to `origin/codex/live-package-phase-a` on 2026-11-16 following owner
authorization. Production deployment remains pending; no Worker or Pages release
was performed for this change.

## Behavior

Authorized finance approval still records the existing immutable payment and
issues the order-linked, email-bound key with the selected duration. It now
persists a critical transactional `payment_received` email in the existing
outbox before making an immediate attempt for that specific row. Existing
scheduled drains handle provider failures with their normal backoff and attempt
limit. There is no new schedule, dependency, migration or historical resend.

The bilingual payment email includes a friendly greeting, the existing key and
instructions for fresh activation, renewal or upgrade. The detailed support
welcome remains after successful fresh activation. Approval never grants access.

Approval focuses the order and clears a status filter that would otherwise hide
the newly completed order. Its expanded panel shows the recipient, key, Copy,
delivery status and an explicit Refresh. Send/Resend uses the same credential
and outbox row. Reads never send messages. Old orders without this queue record
show unavailable delivery status; this does not claim their old email failed.

The panel distinguishes queued, sending, provider acceptance, automatic retry,
exhausted retries and suppressed delivery. Provider acceptance is not inbox
delivery. Sent/retry times use `shared/academyLocale.ts` and Palestine time.

## Security and failure handling

Runtime boundaries are authenticated staff browser → tRPC → D1 → email provider.
Payment and key integrity, recipient confidentiality and delivery availability
are the protected assets. Internet users and support-only staff cannot call the
new credential-detail or resend endpoints. Full admins, key managers and finance
managers use the existing `adminOrRoleProcedure` guard; finance approval retains
its separate finance-owner/manager check. Clients cannot submit a recipient or
key to either new endpoint.

`order-key-delivery.service.ts` verifies completed status, immutable confirmation,
complete package issuance, order-backed key source/purpose, assigned recipient,
active/unused state and redemption deadline before queuing. The generic sender
rechecks eligibility, recipient and key IDs at send time. Invalid, closed,
redeemed or reassigned keys are not emailed. This prevents a delayed queued
email from delivering stale credentials after an operational change.

The unique order dedupe key prevents concurrent approval requests from creating
duplicate queue records. Explicit resends are audited without key values or
message bodies. A conditional update and one-minute cooldown prevent concurrent
or repeated clicks from resetting an in-flight job. Suppressed deliveries cannot
be reopened using resend. Resend cannot create payment, keys or entitlements.

A queue persistence failure returns the saved key with an explicit approval
warning, and the same order offers recovery. Payment is never re-recorded to
retry delivery. A process interruption between key issuance and queue insertion
still requires that explicit recovery; no reconciliation cron is added. The
existing external email transport is at least once: a crash after provider
acceptance but before saving its acknowledgement can repeat an email, always
with the same credential. No claim of exactly-once inbox delivery is made.

## Data cost and verification

No additional order-list queries or polling. Delivery details load only for an
expanded completed order and operational staff, with automatic query retry,
focus and reconnect refresh disabled. The detail lookup uses the existing unique
outbox `dedupeKey` index; explicit immediate sends select the specific outbox PK.
Context validation uses existing order, item, key, confirmation and user lookups.
The existing scheduled retry budget remains; added work is per approval, explicit
detail/refresh/resend and actual email attempt, not a recurring new job.

Verification: 99 focused tests, including real local D1 SQL for concurrent
queue insertion/claim/resend, cooldown and indexed lookup; 235 critical-cycle
tests; TypeScript; application and Worker builds; SEO/private-page checks.
Twelve isolated Playwright groups passed: English/Arabic at 1440/390/320 px,
copy to clipboard, resend, readable mobile key/buttons, queued/failed/exhausted/
missing/redeemed/suppressed states, explicit status retry without automatic query
retry, support-only exclusion and approval retaining the selected order after a
status filter. All five browser mutations were intercepted synthetic requests,
with zero page exceptions or unknown API fixtures. Panel screenshots were
visually checked, including the corrected Arabic 320 px layout. Genuine signed-in
production staff and real customer email receipt remain unverified in this change.
No production customer/account/payment/key/email writes have been performed.

## Release and rollback

Deploy Worker before Pages so the delivery endpoints exist before the panel
loads. No database migration or historical replay is required. Code rollback
must preserve existing queued rows, payment confirmations and keys. The previous
Worker's generic sender can drain queued `payment_received` rows but lacks the
new send-time eligibility recheck; review outstanding order-key emails before
rolling that code back. Do not restore the database or regenerate keys.
