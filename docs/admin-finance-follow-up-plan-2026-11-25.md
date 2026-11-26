# Admin, finance and student-report follow-up plan

Created: 2026-11-25. Updated: 2026-11-26. Status: first implementation batch verified locally; real student desktop review completed; follow-up release and remaining plan items pending.

This is the checklist for the follow-up work agreed after the signed-in Chrome review. Keep the stable IDs below when splitting work into releases. Mark an item complete only after its acceptance criteria are verified, and add the evidence/date in the progress log. Do not treat approval of recommendations as approval to cancel orders, approve payments, rewrite historical records or send messages.

## Scope and existing work

- Recommendations performance and the cash-reporting improvements are already deployed. This plan covers the subsequent admin review findings and the remaining student/communication work.
- Signed-in admin review covered home, orders, financial dashboard, expenses, financial controls, historical reconciliation, customer payments and activation activity. It used Chrome through native Computer Use because the Chrome connector host was unavailable.
- No order status, payment, expense, correction, period lock, feature setting or historical-review decision was deliberately changed during that review. No follow-up application changes have been implemented by creating this plan.
- Existing feature records: [recommendations performance](recommendation-performance.md), [finance dashboard accuracy](finance-dashboard-accuracy.md), [order approval](admin-order-approval.md), and [client-payment reporting](client-payment-reporting-plan-2026-10-28.md).
- Preserve unrelated pending staff-access/navigation and paid-plan investigation changes. In particular, the working copy of `DashboardLayout.tsx` already differs from the deployed source; reconcile scope before editing or releasing shared navigation.
- Keep private release/recovery identifiers, credentials, raw customer data and project-memory contents out of student-facing copy and WhatsApp drafts.

## Review observations — dated snapshots, not permanent totals

| Observation | Evidence from the 2026-11-25 review |
| --- | --- |
| Earlier November snapshot | ₪38,375; Academy ₪25,375; Copier ₪13,000; 38 receipt roots and two correction entries. |
| Later November snapshot | ₪40,075; Academy ₪27,075; Copier ₪13,000; 39 receipt roots and two correction entries. Newly recorded payment for order #203, ₪1,700, explains the increase. Home and finance agreed after refresh. |
| Outstanding orders | Ten Pending plus one Awaiting Confirmation; two were created on November 25, while nine were from July–September. The separate Paid queue was empty at review time. |
| Expenses | The expense register showed no entries. The operating cash result does not include expenses that have not been entered. |
| Historical reconciliation | 180 unresolved items displayed. Proposed historical amounts are not confirmed receipts or proof of an amount due. |
| Customer report | 199 accounts were called “subscribers”; country values included city names and spelling variants. |
| Key counts | Home showed 140 activated keys with an active flag; activation history showed 152 historical activations. These use different definitions. |

Refresh the relevant screens before making decisions or finalizing either WhatsApp message. Never hardcode these snapshots as current figures or infer a reporting defect merely because a newer receipt changed a total.

## Recommended delivery sequence

1. **Baseline and student access:** preserve current behavior and carry out S01–S08 when the user signs in as the student. This can happen before the admin changes; recheck affected journeys afterward.
2. **Home and navigation cleanup:** R01–R07 and R24. Ship a small, independently reviewable batch with no order or financial-record changes.
3. **Order and financial reliability:** R08–R16, R18 and R22. Cancellation safeguards can be implemented without cancelling any real order. Treat checkout/schema changes and financial business-rule changes as explicit implementation decisions.
4. **Historical/customer reporting and scale:** R17, R19–R21, R23 and R25. Preserve complete-money calculations and existing source limits while improving access to detail.
5. **Business review of old orders:** use the order decision register below. Close only specifically reviewed and approved cases; legitimate outstanding requests remain open with a clear next action.
6. **Final acceptance and handover:** finish F01–F08, update memory/history, finalize both Arabic WhatsApp drafts and deliver them to the user. Sending either draft is a separate action requiring explicit instructions.

