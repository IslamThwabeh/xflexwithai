# Audited cancellation of unpaid requests

Status: locally complete; not deployed. Plan item R08 in [the follow-up checklist](admin-finance-follow-up-plan-2026-11-25.md). This feature does not authorize cancellation of any real outstanding order.

## Policy and workflow

An authorized order manager opens a read-only cancellation review, checks the request, current evidence and related completed orders, enters a reason and explicitly confirms the decision. An attached receipt requires finance-owner/finance-manager review. A full administrator or key manager without finance authority cannot cancel a receipt-bearing request. Finance-only reviewers gain cancellation authority for receipt-bearing unpaid requests; this does not grant unrelated key-management powers.

Only Pending and Awaiting Confirmation requests qualify. Confirmed payments, issued keys including closed/unused keys, any linked ledger history, service/access history or an existing retirement record block ordinary cancellation. These cases retain their financial, service or replacement workflows. Copier orders with their own subscription record remain in the Copier service workflow. A matching customer, package or amount is not proof of a duplicate purchase or payment.

The server rechecks relationships and permissions for the action. The submitted review version must still match the current status, update timestamp and receipt pointer. Status change and the original reason/actor/IP audit append run in one atomic D1 batch. A receipt, payment, key or access link appearing after preflight prevents cancellation inside that batch. Audit failure rolls the status change back. A retry of the same recorded action is a no-op; it does not append another audit entry.

Cancellation preserves the order, items, legal consent, recipient, receipt object/reference, financial records, credentials and delivery history. It does not delete records, issue/deactivate keys, revoke access, recognize/reverse cash or send messages. Existing approval/issuance behavior is preserved. The old one-click status-change request fails safely without the explicit reviewed version, reason and confirmation.

Expanded order details include **Load status history**. Authorized order readers, including support, can view named actors, reasons, transitions and Palestine timestamps. History loads only on request, with 10 entries per cursor page and explicit Older/Newer navigation. The response is bound to the signed-in viewer and selected order and excludes request IPs, legal evidence, email addresses and credentials. Failed/unverified history reads have retry, distinct from a verified empty history. This read access does not grant cancellation authority.

## Cost and schema

Review is requested only when opening/rechecking the dialog. Related completed orders remain a separate explicit, bounded read. No polling, scheduler, provider call, new dependency or production-data export.

Additive migration139 adds five non-unique lookup indexes on order links in keys, ledger entries, Live entitlements and package subscriptions, plus order/status history. Existing primary/unique keys cover confirmations, Copier subscriptions and retirement. Local EXPLAIN shows indexed searches rather than relationship-table scans. The indexes add small write/storage costs to their existing tables; they do not rewrite business fields or establish uniqueness. Deploy the migration before the Worker and then Pages after the exact release scope is approved. Migration139 has **not** been applied to production.

## Validation and remaining acceptance

Four affected files / 89 tests passed locally; the combined isolated regression suite passed 12 files / 173 tests. Coverage includes real in-memory SQLite review/cancellation, seven concurrent-link races, receipt changes, atomic audit rollback, no-op retry, unchanged source/evidence values, indexed review/history query plans, bounded named history, route authority and identity attribution, no credential/IP disclosure, existing activation and support-read regressions. An initial route fixture omitted an existing retirement column; the fixture was completed and all checks passed.

Isolated TypeScript, app/server/Worker builds and SEO/private-route checks passed. Final artifact passed 52 cancellation/history browser assertions and 54 pricing assertions, including English/Arabic at 1440/390/320px, fixed visible confirmation controls at 600px height, access/conflict/failure/version handling, history cursor pages and explicit reads. Supplementary bilingual 320px audit entries and the Arabic dialog were visually inspected. A viewport assertion initially ran before resize layout settled; the bounded settling wait and rerun passed without changing application styles. The expired synthetic browser was restored after automatic approval review's temporary usage-limit failure; no approval gate was bypassed.

The tested combined source is sealed under `output/order-cancellation/` (29 runtime/test files including the preceding 19-file finance batch; 12 files belong to this cancellation/history batch). Browser evidence: `output/playwright/order-cancellation/`. No actual outstanding request is cancelled for QA. BO/support must still review each item in the plan's order decision register and authorize exact dispositions separately. Production release and migration139 authorization remain pending.
