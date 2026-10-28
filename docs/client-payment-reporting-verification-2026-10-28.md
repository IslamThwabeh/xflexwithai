# Client payment reporting implementation and verification

28 October 2026, Asia/Amman. Candidate implementation; production deployment remains a separate release step under the [rollout plan](client-payment-reporting-plan-2026-10-28.md).

## Result

Client lists, profiles and subscriber exports now consume one typed approved-payment summary. The UI shows confirmed receipts/refunds/net, historical evidence coverage, and unused paid keys. It no longer derives paid totals or client-list revenue from activated-key prices. Historical gaps do not become debt or a request to purchase again. Mixed API versions, source failures, source ceilings and unsafe totals show unavailable evidence instead of a paid-zero fallback.

Financial purchases follow the order's payer ID; recipient/key email is only used for unverified manual-key hints. Multiple keys do not multiply receipts. Signed linked refunds, replacements, reclassifications and reversals are resolved by source identity. Approved historical order adjustments can be attributed through their immutable order; manual-key historical adjustments without a stable payer link remain in the unallocated bridge. Duplicate historical/ordinary payment evidence is flagged for review.

Support, key managers, client lookup, admins and finance managers/viewers receive the client-level summary. Finance managers/viewers gain the client-list/report read routes; no financial or access mutation permission is added. Limited operational roles receive neither the summary nor the legacy monetary totals. Private finance evidence and mutation controls retain their existing authorization. A report link is available in the Students navigation section.

No schema migration, backfill, order edit, entitlement activation, payment/refund creation, notification or customer message is included. Hala's individual case remains paused. Omar's access repair is separate from this reporting change.

## Production candidate reconciliation: read-only

Candidate source SQL and an independent SQL attribution/grouping query were evaluated from the same production read snapshot using `scripts/verify-client-payment-summaries.ts`. Only aggregate validation is saved; no customer identities or receipts are committed.

Snapshot at **16:53:18 Asia/Amman**:

| Check | Result |
| --- | ---: |
| Client accounts compared | 170 |
| Source orders / approved ledger entries / confirmations / keys | 145 / 43 / 43 / 194 |
| Refund / reconciliation source rows | 0 / 0 |
| Per-client amount or attributed source-ID differences | 0 |
| Bulk-list versus single-client calculation differences | 0 |
| Recorded confirmed receipts / refunds / net | ILS 53,400 / 0 / 53,400 |
| Clients with historical review flags | 93 |
| Clients with recorded evidence only | 31 |
| Clients with no payment recorded | 46 |
| Unattributed recognized money / excluded adjustment bridge | 0 / 0 |
| Business rows written by verification | 0 |

This compares candidate calculations against production sources. It does **not** claim the new code is deployed or that authenticated live staff UI acceptance has happened. Production currently has no refund, gift or correction examples, so those behaviors were checked synthetically. The verifier stops rather than certifies an unexplained complex correction cohort; its explicit bridge must be independently checked before a future release with such data.

Evidence: ignored `tmp/client-payment-candidate-production-verification.json` and `tmp/client-payment-production-check.log`. Raw source rows are not written by the verifier. Earlier aggregate baseline remains in `tmp/client-payment-reporting-baseline-2026-10-28.json`.

## Read and CPU costs

The exact six source statements were EXPLAINed and measured on production. Total additional source work was **470 rows read** per authorized summary request: orders 145, approved ledger 86, confirmations 43, keys 194, empty refunds/reconciliation tables one each. Ledger access uses `idx_financial_ledger_approved_period`; ordering its 43 approved entries uses a temporary B-tree. Other sources deliberately make one ordered pass over the measured small tables. There are no per-client SQL subqueries or N+1 reads. Each source is limited to 5,001 rows; exceeding the supported 5,000-source-row ceiling makes monetary summaries unavailable rather than partial.

These intentional small-table scans are accepted for the current measured source sizes. At 1,000 authorized report/profile reads per day they add approximately 470,000 D1 rows read, 9.4% of the project's 5-million-row daily benchmark, excluding all existing application work. No new polling, cron or provider request is introduced. Measure real endpoint traffic after promotion; if existing activity cannot accommodate that increment, leave reporting disabled until a lower-cost design is verified. No new index is justified at current sizes. Growth approaching the ceiling requires a selective/paginated design and a new query-plan review.

Local Node 24.22.1 synthetic calculation benchmark, 100 samples after warm-up:

| Dataset | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: |
| 170 clients / 425 source rows | 0.27 ms | 0.80 ms | 1.26 ms |
| 1,700 clients / 4,250 source rows | 4.41 ms | 11.13 ms | 13.63 ms |

These are local calculation times, **not deployed Worker CPU or request latency**. The production snapshot query read 777 rows in 9.02 ms; that query also includes independent audit aggregates and is not the request-time implementation. Actual deployed endpoint CPU/latency and normal daily usage still need post-promotion observation.

## Local verification

- **86/86 tests passed across 15 focused files**, including source calculations, migrated physical SQLite queries, authorization, exports, financial reporting, payment confirmation, reconciliation, controls and refunds. The superseded subscriber CSV terminology assertion now checks exact confirmed minor-unit values and unavailable/incomplete coverage. Finance navigation expectations explicitly include the approved read routes.
- **209/209 critical-cycle tests passed across 33 files.** TypeScript passed during implementation; the final artifact/typecheck gates are recorded below when complete.
- The first broader concurrent run hit two existing reconciliation-test 5-second timeouts while other compilation/browser work was active. The final run used two workers and passed without changing those test timeouts or production logic.
- Synthetic browser checks passed for support English desktop, support Arabic mobile, admin subscriber report, finance viewer client access, limited-role monetary suppression, and unavailable sources. The client profile independently showed receipts 350.01, refunds 1.01 and net 349.00 with historical coverage and source references. Screenshots are in ignored `output/playwright/client-payments-*` and were visually inspected for Arabic layout and profile rendering.
- The downloaded subscriber CSV contains those exact three monetary values, `needs_reconciliation`, historical order/key counts, unused-key count and source timestamp. The existing PDF action invoked printing once and retained the same displayed net and warning. No real payment, customer session or native print dialog was used.
- Two initial browser assertions were corrected: one selected a hidden mobile duplicate in the desktop DOM, and another expected Western digits in correctly localized Arabic currency. The final matrix passed; these were harness failures, not product changes.

## Release and rollback

The default-enabled `CLIENT_PAYMENT_SUMMARIES_ENABLED` environment switch can be set to `false` to suppress corrected monetary figures and the six new reads while retaining client operational access. The UI displays payment information unavailable and does not fall back to old key totals. Preserve all other Worker variables/bindings when changing this switch.

Before deployment, record fresh live Worker/Pages identities and source hashes and verify the D1 recovery bookmark. Build from the final reviewed tree. Promote Worker first, verify health/authorization/new response, then Pages; check matching artifacts and read-only staff views. No D1 migration or customer-data write is needed. Re-run source parity after promotion and observe comparable D1/CPU/error metrics. If an authenticated production staff session is unavailable, disclose the remaining UI acceptance limit.

Rollback should disable the corrected monetary display or restore compatible code without restoring the database. Do not present the old activated-key values as authoritative paid totals. Routine rollback must preserve customer transactions created after this candidate was prepared.

## Final gates

Final frontend/standalone and Worker builds passed, including SEO generation (36 public pages and six article pages). Final TypeScript passed. The frontend retains the existing large-chunk advisory; no new build failure was introduced. `git diff --check` passed. Local source and artifacts are ready for release review. Deployment and authenticated post-deployment checks are not recorded as completed in this document.