Work in small batches. Do not wait for all 25 items to build a single large release, and do not let an unresolved order decision block independent interface work. Before each release, confirm its scope against the current session authorization, verify the exact source/artifacts and preserve unrelated changes. Deploy Worker before Pages when both change.

## Complete implementation checklist — all 25 recommendations

- [x] **R01 — Remove the home Features Center promotion.** Retire the large launch/readiness card and redundant enabled badges. Preserve enabled features, necessary configuration and useful preview access under an appropriate Settings/workspace entry. Acceptance: no home promotion, no feature disabled, no useful page left unreachable.
- [x] **R02 — One page title and greeting.** Replace repeated topbar/body titles with a consistent header/breadcrumb pattern across the reviewed admin pages. Acceptance: one meaningful page H1, no repeated welcome copy, accessible navigation and report print titles preserved in Arabic and English.
- [x] **R03 — Put financial figures above the fold.** Compact introductory text, filters and snapshot information so the useful cash summary appears early. Acceptance: desktop and narrow-screen layouts remain readable without hiding the applied range, receipt scope or snapshot time.
- [x] **R04 — Consolidate repeated pending-order indicators.** Replace the warning/task/stat repetition with one useful attention area and compact navigation. Acceptance: one clear outstanding-order summary; empty task groups do not dominate home and remain reachable when needed.
- [x] **R05 — Distinguish new from unresolved work.** Do not call months-old requests “new tasks.” Acceptance: labels distinguish unread/new notifications from outstanding business requests, with meaningful age or period context.
- [x] **R06 — Review links open the matching queue.** Support an outstanding view covering Pending and Awaiting Confirmation. Acceptance: the home count, linked list, pagination and filters use the same eligibility rules; All orders remains available separately.
- [x] **R07 — Useful order summaries and context.** Show package/service, request age, receipt presence, intended recipient and related completed orders. Acceptance: staff can understand what is being purchased and find the relevant customer/order history before opening financial controls; detailed evidence loads on demand where practical.
- [ ] **R08 — Audited cancellation safeguards.** Require confirmation and a reason; surface payment/evidence/key relationships before closure. Acceptance: the server rechecks eligibility and preserves original orders, receipts, legal consent, keys, delivery history, actor and reason. A confirmed payment uses the appropriate financial workflow; no real order is cancelled as a test.
- [ ] **R09 — Prevent repeated checkout submissions.** Use server-enforced idempotency for the same checkout intent and handle retries/double clicks safely. Acceptance: repeated submissions do not create additional orders for one intent; changed baskets, recipients, gifts, renewals or genuine new purchases remain possible. Never deduplicate cash by customer and amount alone.
- [ ] **R10 — Correct ILS component rounding.** Resolve the observed ₪603.44 + ₪96.57 versus ₪700.00 display mismatch using integer minor-unit allocation. Acceptance: displayed subtotal minus discount plus VAT equals the displayed total across existing ILS and legacy commercial-price conversions, packages, upgrades and discounts. Preserve confirmed cash, historical source values and tax-rate policy.
- [ ] **R11 — Compact, searchable financial controls.** Replace 50 immediately rendered correction forms with a bounded list and a focused action view. Acceptance: an authorized owner can find a specific eligible older entry without loading all history; limits/pagination and the difference between ledger IDs and order IDs are clear.
- [ ] **R12 — Preview financial corrections.** Show the original source, proposed change, effective period, classification and impact before posting. Acceptance: explicit final confirmation, clear locked-period handling, existing authorization/idempotency and append-only audit behavior preserved.
- [ ] **R13 — Align manual-adjustment wording with accounting behavior.** Approved unallocated adjustments belong in the ledger bridge, not automatically in operating P&L. Acceptance: copy explains this and directs receipt/refund/expense corrections to the correct workflow; the displayed equations match the engine.
- [ ] **R14 — Consistent Copier classification and labels.** Resolve the current UI/API asymmetry between existing Copier entries and available reclassification targets. Acceptance: supported choices match the approved business rule, raw codes are replaced by localized labels, and financial category changes never imply changes to customer entitlements.
- [ ] **R15 — Ordinary read-only Refresh on older finance pages.** Add clear refresh/retry controls and snapshot context. Acceptance: rereading figures is separate from the historical queue-building mutation; no polling or hidden background report refresh is introduced.
- [ ] **R16 — Reliable failure, empty and access states.** Distinguish request failure, unavailable data, denied permission and an empty result. Apply identity/role-aware display/cache handling consistently to the remaining financial views. Acceptance: a failed load never becomes a plausible zero/empty report; stale privileged data is not rendered after authority changes, and retry is available.
- [ ] **R17 — Make the historical queue understandable.** Translate issue/treatment/confidence labels and provide useful filters and exact source/context links. Acceptance: an owner can review the relevant source and evidence using bounded, authorized reads; unknown cash/date remains unresolved rather than invented, and decisions remain audited.
- [ ] **R18 — Explain expense coverage and month-end completion.** Show when no expenses have been recorded/approved and provide an expense-entry and reconciliation checklist. Acceptance: the report remains an explicitly defined operating cash result; it never claims to prove complete profit or external bank reconciliation.
- [ ] **R19 — Align customer-report names and metric definitions.** Replace misleading “subscribers” terminology where the population is customer accounts. Acceptance: navigation, heading, counts and exports agree; lifetime payments, paying customers and active subscriptions are distinguished. Any payment-period filter uses payment dates, not account-registration dates.
- [ ] **R20 — Show relevant active services in the customer report.** Include appropriate Copier/other service status and localized package names rather than implying that every paid customer must have an active package. Acceptance: payment evidence and current access remain separate, with existing permission rules and batched access summaries preserved.
- [ ] **R21 — Improve country/city data quality.** Validate future input and normalize known display aliases carefully. Acceptance: city and country fields are distinct, genuine foreign countries are preserved and historical values are reviewed rather than silently overwritten. Academy copy/default labels remain Palestine.
- [ ] **R22 — Consistent, safe exports.** Fix quoted-cell escaping and spreadsheet-formula protection for untrusted text; make current-page/all-filtered and visible-column/full-export choices explicit. Acceptance: CSV/PDF scope, columns, date range, snapshot and totals are clear and consistent; hidden phone/city columns are not silently included contrary to the selected export choice. Preserve legitimate numeric amounts and phone-number text.
- [ ] **R23 — Explain activation-count definitions.** Distinguish current key status from historical activation activity. Acceptance: the home/history difference is understandable, the activation report stays operational rather than financial, and counts are not forcibly made equal by changing their definitions or source data.
- [x] **R24 — Shareable applied filters.** Synchronize applied date/grouping/scope filters with the URL and restore them on navigation/back. Acceptance: copying a link reproduces the applied view; draft input changes remain local until Apply and do not trigger report reads.
- [ ] **R25 — Server pagination and detail on demand.** Bound order/customer/control lists instead of loading whole datasets before local pagination. Acceptance: search, ordering, counts, deep links and exports remain correct; indexed/batched queries avoid per-row lookups and unnecessary reads. Preserve complete-money/source-cap checks and never calculate totals from a truncated page.

