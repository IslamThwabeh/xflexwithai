# Finance dashboard accuracy and receipt visibility

Status: implemented locally; production release pending. Applies to `/admin/dashboard` and `/admin/finance`.

## Business requirements in English

1. Make recommendations performance visible to all signed-in customer/student accounts, whether or not they subscribe to recommendations. Show daily, weekly and monthly aggregate reported pip progress without revealing individual trades to non-subscribers. Provide a clearly disclosed illustrative dollar calculation. This request is deployed; see [recommendation-performance.md](recommendation-performance.md).
2. Make the financial and main admin dashboards reflect money actually recorded as received, rather than treating repeated actions, key activations or upgrades as additional sales. Investigate both dashboards, correct reporting errors and make the figures understandable for the business owner and finance manager.

The owner confirmed All services as the default, with visible Academy/Copier subtotals and a receipt-scope filter. A legitimate paid upgrade or Copier payment remains a receipt. Repeating an operational action without a confirmed financial posting does not create report income.

## Investigation and source evidence

- Main admin cash was derived from priced activated package keys minus account refunds, presented as Net Income. Key activation measures access, not a confirmed cash receipt. The general admin stats response now contains operational counts only; financial totals use a separate finance-authorized query.
- The financial dashboard defaulted to January 1–today. It now defaults to the current UTC month through today; explicit This month, Last month and Year to date controls make the range visible.
- The original Confirmed income card ignored receipt reversals/replacements although another net card applied them. The new headline uses the corrected receipt figure consistently on both screens.
- Copier cash was included without its own classification. It now has a visible subtotal and scope filter.
- Replacement adjustments could become income even when correcting a refund or expense; absolute-value normalization obscured refunds/expenses reversed in a later month. Corrections now inherit the original source kind, with signed effects on their own effective dates.
- Opening balances and unallocated adjustments were included in operating profit. They now appear separately in the bridge to ledger movement.
- Cached financial data did not partition by verified account and finance role. New keys include both, old scopes are removed after access verification, and money is hidden while access is revalidated or denied.
- Reapplying unchanged filters did not reliably refresh. Apply range now refreshes an unchanged range, and explicit Refresh is available on both screens. Draft date changes are labeled until applied.
- Main admin pending orders omitted `awaiting_confirmation`; both pending states now count.

Read-only production aggregate audit found November payments of **₪40,075**, with a **−₪2,000 reversal** and **+₪300 replacement**, giving **₪38,375** corrected receipts: **₪25,375 Academy** and **₪13,000 Copier**. The audit found 85 payment confirmations, each linked to an approved payment, and no duplicate payment-order groups, shared nonempty payment-reference groups, invalid effective dates, missing reversal parents or reporting-month mismatches in that snapshot. These checks do not prove external bank/cash accuracy or detect every possible human-entry mistake. No customer identities, raw transaction payloads or payment references were exported for the finance audit.

## Calculation contract

All amounts use integer ILS minor units. Both screens call `loadFinancialReport`; shared scope and CSV helpers avoid divergent calculations.

| Measure | Definition |
| --- | --- |
| Recorded receipts | Approved payment roots plus eligible owner-approved known-date historical receipts |
| Receipt corrections | Signed reversals, replacements and reclassification legs whose original source is a receipt |
| Net confirmed receipts | Recorded receipts + receipt corrections |
| Net refunds | Negated sum of approved refund roots and their signed corrections |
| Receipts after refunds | Net confirmed receipts − net refunds |
| Net approved expenses | Negated sum of approved expense roots and their signed corrections |
| Operating cash result | Receipts after refunds − net approved expenses |
| Net ledger movement | Operating cash result + opening balances + unallocated adjustments |

The receipt categories sum to net confirmed receipts: new sales + paid renewals + paid upgrades + Copier + unclassified. Academy comprises the three known non-Copier purposes. Unclassified receipts/refunds remain in All services and carry a review warning. Scoped receipts/refunds never imply an allocated business-unit profit: expenses are not assigned to Academy/Copier, and the operating result is explicitly All services.

Refund classification follows the linked immutable payment and a complete balanced owner reclassification, even outside the selected range. Reversed/incomplete classifications remain unclassified. Explicit source classifications remain authoritative. Corrections are recognized on their own effective date, so a later-period refund/expense reversal can legitimately produce a negative net refund/expense.

Historical known-date decisions follow the existing recognition policy: if the same immutable order already has a confirmed payment, its historical adjustment is excluded from receipts, retained in the ledger bridge and flagged. Opening balances never become operating income. Shared payment references are review indicators, not automatic deductions. Report receipt counts count roots, not correction legs.

## Performance and access

