# Client payment reporting correction and production rollout plan

Date: 28 October 2026, Asia/Amman. This records the approved rollout design and initial baseline. Implementation and local/read-only production verification are now complete; see [candidate verification](client-payment-reporting-verification-2026-10-28.md). Production deployment and individual record repairs remain separate release steps.

## Outcome and scope

Support and admins must see consistent, evidence-backed client payment summaries in the client list, subscribers report, client profile, and their CSV/PDF exports. Payment recognition and service activation are separate facts. Missing historical evidence must never imply that the client owes money or must purchase again.

This is a reporting release for every client. Individual historical reconciliation and entitlement repairs are separate, reviewed operations after the reporting release. Hala's individual case remains paused. Her stated Basic/renewal breakdown is not a reason to edit her records during this work.

## Evidence collected

### Source review

| Surface/source | Current behavior | Planned correction |
| --- | --- | --- |
| `backend/db.ts:getSubscribersReport` | Totals activated package-key prices, less account-refund records; misses confirmed purchases whose keys are unused and historical purchases without keys | Add one shared client payment summary derived from financial evidence; retain operational key history under explicit names |
| `frontend/src/pages/AdminStudents.tsx` | Uses that key total as Net Paid, in aggregate statistics, desktop/mobile views and CSV | Use the shared summary, including evidence coverage and source links |
| `frontend/src/pages/AdminSubscribersReport.tsx` | Labels keys as operational value, but exposes the same misleadingly named API fields and whole-shekel rounding | Replace primary monetary columns and exports consistently; keep any key value as an optional operational reference |
| `backend/db.ts:getClientAccountManagementContext` and `AdminClientProfileSheet.tsx` | Activated-key values appear as Gross Sales and Net; the same context also supports refund actions | Use the new summary for display; keep refund-action eligibility and existing mutations separate from this release |
| `financialReports.dashboard` | Uses approved financial ledger entries, with special handling for corrections/reversals | Reuse its source-classification rules and test reconciliation; do not replace finance totals with order/key prices |
| Orders and service views | Order commercial totals, financial confirmation, issued keys and effective access can differ | Label each fact; expose paid-but-unused keys and access discrepancies without automatically repairing them |

### Read-only production baseline

The aggregate query in `scripts/sql/client-payment-reporting-audit.sql` ran successfully on production on 28 October. It returned no client identities. Its measurements were 1,384 rows read, zero rows written, `changed_db=false`, and 11.87 ms SQL time. Counts are source-record counts, not counts of distinct affected clients; categories can overlap.

| Measure | Observed |
| --- | ---: |
| Non-staff client accounts | 170 |
| Orders | 145 |
| Paid/completed orders | 94 |
| Paid/completed orders without payment confirmation | 51 |
| Payment confirmations / approved payment entries | 43 / 43 |
| Confirmations without an approved payment entry | 0 |
| Approved payment entries without an order | 0 |
| Approved payment entry total, before any future correction/refund | ILS 53,400.00 |
| Activated package keys | 129 |
| Activated priced manual package keys without an order | 71 |
| Active unused keys linked to confirmed orders | 5 |
| Account refunds / approved corrections or reversals | 0 / 0 |
| Materialized reconciliation items / legacy migration records | 0 / 0 |
| Gift orders | 0 |

The ILS 53,400 total is recorded approved payment evidence, not a claim about lifetime customer payments. The 51 historical orders and 71 manual keys need evidence review; they must not be silently added to it. An empty reconciliation queue does not establish clean history.

Production table/column/index metadata was inspected read-only. Existing useful indexes include `uq_financial_ledger_payment_order`, `uq_financial_ledger_source_event`, `idx_financial_ledger_source_link`, `idx_orders_financial_reconciliation_status_id`, `idx_registration_keys_order_package`, and the account-refund user/key/order indexes. General client/order attribution queries still need exact query-plan validation; no new index is assumed necessary yet.

The first aggregate audit formulation exceeded D1's compound-SELECT limit. It was replaced with one SELECT containing scalar aggregates; only that corrected query is retained. This is a one-time audit query, not a request-time implementation.

### Local baseline verification already run