## Order decision register — review before any status changes

All findings below are from the November 25 review. Revalidate each order's current state, exact customer/recipient, package/service, receipt, confirmed payment, entitlement/key and related-order links before deciding. A missing attachment does not prove that money was never received outside the system. Related orders are review leads, not proof of duplication.

| Review IDs | Requests and observed dates | Evidence and related orders | Proposed next step | Decision / approver / reason |
| --- | --- | --- | --- | --- |
| O01 | #201, #202 — 2026-11-25 | No visible receipt; same customer has completed #194 from November 23. | Review as recent repeated requests. Do not automatically classify them as abandoned. | Pending |
| O02 | #88, #91 — 2026-09-11/12 | No visible receipts; later completed #93 exists. | Check whether #93 supersedes the same purchase, then propose audited cancellation/archive if appropriate. | Pending |
| O03 | #65, #66, #67 — 2026-08-31 | No visible receipts; later completed #69 exists. | Verify the same package/recipient and payment history before proposing closure. | Pending |
| O04 | #41, #43 — 2026-07-29 | No visible receipts; later completed #48 exists. | Same review before proposing closure. | Pending |
| O05 | #50 — 2026-08-08 | No visible receipt; no related completed order found in the customer search. | Owner/support must establish whether it was abandoned or still needs follow-up. | Pending |
| O06 | #53 — 2026-08-18 | Upgrade with receipt; completed upgrade #54 exists on the same day and also has an attachment. Attachment URLs differ, which does not establish whether the underlying bank transaction differs. | Finance compares both receipts and actual payment/source history before any rejection or historical recognition. | Pending |