- One indexed selected-range source read; ancestors only when needed, using bound JSON groups of at most 500 IDs and integer-PK lookups. Refund payment lookups use the existing unique order/payment index. Owner reclassification/refund checks use existing source-reference and reversal indexes.
- At most 10,000 selected source rows, 20,000 ancestry context rows and 32 ancestry levels. The report fails clearly on excessive ranges or missing/cyclic/conflicting sources; it never sums a truncated subset. Displayed owner/manager ledger detail is separately capped at 100 rows and labeled when truncated.
- No added database migration, runtime dependency, background job, schedule or financial mutation. Scope/language/display/CSV/print changes reuse the loaded report. Dates fetch on Apply/preset/Refresh; no report polling, focus/reconnect refresh or automatic retries.
- Browser snapshots have one five-minute remount freshness budget measured from server generation. Snapshot time is always displayed; an open page does not poll. Access verification is a separate lightweight query and rechecks on focus. Network failures are visible; any retained monetary snapshot is labeled as previously saved.
- Known cash workflows mark both saved report types stale on success/error, with no immediate report refetch: payments, Copier confirmations, expense approval, corrections, historical decisions and refund/account-block operations. This also covers a payment committed before a later issuance error. The next report mount loads updated figures; unrelated/draft changes do not invalidate reports. Other staff/browser changes still require explicit refresh.
- Summary responses contain no ledger details. Owner/manager can see the existing capped detail; viewer receives no ledger. Clerks and other admins without report authority receive no financial totals. Server authority remains decisive; client-supplied account/access values cannot grant permission.
- Report dates remain UTC, while snapshot/entry display timestamps reuse Palestine/Asia-Hebron helpers. CSV includes applied range, receipt scope, UTC snapshot and both selected-scope/all-service figures. Print uses the same loaded report.

## Local validation

Evidence is ignored under `output/finance-dashboard-review/` and `output/playwright/finance-dashboard/`. The schema rehearsal seeds synthetic transactions matching the production aggregate; it is not a raw production finance export. It uses captured production table/index/trigger DDL and synthetic completed-order prerequisites, preserving existing payment guards. Forty entries reproduced all November amounts in one report query, about 26 ms locally, with a 13,149-byte owner payload. This is not a production latency or CPU guarantee.

The initial finance regression suite passed 16 files / 96 tests, including real SQLite/D1 execution, cross-period corrections, receipt classifications, historical recognition, ambiguity, privacy, scope spoofing, date/index behavior and complete-source limits. Initial broad parallel execution timed out under concurrent builds; rerunning with two workers passed. Isolated finance plus critical workflow verification covered 54 files / 362 distinct tests: the initial run passed 361 and identified one obsolete source-text assertion for the old inline CSV; its updated ILS/refund contract and the final index change passed all 19 tests in the two affected files. Final cache verification passed 12 tests/three files, including three additional real-QueryClient tests for successful cash posting, a failed posting workflow and unrelated/draft operations with zero background report reads. This brings coverage to 55 files / 365 distinct tests (17 finance files / 99 tests). No failing check remains. Isolated TypeScript, application/server and Worker builds passed.

Six exact production EXPLAIN statements all succeeded with zero business rows read, zero writes and unchanged database metadata. The initial gate exposed SQLite choosing a broad approved-status index for refund-linked payment reads; the final query explicitly uses `uq_financial_ledger_payment_order`, and the repeated gate confirms order-ID/rowid search. Source/expense/ancestor/historical/reclassification/reversal paths use existing date, PK or source-reference indexes. The existing general-dashboard pending-order count still scans the orders table; including the second pending status does not introduce a new financial history read or new query.

The exact isolated built assets passed 33 browser assertions: both screens reconcile to the same November total, all-service defaults and subtotals, no report requests for scope/date typing, explicit Apply/Refresh, CSV applied-range metadata and print invocation, English and Arabic desktop/mobile (1440/390/320 px) without page overflow, owner→viewer→manager→revoked role transitions, foreign-account query keys, errors with retained-snapshot labeling, unsupported report version and empty state. No unknown fixture API or application exceptions occurred. Browser requests were intercepted; external services were blocked. Real authenticated production journeys, physical Safari and an independent bank/cash reconciliation remain unverified.

## Release and operational limits

Finish the finance-only isolated checks before committing/deploying. Preserve the unrelated staff-review work. Deploy Worker before Pages; verify health, anonymous denial, private routes/assets and unchanged bindings/schedules. No migration or business-data repair is part of this release. Prior production deployment approval was for the recommendations feature; obtain scoped finance-release authorization after local review.

Recorded approved cash remains dependent on correct payment confirmation and owner correction workflows. These dashboards cannot independently verify cash possession or bank settlement. Reclassification, invoice accounting, expense allocation and external statement reconciliation must not be inferred from operational events.
