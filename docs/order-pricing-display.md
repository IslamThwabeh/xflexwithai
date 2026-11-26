# Order price display consistency

Status: released and deployment-verified on November26. This addresses R10 in [the follow-up plan](admin-finance-follow-up-plan-2026-11-25.md), following the separately released home/order-review batch.

The reviewed Basic order could show ₪603.44 subtotal plus ₪96.57 VAT beside a ₪700.00 total. Its legacy USD components were converted and rounded independently. The display projection now uses integer conversion ratios and allocates any conversion pennies by largest remainder, with a stable tie order. That case displays **₪603.44 + ₪96.56 = ₪700.00**. The recorded subtotal, discount, tax rate, VAT, currency, total and actual confirmed cash are not rewritten.

Both admin order details and the customer's order page share one price-breakdown component. A recorded discount is shown explicitly as a deduction. Basic, Comprehensive and upgrade commercial-price ratios remain the existing ones, including ILS/NIS passthrough and the existing generic conversion fallback. Half-agora totals round symmetrically using integer quotients/remainders, without binary floating-point tie drift. Current ILS orders take a direct integer-agora path.

Allocation applies to a source breakdown that already reconciles in its stored minor units. A genuine source discrepancy is returned separately as `displayPricingDifferenceIls`; it is never absorbed into VAT. Admins see the amount and a source-review instruction. Customers see a clear request to contact support before paying. This does not assert that any recorded payment is invalid, and it does not perform a correction, cancellation, refund or entitlement action. Existing order ownership/read permissions are unchanged.

Exact allocation requires safe integer source values and conversion products. Legacy invalid/out-of-range inputs retain the earlier conversion fallback rather than causing a new list-wide exception; this is not a guarantee of exact minor-unit arithmetic for values outside that supported domain. No exchange-rate, tax-policy or cash-recognition rule is inferred or changed by this display repair.

## Cost and validation

- No migration, new SQL read/write, polling, background job, notification, dependency or stored timestamp change. Arithmetic is fixed work per returned order. The separate R25 pagination work remains needed for large lists.
- Five focused files / 50 tests passed, including 6,000 consistent pricing combinations checked against an independent integer oracle, discounts, canonical prices, upgrades, ILS/NIS, exact half-agora signs, genuine mismatch disclosure, immutability, activation/access and payment-proof regressions.
- TypeScript, app/server/Worker builds and SEO/private-route checks passed on the isolated source, excluding pending staff-access edits.
- 54 synthetic Chrome checks passed across admin/customer pages, Arabic/English and 1440/390/320px: visible balanced amounts, discounts, source warnings, unchanged commercial totals, no negative-zero display, no page overflow, no additional history query and no order/financial mutation. Visual inspection included the Arabic 320px customer warning and the desktop admin discount breakdown. No real order was used or changed.
- After optimizing the ILS path, all six server-generated visible fixtures were byte-for-byte unchanged. Local JavaScript medians for 203/1,000/5,000 synthetic orders were about 0.31/1.92/9.07ms, versus 0.17/0.81/5.19ms for the earlier helper. These are local arithmetic measurements, not production CPU/latency limits or a production data distribution.

Ignored source manifests, fixtures, benchmark and build evidence: `output/order-pricing-rounding/`; browser evidence: `output/playwright/order-pricing-rounding/`. Subsequent control-copy/category work has its own recorded scope and verification. The November26 approved release deployed the Worker before Pages and verified the exact tested assets.


## November26 production verification

Production release verified November26: the approved49-file source plus supporting documents is committed/pushed; additive migrations139/140 are applied. Worker→Pages rollout passed11 Worker-stage and41 final read-only route/privacy/asset checks. Configuration/bindings/four schedules were preserved. No historical financial rewrite, real order cancellation, checkout or message was used for verification. Signed-in UI recheck of this combined release is pending because the Chrome connector is unavailable and no Chrome window is currently open. Earlier real student/admin reviews remain dated evidence.