- [ ] O07 — Review and approve a specific disposition for **each of the 11 requests**; record reason, reviewer and any superseding order.
- [ ] O08 — Obtain authorization for the exact proposed production actions, then use the normal guarded workflow. Do not hard-delete records, approve old requests to clear the queue, or reuse the special replaced-Live-order retirement workflow for these cases.
- [ ] O09 — Verify the resulting statuses, audit trail, preserved evidence and financial totals. Cancelling an unpaid request is queue cleanup, not an instruction to remove a valid ledger receipt.
- [ ] O10 — Keep legitimate unresolved requests open with an owner and next action. “Clear the queue” means resolve confirmed stale work, not force every request into Cancelled or make the counter zero regardless of evidence.

## Student-account review — required, not yet completed

The user corrected the intended student account to **`islam.thwabeh@gmail.com`** and signed in personally. The account menu identity was verified in Chrome on November 25. Do not request or store credentials, impersonate the account, change its subscription or perform purchases/activations for testing.

- [x] **S01 — Student identity and navigation.** Inspect the real signed-in dashboard and record the exact Arabic tab/menu/page names and paths used to reach recommendations performance. Student navigation remains unverified until this happens.
- [x] **S02 — Access rules.** Check this account's actual subscription state and confirm the aggregate report is accessible as intended. Verify the subscription-independent contract with appropriate local/authorized coverage for the other state; do not change a production subscription merely to test it.
- [x] **S03 — Report periods.** Review daily, weekly and monthly views, selected month changes and available historical/empty states. Daily/weekly totals must reconcile to the same reported-progress monthly basis, including reported progress on open trades.
- [x] **S04 — Clear dates and freshness.** Preserve UTC report periods and Palestine display timestamps. Check the shown snapshot/expiry, manual refresh and meaningful loading/error states; do not add polling.
- [x] **S05 — Student privacy and entitlements.** The aggregate report must not disclose individual trades, instructions, symbols, prices, authors or internal diagnostics. Existing paid live-trade entitlements remain separate and unchanged.
- [x] **S06 — Dollar illustration.** Verify the $100 example and displayed assumptions, pip-to-dollar arithmetic and percentage. It must be clearly illustrative, not actual account profit, executable trading advice or a guaranteed return. Do not execute trades.
- [ ] **S07 — Language and layout.** Review Arabic/English labels and usable desktop/narrow layouts. Record actual device/browser coverage and any untested physical-device limits honestly.
- [ ] **S08 — Final student recheck.** After relevant fixes, repeat the real navigation and key report checks. Save the exact verified path wording for message M01 and record remaining issues before sign-off.

### Actual student review — 2026-11-25

