# Checkout retry safety and discounted invoice lines

Status: released and deployment-verified on November26. Follow-up R09 and the owner's confirmed R26 invoice convention in [the main plan](admin-finance-follow-up-plan-2026-11-25.md). The earlier finance/cancellation archives are retained; the combined production release was explicitly approved separately. No old-order closure or historical financial repair is authorized.

## Intended behavior

- Repeating one checkout intent returns its original order, including after a lost response or later payment/status changes. It does not create another order, consume another coupon use or repeat new-order side effects.
- The intent is scoped to the authenticated account, workflow and normalized purchase input. Package, gift recipient/message, payment method, coupon, notes and accepted legal version matter; a changing client acceptance timestamp does not create a new purchase intent. Reusing one key for different input is rejected.
- The default intent for the same purchase input is stable across reloads/tabs. A clearly labelled **Start another request** action creates a fresh intent when a genuine new purchase is wanted. Existing renewal/Copier/upgrade eligibility and open-request rules remain enforced. Do not deduplicate cash by customer and amount or infer that two distinct gifts are duplicates.
- Standard checkout, upgrades, paid renewals and Copier use the same durable intent mechanism. Existing callers without a new key receive a stable server-derived default, rather than bypassing retry protection. Existing pending-order reuse must also be recorded against the intent before returning.
- Order, items and required renewal/service/pricing detail are saved together. Failed detail writes roll back the complete creation; no new orphan order remains. Existing historical incomplete records are not silently repaired.
- The order remains the successful result if a noncritical post-creation notification fails. Only the winning creation attempt performs new-order side effects; no live notification is sent during QA.
- New customer pages send the price/discount/currency/VAT or renewal/offer context they actually displayed. A changed quote is rejected before creation, the terms checkbox resets and the quote refreshes for review. Existing saved intents resume before quote validation, preserving their original invoice. Quote context does not change the purchase-intent hash. Coupon rechecking is explicit; network failures never silently create a fresh intent.

## Approved invoice convention

The owner approved net invoice discount lines plus separately shown VAT-inclusive savings for future discounted orders. Keep the configured rate, actual VAT on the discounted payable amount and final payable total unchanged. Example: gross100, savings10, payable90; invoice86.21−8.62+12.41=90. Native-currency integer minor units determine the stored components; commercial ILS display conversions retain their existing ratios and penny allocation.

Use an explicit pricing snapshot for new discounted orders so a future reader can distinguish the net discount from the older gross-discount field convention. Preserve all historical source values and genuine discrepancy warnings. Checkout preview and admin/customer invoice components must agree, with gross savings labelled separately. Do not infer a new exchange rate or tax policy.

## Storage and cost approach

Use a small durable intent table with account/key lookup, request hash, flow and linked order. The mapping becomes immutable after assignment. Use indexed per-order pricing snapshots for the new discount convention. Prefer additive tables over changing every historical order row. Required order/detail writes run in a single D1 atomic batch; existing eligibility/quote checks remain before creation. No polling, schedule, provider integration, new dependency or broad historical scan.

Client storage contains bounded opaque intent/order references, rather than recipient or message content. Hash normalized input in memory. A cache/storage failure must not turn one retry into a new purchase. Intents remain durable with their orders; do not expire server keys and accidentally turn a late retry into a new sale.

## Acceptance before release

Verify same-key concurrency, mismatched input, account isolation, changed gifts/baskets, explicit new requests, retries after closed/completed orders, all four workflows, coupon use counted once, real SQLite rollback at every required-detail boundary, current domain eligibility, original legal evidence and no cash/key/access mutation. Check invoice arithmetic against an independent integer oracle and preserve totals/VAT across boundary cases. Validate bounded/indexed query plans, no N+1 pricing reads, TypeScript/app/server/Worker/SEO and focused regressions. Browser QA uses intercepted synthetic requests in Arabic/English desktop/narrow layouts; it never creates a real order or sends an email/message.

Prepare the exact source and a new additive migration for review. Migration139 remains part of the separate, unreleased cancellation batch. Obtain the corresponding production migration/release authorization before applying either new migration, then deploy Worker before Pages.

## Implemented source and validation

- Four customer flows use an account/flow/input-bound durable intent. New orders, required items/service details and discounted invoice snapshots are atomic; coupon usage increments once. The existing open-renewal/Copier/upgrade rules are retained, including concurrent requests with distinct intent keys. Old orders without a mapping are not automatically merged or rewritten.
- Migration140 adds two guarded tables and the missing per-order item lookup index. No existing business row is changed. Pricing metadata is joined by primary key into the existing batched package-summary read; it does not add a query per order. Existing order/cash/access authorization stays in place.
- Browser storage is bounded to20 opaque records per account. Blocked storage retains deterministic default retries and permits an explicitly confirmed new request. Gift emails/messages, coupon input and legal evidence are not stored in that cache. An older response cannot overwrite a newer prepared intent.
- The Comprehensive coupon preview now retains its existing commercial ILS ratio: a10% coupon produces₪1,530 payable and₪170 savings, matching the stored-order display. Net subtotal₪1,465.50 − discount₪146.54 + VAT₪211.04 =₪1,530. No charge, conversion policy or configured VAT changed.
- Combined isolated source:49 files, with24 checkout files over the preceding sealed29-file batch. Unrelated staff/navigation/memory work is excluded. Exact source/hashes/artifacts and browser records are privately retained under `output/checkout-reliability/`; prior archives remain intact.
- Combined focused regressions:17 files/209 tests passed; the final additional upgrade stale-quote case passed in its10-test file, bringing that focused coverage to210 distinct cases. This includes real SQLite controller/adapter/concurrency/rollback/ownership/coupon tests and6,000 independent integer-oracle invoice combinations. The existing critical suite passed38 files/266 tests with overlap. Isolated TypeScript, app/server/Worker builds and SEO/private-route checks passed.
- Final local browser artifact passed32 workflow/layout assertions and14 edge assertions: Arabic/English1440/390/320; displayed/stored invoice agreement; lost-response/reload retries; separate gifts/new-request confirmation; all four flows; changed-quote rejection; blocked storage; customer/admin boundary; opaque cache; no extra package read on checkbox changes. The settled Arabic320px confirmation was separately inspected, fully inside the viewport with an opaque background. No page runtime errors. An unrelated optional announcement-status read used a null synthetic response. External providers were blocked. Physical devices/Safari and production checkout journeys remain unverified.
- Local QA performed no real checkout, notification, cash/key/access action, historical repair or cancellation. Subsequently, the owner explicitly approved migrations139/140 and the combined production release; both migrations and Worker→Pages deployment are verified below.


## November26 production verification

Production release verified November26: the approved49-file source plus supporting documents is committed/pushed; additive migrations139/140 are applied. Worker→Pages rollout passed11 Worker-stage and41 final read-only route/privacy/asset checks. Configuration/bindings/four schedules were preserved. No historical financial rewrite, real order cancellation, checkout or message was used for verification. Signed-in UI recheck of this combined release is pending because the Chrome connector is unavailable and no Chrome window is currently open. Earlier real student/admin reviews remain dated evidence.