- Six existing focused files: 24 tests passed, one failed. The existing `adminSubscribersReportUi.test.ts` expects obsolete CSV text (`Gross Spent (ILS)`). The release must replace this stale assertion with meaningful summary/export coverage rather than restore the misleading labels.
- Three new audit-query tests passed: empty sources/zero writes, missing confirmation versus unused keys without duplicate cash, and unmatched payment/refund references. These use minimal physical-column fixtures, not the full release migration fixture.
- No new payment-summary implementation exists yet. UI/browser validation of corrected behavior, full schema-contract tests, builds and post-deployment checks remain pending.
- Raw aggregate evidence is kept in ignored `tmp/client-payment-reporting-baseline-2026-10-28.json`. Do not add customer receipts, credentials or production database dumps to Git.

## Reporting contract

### Amounts and evidence coverage

| Field/label | Rule |
| --- | --- |
| Confirmed receipts | Approved client-attributed payment evidence with applicable approved corrections/reversals. Payment confirmation and its ledger row represent one event, never two receipts |
| Confirmed refunds | Approved client-attributed refund evidence, with linked reversals handled once. The original refund record and ledger row represent one refund |
| Net confirmed paid | Confirmed receipts minus confirmed refunds; preserve signed results and exact minor units |
| Historical records needing review | Count and source references for completed historical orders, manual commercial keys and other unresolved evidence gaps; amounts shown only as separately labeled recorded order/key values |
| Coverage | `recorded_evidence_only`, `needs_reconciliation`, `no_payment_recorded`, or `unavailable`, plus reasons and generated timestamp. Do not label a client's lifetime history complete merely because no detectable gap exists |
| Operational key value | Optional separately labeled reference. Never used for confirmed receipts, refunds, net paid, revenue, debt or credit |
| Service status | Purchased package/service, key issued/used, and effective active/pending/expired/frozen/revoked status, evaluated by existing access rules |

If no confirmed cash exists but historical evidence does, display "Historical payments need verification" rather than a prominent paid-zero figure. A mixed history can display "ILS 350 confirmed; historical payments need verification." A source/query failure displays "Unavailable" rather than zero. Complimentary/migration access is labeled by its authorized source, without invented cash.

No "amount due" is calculated from missing receipts. Pending orders remain pending; cancelled/refunded operational order status alone cannot erase a historical cash receipt. A verified receipt must not be omitted because its key is unused or its service expired.

### Attribution and deduplication

1. Attribute financial purchases to `orders.userId` and immutable source links, not a current key email. For gifts, the payer owns payment history; the recipient owns operational access. Show the relationship explicitly.
2. Resolve refunds through `account_refunds.user_id`/linked order and key; count the financial event once. A refund without matching approved financial evidence is a reconciliation flag, not a second subtraction.
3. Manual-key-only history stays unverified unless an existing authorized financial reconciliation establishes a monetary event and client attribution. Legacy migration is operational and has no new cash impact.
4. Use integer ILS minor units and the ledger's recorded ILS values. Do not reconvert recognized historical money using today's rate or apply package-price conversion to a cash receipt. Commercial order/key projections stay separate and retain their established currency rules.
5. Resolve approved replacements/reclassifications and reversal chains by linked source identity. Reclassification must not duplicate cash. Draft/rejected adjustments, expenses and general opening balances cannot inflate a client's paid amount. Ambiguous/unattributed adjustments remain outside client totals and appear in a reconciliation bridge.
6. Reconcile client totals against finance for the same client universe and time scope, with explicit buckets for non-client, unallocated and correction-policy differences. Do not force equality by distributing unmatched money. Any disagreement in shared correction/refund semantics must be resolved and regression-tested before release.
7. Multiple items, keys, service subscriptions or refunds cannot multiply an order payment through joins. Aggregate each financial event first, then attach its client and operational references.

### Staff visibility

Use the same summary calculation for support/admin roles authorized to look up clients. Provide only the client-level amounts, coverage, source IDs and operational status needed for support. Enforce visibility on the server, including exports; UI hiding is insufficient. Preserve existing finance-only access to private receipts, full ledger, adjustments, reconciliation approval and refund recording. No role gains mutation authority through this change.

Explicitly test admin, support, key manager, finance owner/manager/viewer, limited lookup roles, customer and anonymous requests. Review the current inconsistency between broad `reports.subscribers` access and the client-list financial column restrictions before implementing the final response projection. Unauthorized financial fields must be omitted from the response, not filled with zero.

## Implementation sequence