- Verified the user-supplied account identity from the account menu. The learning dashboard showed recommendations expired on July 7, while the aggregate performance report remained accessible. No subscription, purchase, role or customer financial record was changed.
- Real Arabic desktop navigation: **الخدمات ← أداء التوصيات**; English: **Services → Recommendations Performance**; route `/recommendations-performance`. Chrome's browser connector host remained unavailable, so the existing signed-in native Chrome window was reviewed through Computer Use.
- November snapshot: **+34,207 reported pips**, 231 trades with reported progress, 202 positive / 24 negative / 5 breakeven, positive-result rate 89.38%. Weekly values 3,132 + 10,868 + 11,545 + 8,662 + 0 reconcile to the month; the displayed daily changes also reconcile. These are dated observations, not permanent figures or broker-verified cash profit.
- Selecting November 22–28 applied 8,662 pips to the explicit $100 / $0.10-per-pip example: +$866.20, illustrative ending $966.20, +866.2%, before costs. The page clearly states the fixed assumption, lack of compounding/costs and absence of an executable-account/guaranteed-return claim. No trades were executed.
- October showed +10,781 pips and included negative/fractional daily values. January showed the explicit “No scorable pip results” empty-state explanation. Switching view/language and selecting a week did not disclose individual trades, symbols, instructions, authors or prices in the visible report. Source/API privacy and exact read counts remain covered by the existing local tests, rather than inferred from UI inspection.
- Confirmed UTC reporting periods, Sunday–Saturday weeks, Palestine snapshot times, five-minute freshness wording, manual Refresh, Arabic and English desktop layouts. Restored November and Arabic after the review. No deliberate production failure, expired-session test or entitlement change; actual physical mobile/Safari coverage remains unverified. Existing isolated responsive checks remain separate evidence.
- Follow-up usability observations: the first-login navigation announcement occupies substantial space above the report; future dates currently appear as zero rows; the default monthly arithmetic illustration can show a very large percentage. Consider a compact announcement, an explicit “upcoming” treatment and a more deliberate illustration selection in a later student UX pass. Preserve the approved pip basis and arithmetic assumptions; do not silently reinterpret them as cash returns.
- S01–S06 are verified for this actual expired-subscription account, together with prior local permission/calculation coverage. S07 has real bilingual desktop plus prior synthetic narrow-layout coverage; S08 remains a post-release recheck. Memory and both final WhatsApp messages remain in the end-of-work checklist.

## Validation and release rules

- Preserve the existing shared cash basis: approved receipts and their source-linked corrections, signed refunds/expenses, separate opening/unallocated amounts, and All services by default with Academy/Copier receipt scopes. Do not allocate shared expenses speculatively.
- Keep stored UTC dates, schedules and explicit report time choices intact. Use `shared/academyLocale.ts` for academy labels and customer-facing display times; default to Palestine / `Asia/Hebron`, not a fixed offset or Amman.
- Reuse existing components, safe CSV helpers, authorization and audit facilities where appropriate. Do not add runtime packages, schedules or global caches without a demonstrated need.
- For query changes, inspect actual indexes/plans and measure bounded reads/payloads. Do not create indexes or raise source caps speculatively. Proposed migrations or historical data repairs require their own concrete review before execution.
- Use meaningful local regressions for money, retries/idempotency, access, filters and exports. Use real browser QA for visual/navigation changes; avoid brittle tests that merely assert obsolete wording.
- Validate relevant permissions locally without changing real production roles, confirming payments, sending keys/messages, refunding customers, locking periods or creating financial entries for QA.
- Verify each scoped build/release and private-route/auth behavior. Store private recovery evidence separately from this plan and all BO/student-facing material.

## Final acceptance, memory and communication checklist

