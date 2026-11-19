# Order approval and automatic key delivery

## Email and support delivery — local implementation, 2026-11-19

The owner requested investigation of a reported missing key and automatic delivery
through both email and the customer's private website support conversation. Chrome
inspection of order 189 found the payment/key email recorded as **delivered** by the
provider webhook and the key already redeemed. Provider delivery means acceptance
by the recipient's mail server; inbox placement and reading remain unverified. No
new key, activation, payment or message was created during the investigation.

The following changes are implemented locally and **not deployed**:

- Approval saves the existing email-bound key in the intended recipient's private
  support conversation, with an in-app link to Support, then queues its existing
  critical payment email. Support persistence and email persistence are independent:
  either channel can succeed while the other is retried. Support does not generate
  a second email or a new onboarding welcome. Access still requires redemption.
- Migration 137 creates one small delivery-job row per new paid order. Insert and
  order-link triggers commit this row in the same transaction as the issued key.
  A request interruption before email queuing therefore leaves recoverable work.
  No historical jobs/messages are backfilled. The existing five-minute repair
  invocation processes at most five due jobs, with indexed selection, exponential
  backoff, six attempts and a five-minute fenced lease. No new schedule is added;
  customer emails are queued for existing drains. Exhausted recovery uses the
  existing staff alert channel. Existing email drains retain provider retries.
- Support message, in-app notice and delivery receipt share one D1 transaction.
  Repeated approval/recovery cannot duplicate the support copy. Payment,
  recipient-account ownership, complete issuance, key IDs, key source/purpose,
  active/unused state and deadline are checked again inside that transaction.
  Existing conversation history, assignment and human handoff are preserved.
- Gifts go only to the actual recipient's account. If that account does not exist,
  email proceeds and the panel explicitly reports that the support copy is
  unavailable. It never puts a gift key in the purchaser's conversation. Once the
  recipient registers, an operator can recover the support copy while the key is
  still valid and unused. Redeemed/closed/refunded credentials are not replayed.
- The expanded order panel shows separate email and support outcomes, support
  persistence time, email attempt count/provider/error category, last recorded
  provider lifecycle result, job retry information and diagnostic code. New times
  use Palestine/Asia-Hebron. Reads never deliver messages and no polling is added.
  **Recover missing email / support delivery** fills missing channels without
  resetting a sent email. **Resend same key** remains the guarded explicit email
  resend. Neither action recognizes cash, issues another key or grants access.
- New failure logs contain allowlisted order/outbox references, stages and codes;
  they do not contain keys, recipient addresses, message bodies or raw provider
  exceptions. Successful email attempts remain in the existing durable email log.
  Exhausted job recovery uses the existing staff email-anomaly event. Key issuance
  failure before any key exists is logged and retains the existing explicit
  issuance-retry process; recovery never guesses service duration or issues keys.
- Activation-key strings are redacted from support history before automatic AI
  replies or staff AI suggestions are requested. Authorized human support staff
  can read the key in the customer conversation, as requested. Credential-detail,
  recovery and resend endpoints retain full-admin/key-manager/finance-manager
  guards; support-only staff cannot call those endpoints.

Staff process after release: approve once; check both delivery channels. If email
fails but support succeeded, direct the client to **Support → their private
conversation**. Use recovery for a missing channel and explicit email resend only
when needed. Never re-confirm payment or generate a replacement credential to fix
delivery. A redeemed key needs no further delivery. A mail-server delivery result
does not establish inbox placement or customer reading.

Release order: apply migration 137, record it using the established migration
ledger workflow, deploy Worker, then deploy Pages. Review new normal approvals
without creating test customer payments/messages. Historical recovery is explicit
per order. Preserve jobs, receipts, support messages, payment and key data during
rollback; an older Worker cannot recover these jobs, so rollback requires a
pending-job review. Do not drop the table/triggers or restore the database for a
routine code rollback.

Local verification passed 143 focused tests across nine files, the 262-test
critical workflow gate, TypeScript, application/Worker builds and SEO/private-route
checks. It includes concurrency/rollback/fencing/eligibility/gift tests, an actual
support-AI request redaction test, 14 bilingual desktop/mobile browser groups
(nine intercepted mutations, zero application exceptions/unknown requests), and a rehearsal against 504 objects
from the saved November 18 schema-only production snapshot. The migration was
applied twice locally; the rehearsal produced one support message and one email
queue row, preserved one fixture key/payment, granted zero entitlements and made
zero external provider calls. The diagnostic read uses the existing recipient
email index. This is local evidence, not live migration or real-inbox verification.

The final pre-release SQL gate reconciled 87 current live schema objects and
rehearsed 21 exact bound statement shapes locally. It caught and corrected a
missing outer order-ID predicate on the support receipt update before any live
write; a two-customer regression verifies that another job remains unchanged.
Jobs use primary-key/due-index access. Existing key/order-item reads and the new
write-time eligibility guards intentionally scan the currently small 215-key and
189-item tables only during approval/recovery; idle recovery performs no such
scan. JSON iteration is bounded by the order's key list. No speculative index was
added to these tables. Live read-only EXPLAIN verifies plans without executing
the mutations or reading customer rows.

Implementation `620b09648bad05a01790055a8e39dc0dd5332429` was committed and
pushed to `origin/codex/live-package-phase-a` on 2026-11-16 following owner
authorization. The owner subsequently approved production deployment, completed
on 2026-11-16 from source `730b31d` as recorded below.

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

## Production release — 2026-11-16

- Worker `79061895-25aa-4ea5-9a27-06e6b96f8f68` is active at 100%.
- Pages production `fd974465-8b59-4fda-97be-98668b8bb14b`, branch `main`,
  reports source `730b31d`; deployment URL:
  <https://fd974465.xflexwithai.pages.dev>.
- Worker was published before Pages. All 31 bindings, variable values, runtime
  compatibility/settings and four schedules match the saved pre-release snapshot.
  No migration, historical replay or customer test transaction was performed.
- Read-only metadata reconciled 60 affected table/index/trigger objects. The live
  email-outbox DDL and four indexes passed an isolated rehearsal of seven actual
  application SQL statements. Three exact read plans use the unique dedupe index
  or outbox integer PK locally and in production. D1 EXPLAIN through JSON-bound
  API requests read/wrote zero rows; schema metadata wrote zero rows. CLI-only
  SQL argument/date-serialization checks initially failed, then the exact bound
  statements passed through the API without source or schema changes.
- Post-release checks passed nine exact asset SHA-256 comparisons, seven
  current-entry/private-header/preview route checks, API/database health and
  anonymous 401 denial for order list, delivery details and resend.
- All twelve isolated bilingual browser groups passed again on deployed assets,
  with zero page exceptions or unknown API fixtures. Five account mutations were
  intercepted; no production order, payment, key, activation or email was created
  for QA. The deployed Arabic 320 px panel was visually checked. Real signed-in
  staff use and customer inbox receipt remain unverified.
- Previous Worker `31364cc0-2688-44bb-acc7-ccbd01889a44` and Pages production
  `8a2eb4f7-af71-487a-aeda-d7363375e637` are the code rollback targets.
  Private release evidence remains ignored under
  `output/playwright/order-key-delivery/`.

## Release and rollback

Deploy Worker before Pages so the delivery endpoints exist before the panel
loads. No database migration or historical replay is required. Code rollback
must preserve existing queued rows, payment confirmations and keys. The previous
Worker's generic sender can drain queued `payment_received` rows but lacks the
new send-time eligibility recheck; review outstanding order-key emails before
rolling that code back. Do not restore the database or regenerate keys.
