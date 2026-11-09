# Recommendation auto-fill and Live order correction — 9 November 2026

## Parser benchmark

The same 48 synthetic cases compare the original and repaired rules. The
benchmark deliberately disables the API key and never calls OpenAI. It measures
format coverage, not production accuracy or live AI quality.

| Measure | Before | After |
| --- | --- | --- |
| Cases with all fields correct | 19/48 (39.6%) | 48/48 (100%) |
| Correct expected fields | 259/350 (74%) | 350/350 (100%) |
| Invented fields | 2 | 0 |
| Failed cases with score at least 75% | 17 | 0 |
| Standard English layouts | 8/8 | 8/8 |
| Arabic wording | 0/6 | 6/6 |
| Unicode digits and numeric separators | 2/10 | 10/10 |
| Symbol position and case | 2/6 | 6/6 |
| Emoji, punctuation and direction marks | 2/8 | 8/8 |
| Entry following other levels | 0/2 | 2/2 |
| Intentionally absent fields | 3/5 | 5/5 |
| Other instrument symbols | 2/3 | 3/3 |

Forty full-format examples cover 20 layouts in BUY and SELL directions; eight
more cover missing fields and other instruments. Numeric strings are compared
by value, so trailing zeroes are equivalent. Absent fields must remain absent.
Source messages, expected values, actual values and metadata are inspectable in
the generated results.

Run with the project runtime:

    . .\scripts\use-project-node.ps1
    node --import tsx scripts/benchmark-recommendation-parser.ts

Outputs are output/recommendation-parser-benchmark/results.json and report.md.

## Fixes

- Normalize Arabic/Persian digits, decimal/thousands separators, direction marks,
  diacritics and emojis; recognize Arabic entry, direction, stop and target labels.
- Extract the instrument and explicit entry independently. A later SL/TP value
  cannot become entry, and BUY/SELL cannot become an instrument.
- Recover targets that the earlier presence-based score skipped. AI fallback
  stays available for unresolved text, with explicit failure warnings and
  numeric JSON support. Source classification uses populated values.
- Reject conflicting prices and ranges. A single ambiguous comma such as 2,400
  requires review instead of silently changing the price's scale.
- Replace the accuracy-style success toast with a review message. A deliberate
  new parse clears missed fields, preserves manual edits made while the request
  was in flight, and discards responses for changed drafts or editor contexts.

## Temporary diagnostics

Existing OpenAI usage events record request success/errors, model, tokens and
cost. Their parser metadata contains only draft length. Rules-only requests
create no AI event. Limited non-admin staff activity records also omit draft
and field values. After authentication was refreshed, production had no parser
AI-call events from 2 November through the inspection. This does not establish
the number or accuracy of rules-only requests.

The new capture window is activated after deployment for 48 hours. It rejects
longer windows and stops at its exact UTC deadline without a redeploy.
Authorized parse requests capture a request ID, bounded draft, rule/AI/final
fields, warnings, AI outcome, duration and parser version. Publishing can attach
the author's submitted values to the request once. Corrections are review
signals, not automatic ground truth. No recommendation is published by QA.

Payloads expire after seven days, disappear immediately from the admin-only
read endpoint at expiry, and are purged by daily raw-retention maintenance.
Diagnostics failure cannot block parsing or publishing. No global debug logging
is enabled. Production capture runs from 9 November 2026 at 14:06:36 UTC through
11 November 2026 at 14:06:36 UTC (17:06 Asia/Amman). The admin-only endpoint was
verified to return HTTP 401 without authentication.

## Live order correction

Inspection identified Live order #154 and Comprehensive order #166. Both keys
were unused. The two package postings counted ILS 3,700, but the owner confirmed
only ILS 2,000 was paid.

The guarded correction retires #154 from operational lists, disables its unused
key, appends a reversal of its ILS 2,000 posting and an ILS 300 prepaid-credit
replacement, and retains the ILS 1,700 Comprehensive allocation. Original order
and payment evidence remain intact for audit and financial attribution. The
separate copier order/payment is unaffected.

The customer and staff see ILS 300 available for renewals. Redemption currently
goes through support; automatic checkout deduction is outside this release.
Retirement, cash corrections, credit grant, key deactivation and status history
are one transaction. Database guards check finance-owner authority, matching
customer/package types, unused Live keys, exact confirmed ILS amounts and no
prior refunds/corrections. Retries cannot grant duplicate credit.

## Validation

Checks cover the corpus, AI failures/invalid responses and source classification,
ambiguous prices, stale-value clearing, manual edits, diagnostic ownership,
expiry and purge, order authorization, atomic rollback/idempotency, payment
confirmation and activation regressions. TypeScript and frontend/worker builds
pass. Arabic mobile checks use synthetic API responses and verify the
Comprehensive/credit split and the autofill review message without submitting
an order mutation or publishing a recommendation.

## Production release

- Worker version: 8fdce91e-5efb-4186-8dfd-dc418db1f8d0.
- Pages deployment: https://93f2598e.xflexwithai.pages.dev.
- Primary site: https://xflexacademy.com; the primary domain serves the new build.
- API health: HTTP 200 after deployment.
- Verified order #154 cancelled and retired, order #166 completed, old key inactive,
  Comprehensive key active, one ILS 300 credit grant, package cash total ILS 2,000.
- Separate copier order #143 and its ILS 1,000 posting remain unchanged.
- Both original payment confirmations are preserved.