- [ ] **F01 — Every R01–R25 item has a recorded outcome.** Completed with evidence, or explicitly deferred with owner agreement and a reason; no silent omissions.
- [ ] **F02 — Cross-page financial comparison.** Refresh the same dates/scope on home and finance, compare amounts/counts/snapshot timestamps, and account for genuine new receipts rather than expecting frozen figures.
- [ ] **F03 — Final role and browser checks.** Complete the applicable admin and S01–S08 student journeys, plus relevant local regression/build checks. Record limitations.
- [ ] **F04 — Business order decisions.** Complete O01–O10 only when the BO/support/finance reviewers and production-action authorization are available. Otherwise hand over the decision register as pending, with no false claim that orders were cleared.
- [ ] **F05 — Update memory files at the end.** Reconcile `.codex/project-memory.md` and linked feature/release documents with what actually shipped and was verified. Replace outdated “authenticated admin review unverified” statements with the scoped real review evidence; keep student review pending until completed. Preserve unrelated mixed memory edits and private recovery details.
- [ ] **F06 — M01: Arabic BO completion/verification WhatsApp draft.** Include only completed work, the exact verified student/admin menu paths, simple checks and any material limitations. Refresh any dated figures before inclusion.
- [ ] **F07 — M02: Arabic BO/support order-review WhatsApp draft.** Provide the revalidated order list and recommended review steps so all reviewed requests receive an appropriate documented disposition. Distinguish fresh requests, likely superseded requests and receipt-bearing cases.
- [ ] **F08 — Deliver the final summary and both ready-to-copy drafts to the user.** Drafting is authorized; sending WhatsApp or other messages is not authorized by this plan. Do not automatically send either message.

## Verified navigation to preserve/recheck for the handover

| Audience | Observed navigation | Route | Final recheck |
| --- | --- | --- | --- |
| Admin | لوحة التحكم | `/admin/dashboard` | Pending after cleanup |
| Admin | المبيعات والتفعيل ← الطلبات | `/admin/orders` | Recheck the new exact queue/filter links |
| Finance-authorized admin | المالية والتقارير ← لوحة المالية | `/admin/finance` | Recheck final labels, filters and figures |
| Finance-authorized admin | المالية والتقارير ← المصروفات | `/admin/finance/expenses` | Recheck workflow/help text |
| Authorized finance reviewer | المالية والتقارير ← الضوابط المالية | `/admin/finance/controls` | Recheck final correction workflow |
| Authorized finance reviewer | المالية والتقارير ← المطابقة التاريخية | `/admin/finance/reconciliation` | Recheck read-only Refresh versus queue-building action |
| Authorized staff/admin | المالية والتقارير ← تقرير مدفوعات العملاء | `/admin/reports/subscribers` | Page title/population wording is an open finding |
| Admin | المالية والتقارير ← نشاط التفعيل | `/admin/reports/activations` | Recheck count definitions |
| Student | الخدمات ← أداء التوصيات | `/recommendations-performance` | Verified with the actual student account on November 25; final post-follow-up recheck remains tracked by S08 |

These labels are observations from the current UI, not permission to promise unchanged labels after implementation. Use the final verified wording in M01/M02. The route to a page does not grant financial authority to every admin/staff account.

## M01 — Arabic BO completion and verification message

**Template only. Finalize at the end after S08/F01–F05; do not send with placeholders or describe pending recommendations as completed.**