1. **Freeze definitions and compatibility.** Add a typed summary contract, bilingual labels, coverage reasons and attribution/classification rules. Keep old key-total fields temporarily for compatibility, clearly deprecated; never silently change `totalSpentIls` to mean cash. New displays use explicit fields. Version/feature-detect the summary so an old API/new frontend combination shows unavailable rather than falling back to key totals.
2. **Build one shared read service.** Use it from subscriber reporting and client profiles. Separate financial classification from operational service evaluation. Bulk list enrichment must aggregate once and use maps/batched queries; no query per client and no client-by-key nested scans added. Bound profile histories and source details, disclose truncation, and include a generated timestamp.
3. **Cover all visible surfaces.** Update client-list cards/statistics, desktop/mobile tables, profile totals, subscribers report, sorting, column settings and CSV/PDF exports. Audit other staff/student order/payment labels so order value and confirmed money cannot be confused. Remove any client-list statistic called revenue if it sums operational keys or an incomplete client subset.
4. **Add source explanations and follow-up status.** Make a misleading amount explainable from order/payment/refund IDs, with review flags and paid-but-unused-key indicators. Reuse existing finance reconciliation tooling for authorized follow-up; simply opening a report must not materialize queues, send messages or mutate data.
5. **Prove local correctness, permissions and performance.** Complete the gates below. Only after the exact SQL is chosen decide whether a narrowly scoped additive index migration is needed.
6. **Prepare a reviewable release.** Record source/artifact IDs, test results, measured costs, live baseline and rollback targets. Obtain release authorization before production deployment or a schema/data change. Reporting deployment and individual financial/access repairs are separate approvals and evidence records.

## Local verification gates

Use a disposable synthetic database with production physical table/column names, constraints, triggers and relevant migrations. Existing local production snapshots are stale and contain sensitive data; no full production export is required for this reporting change. Keep external email, AI, cron and storage mutations captured/disabled in the local harness.

| Scenario | Required result |
| --- | --- |
| Basic, Comprehensive, upgrade, Live and Copier | Confirmed cash follows the receipt/ledger source, not the current package or activation key |
| Confirmed purchase with unused key | Money appears once; activation remains pending |
| Historical completed order without confirmation | Coverage warns; commercial total is not recognized as cash |
| Manual/renewal keys; changed email; no initial-sale key | References remain operational/unverified; payer identity is not reassigned by email matching |
| Gift and multiple items/keys | One payment attributed to payer; beneficiary access separate; no fan-out multiplication |
| Partial/full refund, retries, unmatched legacy refund | Correct signed minor-unit net, no duplicate subtraction, unresolved evidence flagged |
| Payment/refund reversal and financial replacement/reclassification | Exact source-linked correction once; same interpretation as finance or an explicit reconciled bridge |
| Complimentary/internal/compensation/migration access | Correct source/status and zero newly recognized cash |
| USD/ILS historic prices, discounts and fractions | Ledger ILS value unchanged; UI/export retain two-decimal accuracy where needed |
| Expired/frozen/pending/revoked services | Effective status uses existing lifecycle rules; never presented as an unpaid balance |
| Missing/ambiguous sources, failed query, old API, truncated history | Explicit coverage/unavailable/truncation; no fallback to key-price paid totals |
| Each authorized and unauthorized role | Correct server response projection, exports and route rejection |
| No confirmed receipts and no history | "No payment recorded"; no assertion that lifetime paid is definitively zero |

An Omar-shaped synthetic fixture must reproduce the old ILS 700 key total while the new summary shows ILS 350 recorded confirmed renewal, incomplete historical coverage, an unused renewal key, and separately labeled historical Live order value. It must not invent an original Comprehensive payment or automatically grant access. Hala is excluded from individual production mutation/repair checks.

Run behavior-level calculations and SQL/D1 contract tests, route/permission tests, export consistency tests and Playwright checks of Arabic/English desktop/mobile roles. Reuse focused financial-reporting, confirmation, reconciliation, authorization and account-refund regressions; replace the stale subscriber assertion. Then run TypeScript, app/Worker builds, the critical business cycle, and `git diff --check`.

For each changed query, execute the exact SQL/bindings against the fixture and run EXPLAIN QUERY PLAN. Validate the intended physical columns and index names against read-only production metadata before deployment. Measure present-size and 10x synthetic data: D1 rows read, response size, Worker CPU and endpoint latency. No new polling, cron, external provider call or background reconciliation is planned. Block a material CPU/read-cost increase unless its measured tradeoff is explicitly accepted. An intentional small-table scan needs documented size/cost and projected daily request budget; a new unbounded or unexpected scan blocks release.

