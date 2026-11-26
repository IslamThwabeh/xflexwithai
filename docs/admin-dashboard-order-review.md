# Admin home and order-review follow-up

Released to production on 2026-11-26. Scope: R01–R07 and R24 in [the follow-up plan](admin-finance-follow-up-plan-2026-11-25.md). The remaining plan items and final handover remain open.

The admin home now puts the authorized monthly cash summary immediately below its single page heading. The large Features Center promotion, repeated welcome/title and duplicate pending-order widgets are removed. Existing feature configuration remains reachable; enabled features and their permissions are unchanged. Disabled-feature setup indicators remain available. Operational work is shown in one attention section: unresolved orders are distinct from unread notifications, and zero-unread workspaces are collapsed rather than described as completed work.

The topbar identifies the current workspace group; reviewed pages retain their own H1 and existing print title. Home statistics and recent enrollments have explicit loading/failure states. The existing financial authorization and report engine remain authoritative; general admin status alone does not grant cash access.

## Matching orders and review context

`/admin/orders?status=outstanding` includes Pending and Awaiting Confirmation. Its query and the home counter share the status definition and both exclude retired orders. Exact-status views, All, Cancelled and Refunded remain available. `orderId` record links override queue status so a completed source can be found, and Back restores the previous queue without retaining the source-only search.

Collapsed rows show package/service, whole-day request age, receipt attachment presence and intended recipient. Age interprets unzoned stored timestamps as UTC. Missing receipt copy is descriptive; it does not assert that payment never occurred. Purpose-classification forms are inside the expanded record, outside the row-opening control. Rows support keyboard expansion, wrapped long text, wider mobile search and usable filter targets.

Related completed orders load only after the explicit **Load related orders / عرض الطلبات المرتبطة** action. The protected read accepts a positive order ID, obtains its purchaser through the source PK, retrieves up to 21 non-retired completed orders excluding the source, returns at most 20 and discloses when older results exist. Package labels are hydrated in a batch for those IDs. Matching purchaser is explicitly a comparison lead, never proof of duplicate payment. Exact record links allow comparison through existing guarded order details.

The new procedure uses the same admin/key-manager/finance-manager/support read guard as the existing order list. Its explicit response projection excludes receipt URLs, cash amounts/references, notes, terms browser/IP evidence, activation credentials and delivery diagnostics. Student/anonymous/unrelated-staff access is not expanded. No new mutation, customer message, feature toggle or entitlement action is introduced.

## Applied financial filters

The finance URL contains the applied UTC start/end, month/year grouping and All/Academy/Copier scope. Validated defaults handle invalid/reversed dates and unknown values. Back/Forward restores the applied selection. Date/grouping drafts stay local until Apply; scope changes preserve date drafts and reuse the existing report snapshot. Applying unchanged filters explicitly refreshes. The more compact header, filters and snapshot disclosure retain the approved range/time/source wording.

## Database and performance

Migration `138_order_review_lookup.sql` creates the additive, non-unique `idx_orders_user_status_id` index on `(userId, status, id)` and records its application. It changes no order, financial, evidence or entitlement values. The owner explicitly approved this index-bearing release; the migration was applied and verified once in production before Worker/Pages deployment. The live EXPLAIN changed from an order scan to this index plus the retirement PK, without a temporary sort, reading/writing zero business rows during EXPLAIN. Creating the index incurs a one-time database build/storage cost and normal future index maintenance on relevant order writes.

Related-history queries are purchaser-scoped and use this index, with reverse ID traversal and PK retirement exclusion. They do not run per list row, on expansion alone or on a polling schedule. Result count is bounded; rows examined can exceed the displayed limit when retired entries must be skipped. The existing whole order-list loading and operational aggregate scans remain; broader pagination is still R25. No claim of constant database cost or measured production latency is made. Financial scopes/draft edits add no financial-report read, and the cash engine/source limits are unchanged.

## Validation and release

- Focused local and isolated runs: 9 files / 56 distinct tests, including actual SQLite home/list eligibility, bounded related results, purchaser/retirement isolation, repeatable migration and lookup plan, protected projection and invalid URL/date cases, cash regressions and cache invalidation. The initial 55 passed; the final affected access file passed all 11 tests, including one additional customer/anonymous denial test.
- Critical workflow suite: 38 files / 266 tests passed. It overlaps one focused file, so the two totals are not a distinct-test count.
- Final synthetic Chrome artifact: 58 checks passed across home/order/finance navigation, one-H1 semantics, lazy related loading, source links/Back, date drafts/Apply/read counts and Arabic/English responsive coverage at 1440/390/320px. Related-history failure/retry and unavailable home counters also passed. External network is blocked in the fixture; no real order is changed. Visual review led to the verified mobile search-spacing adjustment.
- The real signed-in student desktop review is recorded in the plan, including the corrected identity, expired recommendations access, exact Services path, November/October/January and illustration checks. The post-release student recheck passed on November 26, including identity, daily/weekly totals, manual refresh and the updated weekly illustration. Physical mobile/Safari and the post-release signed-in admin recheck remain outstanding.
- Production release: the approved 18 files were committed/pushed from the verified isolated source, excluding pending staff-access and rounding work. Index → Worker → Pages deployment completed. Eight Worker-stage and 22 final production checks passed, including anonymous access denial, private route headers and eight exact JS/CSS artifact hashes. All 31 binding descriptors/fingerprint, inspected runtime settings and four schedules were preserved. Private before/after recovery records are retained in the ignored evidence directory.

Build/verification evidence and the isolated source/feature-only patch are ignored under `output/admin-followup/` and `output/playwright/admin-followup/`. The isolated source excludes unrelated pending staff-review/navigation work. Preserve those edits when staging. No order closure, financial repair, payment/entitlement change or WhatsApp transmission was performed.

For future releases, retain the reviewed index → Worker → Pages order and private recovery metadata outside this document. A code rollback should preserve the additive index and all business records; older Pages must be restored with a compatible Worker if the new endpoint is removed. Never use rollback to delete payments, receipts or customer orders.