> يعطيكم العافية 🌷
>
> خلصنا التحديثات التالية على الموقع: [اذكروا فقط التحديثات التي تم تنفيذها والتحقق منها فعلياً].
>
> للتأكد من التحديثات:
>
> ١) **بحساب طالب:** تسجيل الدخول، ثم «الخدمات» ← «أداء التوصيات». اختاروا شهر التقرير، ثم «يومي» أو «أسبوعي» لمراجعة الفترات، واضغطوا على أي فترة لعرض المثال الحسابي الخاص بها. التقرير متاح لحسابات الطلاب المسجّلة سواء عندهم اشتراك توصيات أو لا، مع الحفاظ على خصوصية تفاصيل التوصيات.
>
> ٢) **بحساب الإدارة المخوّل بالمالية:** من «المالية والتقارير» ← «لوحة المالية»، اختاروا الفترة واضغطوا «تطبيق النطاق». نطاق «كل الخدمات» يشمل الأكاديمية والناسخ، ويمكن عرض مقبوضات كل قسم لوحده. زر «تحديث» يعرض آخر البيانات المعتمدة، ووقت التقرير ظاهر داخل الصفحة.
>
> ٣) **من لوحة التحكم:** يمكن مراجعة ملخص المقبوضات لنفس الفترة. عند مقارنة صفحتين، تأكدوا من الفترة والنطاق ووقت التحديث، لأن تسجيل دفعة جديدة يغيّر الأرقام.
>
> ٤) **لإدخال المصروفات:** من «المالية والتقارير» ← «المصروفات»، [أضيفوا الخطوات القصيرة التي تم التحقق منها بعد التحديث: حفظ المسودة، إرفاق الدليل، الإرسال، والمراجعة المستقلة]. المصروفات التي لم تُدخل أو لم تُعتمد لا تكون ضمن النتيجة التشغيلية المعروضة.
>
> الأرقام المالية تعتمد على الدفعات والتصحيحات الموثّقة؛ إنشاء طلب أو تفعيل مفتاح لا يُحسب تلقائياً كقبض جديد. ومثال الـ100 دولار في تقرير التوصيات توضيح حسابي حسب الافتراضات الظاهرة، وليس ربحاً فعلياً أو مضموناً.
>
> إذا ظهر أي اختلاف، ابعتولنا اسم الصفحة والفترة ووقت التقرير ورقم الطلب عند الحاجة حتى نراجعه بدقة.

Before delivery, update all paths/button names from the final navigation evidence, remove irrelevant steps, replace the completion placeholder, and decide whether any figures are useful. If figures are included, label their date/period/scope and do not reuse the old snapshot unqualified.

## M02 — Arabic BO/support outstanding-order review message

**Draft based on the November 25 observations. Revalidate statuses, evidence and related orders before final delivery. It requests review, not blanket rejection or permission for the assistant to execute changes.**

> يعطيكم العافية،
>
> خلال مراجعة لوحة الإدارة بتاريخ 25/11/2026 ظهر 11 طلباً بانتظار المراجعة. مش كلهم قدام؛ في طلبين بتاريخ 25/11، وتسعة طلبات أقدم. المطلوب نعطي كل طلب قراراً موثقاً، ونغلق الطلبات التي يثبت أنها قديمة أو مكررة، حتى تضل القائمة للمتابعات الفعلية.
>
> للمراجعة: «المبيعات والتفعيل» ← «الطلبات». ابحثوا برقم الطلب، وراجعوا حالتي «معلق» و«بانتظار التأكيد» [حدّثوا هذه الخطوة إذا أصبحت قائمة موحدة بعد التطوير].
>
> • **201 و202:** طلبات بتاريخ 25/11 لنفس العميل الذي عنده الطلب المكتمل **194**. يرجى التأكد هل هي طلبات جديدة مقصودة أو تكرار للطلب السابق، قبل إلغائها.
>
> • **88 و91:** يوجد طلب مكتمل لاحق **93** لنفس العميل. راجعوا تطابق الباقة والمستلم والدفع؛ إذا ثبت أن الطلب المكتمل بديل عنهما، تُغلق الطلبات القديمة مع تسجيل السبب وربطها بالطلب 93.
>
> • **65 و66 و67:** تُراجع مقابل الطلب المكتمل **69** بنفس الطريقة.
>
> • **41 و43:** تُراجع مقابل الطلب المكتمل **48** بنفس الطريقة.
>
> • **50:** لم يظهر طلب مكتمل بديل في البحث. نحتاج تأكيد هل الطلب متروك أو ما زال يحتاج متابعة.
>
> • **53:** عليه إيصال، ويوجد طلب ترقية مكتمل **54** بتاريخ اليوم نفسه وعليه مرفق أيضاً. هذه الحالة تحتاج مراجعة مالية للإيصالين وحركة الدفع الفعلية قبل أي رفض؛ اختلاف ملفات المرفقات وحده لا يثبت وجود دفعتين مختلفتين.
>
> لكل طلب، يرجى توثيق القرار والسبب ومن راجعه: إلغاء طلب غير مدفوع ومكرر، إبقاؤه للمتابعة مع تحديد المطلوب، أو تحويله للمالية للتحقق. عدم وجود إيصال في الصفحة لا يكفي وحده للجزم أنه لم يحصل دفع خارج النظام.
>
> نحافظ على سجل الطلب والإيصالات والمفاتيح وأي دفعة موثّقة، ولا نحذف السجلات أو نؤكد دفعاً فقط لتصفير العداد. الهدف أن يكون كل طلب واضح الحالة، وأي طلب ما زال غير محسوم يبقى للمتابعة بدل إغلاقه بالخطأ.