## Production verification and rollout

### Before release

1. Refresh aggregate counts and source metadata; record collection time. Production changes naturally, so compare a consistent read/query snapshot and explain new business transactions instead of expecting an old snapshot to remain identical.
2. Record actual current Worker/Pages IDs and source hashes; do not copy stale IDs from older runbooks. Record the D1 recovery bookmark and verify rollback artifacts. This read-only reporting release should not need a full database export or restore.
3. Run EXPLAIN for the exact proposed queries via read-only commands. Check columns/indexes and measure row costs before publishing. New SQL must have already passed local contracts.
4. Compute the candidate summary read-only for all clients in bounded batches or a measured bulk query. Compare amounts, coverage and attribution with independent source aggregates. Record exact eligible-source ID/value parity as well as grand totals, so offsetting client misattributions cannot pass a total-only check. Keep identities/private evidence out of committed output.
5. Check representative cases from every existing source pattern and each detected anomaly. Patterns absent from production (currently gifts/refunds/corrections) stay synthetic-only in the verification record; do not create production transactions to exercise them.

### Promotion

1. Ship the additive, backwards-compatible Worker response first. Read-only checks must confirm the new summary and existing checkout/payment/activation endpoints remain healthy before Pages promotion.
2. If an index migration is demonstrated necessary, review/apply it as a separate approved additive migration before the Worker; record before/after row counts and migration ledger. No historical financial backfill is bundled with it.
3. Promote the verified Pages artifact. Confirm live source/deployment IDs and affected asset hashes. Avoid a mixed-version fallback that exposes old key totals under new paid labels.
4. Use authorized authenticated admin/support sessions for read-only list/profile/report comparisons and exports. Verify identical amounts/coverage between surfaces, Arabic/English and desktop/mobile. If such sessions are unavailable, record that limitation and leave role/UI acceptance pending; public health checks alone do not certify staff reporting.
5. Check anonymous/customer/limited-role rejection with the correct endpoints. Compare matched client IDs and reporting timestamps; do not treat differences caused by filters, permissions or newly posted payments as a calculation defect.
6. Re-run the aggregate/source checks and critical read-only smoke tests. Confirm reporting requests themselves wrote zero business records and caused no notifications, activations or payment changes. Ordinary independent customer/cron activity may still change the live database.
7. Observe comparable Worker error/latency/CPU and D1 reads after promotion, including normal staff use and a daily-job cycle. Record observation windows honestly; do not claim a completed day immediately after deployment.

Remote staging currently shares production D1 and media resources. `docs/security-staging-isolation.md` and the staging preflight prohibit treating it as a safe write-test environment. Use local fixtures unless actual resource, credential, origin and outbound integration isolation is provisioned and verified separately.

### Acceptance and rollback

Release acceptance requires exact per-client amount/source parity, explicit historical gaps, no duplicated events, consistent UI/export values, server-enforced role scope, no lifecycle/mutation regression and acceptable measured costs. Any unexplained monetary/attribution difference, missing evidence hidden as zero, unauthorized field exposure, failed critical path or material cost regression stops promotion.

Keep the new display gated/disableable for rollback. Restore the previous Pages artifact first if needed, then the previous Worker when compatible. Because the old display is known to be misleading, disabling the affected money columns with a temporary review notice is preferable to presenting them as authoritative paid totals. Preserve current customer data; do not restore D1 as routine rollback. Review any actual bad writes separately—none are expected from this read-only design.

## Follow-up after reporting is accepted

Finance reviews historical evidence and records approved, auditable reconciliation through existing controlled workflows. Access operators separately address paid-but-unused keys or missing entitlements according to verified purchase terms. Do not mass-activate renewals, rewrite completed orders, collect duplicate money, backdate services or delete orders to make totals agree. Omar's case can be a separately approved repair once terms are verified. Hala remains paused until the owner resumes her case.

## Review decisions

Recommended default: implement the read-only reporting correction first, with summary visibility for authorized client-support/admin lookup and private evidence restricted to finance. Preserve existing financial/access mutation authority. Historical reconciliation and service repairs follow individually. Any new index or permission expansion must be explicit in the release diff and verification record.

Next deliverable: implementation diff plus local evidence and candidate read-only production reconciliation. Deployment authorization is requested only when that candidate is concrete and reviewable.
