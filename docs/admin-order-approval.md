# Admin order approval and optional receipts

The Orders approval dialog now lets authorized staff attach a receipt image or PDF directly. The attachment is optional: the finance owner or a finance manager can confirm payment without one, using the required paid date, exact ILS amount and rationale. Customer terms acceptance, package duration rules, transaction purpose, locked financial periods, idempotent cash recognition and order-bound key issuance remain enforced. An existing invalid/untrusted proof URL is still rejected.

The form uses a viewport-bounded dialog with a scrollable body and fixed action buttons, logical close-button placement, 44 px touch controls and constrained native date-input width. Live orders explain their cohort access instead of displaying a misleading 30-day default or asking for a service duration. Standard-package durations remain. Payment wall time is labelled Palestine time and converted with the shared Asia/Hebron default; invalid and ambiguous seasonal-clock times are rejected rather than silently changing the cash timestamp. Stored UTC timestamps and reporting logic are unchanged.

## Upload and audit behavior

- `POST /api/uploads/admin-order-proof?orderId=...` receives the file as binary. Full admins and finance managers are authorized server-side; support, key-only staff, anonymous accounts and ordinary students cannot use it. The customer endpoint retains order-owner isolation.
- Existing 10 MB and file-signature checks accept JPEG, PNG, WebP, HEIC and PDF. Files use randomized order-scoped keys. No arbitrary URL linking is enabled, and legacy linking routes remain disabled.
- Uploads only change pending/awaiting-confirmation bank-transfer orders using the existing owner/status-guarded helper. They do not confirm money, issue keys, change entitlements or send messages. The real customer owns the receipt; admin/staff actor attribution is recorded separately.
- Selection uploads and saves immediately; the form says so. Upload progress disables approval/closing. Failures preserve the current receipt and financial inputs and offer retry or explicit continuation without a new attachment. A database linking failure cleans up the newly uploaded object.
- Staff replacements retain the older receipt object and record its URL in the audit. This preserves evidence another concurrent approver might already have included in an immutable cash confirmation. Existing customer-replacement behavior is unchanged.

## Runtime and SQL cost

No schema migration, new SQL shape, runtime dependency, polling, scheduler or provider integration. Explicit upload reuses indexed admin/role/order lookups and the existing PK-guarded proof update, with a small fixed number of audit writes plus one R2 upload. Binary handling avoids base64 expansion and is bounded by 10 MB. Staff receipt replacements may retain an additional object for audit preservation. No recurring CPU/read increase is introduced; on-demand upload adds bounded request work. The presentation changes and timezone conversion run in the browser.

## Verification and release

Focused tests cover the real Worker endpoint, unauthorized actors, customer ownership, closed orders, signature validation, reference preservation, receipt replacement, optional attachment approval, finance permission, terms/amount checks and payment-time conversion. The critical activation test now expects the explicitly requested optional-receipt policy while retaining its financial-owner assertions.

Browser checks use synthetic orders and intercept all uploads and approvals. They cover Arabic/English, 320/390/590/1440 px and reduced viewport height, date-input geometry, fixed actions, optional upload success/failure, approval errors, roles, Live/standard duration copy and already-paid issuance retry. No real order is approved or customer receipt uploaded for QA. Physical-device Safari and a signed-in production admin remain separate from this isolated verification.

The actual reused database helpers are rehearsed against live-shaped SQLite DDL, including owner/status guards and index plans. Evidence is ignored under `output/playwright/admin-approval/`. Deploy the Worker before Pages so the new optional field and approval behavior are available together. Rolling back the Worker restores the mandatory-receipt approval guard; saved receipts and confirmations must be preserved.

Released on 2026-11-17 from source `ff312b7`, Worker before Pages. Verification passed 45 focused tests, 235 critical-cycle tests, TypeScript, application/Worker builds, SEO/private-page checks and nine indexed local/live helper plans. Post-release checks passed four exact asset hashes, five routes, API health, upload authentication/CORS and all thirteen synthetic browser groups. Worker configuration and all four schedules were preserved. Production QA did not approve a customer order or upload a receipt.