## Progress and decision log

| Date | Items / batch | Status | Evidence, decisions and remaining work |
| --- | --- | --- | --- |
| 2026-11-25 | Signed-in admin review | Reviewed | Live Chrome inspection plus source review; no order/financial actions. Observations captured above. Student review remains pending. |
| 2026-11-25 | R01–R25 and final handover | Plan agreed | User accepted the recommendations and requested this durable Markdown plan, explicit student/memory/message tasks and the additional BO/support order-review message. No follow-up application implementation or order closure performed by this step. |
| 2026-11-25 | S01–S06 | Real student desktop verified | User corrected the account identity and signed in personally. Verified Services → Recommendations Performance, access despite expired subscription, daily/weekly/monthly reconciliation, October and January, explicit dollar arithmetic, UTC/Palestine labels and manual Refresh. Restored Arabic/November. Details and limits above; no subscription/payment changes. |
| 2026-11-26 | R01–R07, R24 | Locally complete; production release pending | See [feature record](admin-dashboard-order-review.md). 56 distinct focused tests across 9 files (initial 55 plus final 11-test access rerun adding one denial test), 38-file/266-test critical suite with overlap, TypeScript, app/server/Worker builds and SEO/private-route checks passed. Final isolated artifact passed 58 synthetic browser checks at 1440/390/320px, including failures/retry and explicit related-history loading. 18-file isolated source excludes unrelated staff-review changes. Additive migration138/index is tested locally only; no production migration, order closure, financial repair or message. Prior production approval covered a different no-migration release; obtain specific authorization for this index-bearing follow-up before commit/push/release. |
| 2026-11-26 | R08–R23, R25; O01–O10; S07/S08; F01–F08 | Remain open | Continue the subsequent small batches and business decisions. Preserve the order-review register; finalize memory and both WhatsApp drafts at the end. Actual physical mobile/Safari and post-follow-up production journeys remain unverified. |
| 2026-11-26 | R10 | Next batch started locally; excluded from first release | `shared/orderPricing.ts` now allocates converted component pennies in integer minor units with stable largest-remainder ties, while retaining the authoritative displayed total and exposing genuine source discrepancies separately. New arithmetic coverage checks 6,000 consistent combinations plus the reviewed Basic discrepancy and invalid-source disclosure; 3 files/28 tests passed. This is not a completed R10 feature: showing discounts/source discrepancies consistently in the admin and customer breakdowns, responsive checks and next-batch release validation remain pending. No stored values or tax policy changed. These two rounding files are deliberately outside the frozen 18-file first release. |

For each later batch, append: stable item IDs, implementation/source scope, relevant local checks, actual browser results, release status if applicable, any outstanding business decision, and updates needed for M01/M02. Keep detailed private recovery evidence in its existing private location rather than copying it here.
