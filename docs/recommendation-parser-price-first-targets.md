# Price-first recommendation targets — 11 November 2026

## Problem and resulting behavior

The temporary audit captured nine auto-fill attempts between 9 and 11 November.
Seven were linked to published recommendations with no field corrections; two
had no linked submission. No parser warnings or provider failures were recorded.
All nine used AI fallback to recover targets written as a price followed by its
label. The captured request duration ranged from 1.87 to 3.11 seconds, with a
2.22-second median. This small sample is not a general accuracy estimate.

The parser now extracts explicit price-first targets directly, for example:

    XAUUSD
    SELL NOW 2400
    SL: 2410
    2390 :TP1
    TP2: 2380
    2370 :TP3

TP1, TP2 and TP3 support colon or equals separators, English and existing Arabic
labels, Arabic digits, separate lines and explicit inline segment separators.
Mixed label-first and price-first formats work together. Complete recognized
drafts skip the provider request even when an API key is configured. This removes
the provider wait for these formats; production latency was not newly measured.

## Ambiguity safeguards

- A forward label cannot borrow the next line's price if that price explicitly
  belongs to another price-first target.
- A legitimate forward price on its own following line remains supported.
- Conflicting values, price ranges and ambiguous single-comma values stay
  unresolved and visibly flagged through AI fallback.
- Repeated equivalent numbers, such as 2410 and 2410.00, are one value.
- Reversed recognition is bounded to explicit target labels and segment starts.
  Unrecognized input continues through the existing fallback and review flow.

## Verification

- The new cases first reproduced the missing and misassigned targets.
- 115 focused tests pass, including the full parser, AI-call avoidance,
  ambiguity, diagnostic expiry/ownership, form and publishing checks.
- The expanded offline corpus passes 58/58 cases and 430/430 expected fields.
  All ten new price-first BUY/SELL layouts extract directly with no API call.
- Offline replay of the nine retained real drafts matches all previous final
  fields, with all nine now rule-only and warning-free. Raw drafts are not copied
  into source control and the local replay input was removed after comparison.
  The replay is a consistency check, not independent trading ground truth.
- TypeScript, the production Worker build, and the 231-test critical cycle pass.

## Audit and release scope

The 48-hour capture window expired on 11 November at 14:06:36 UTC. Its activation
row was then removed at the owner's request. Before release, production contained
zero activation rows and nine retained samples. Do not reactivate capture as part
of this release. Existing samples keep their seven-day expiry and daily purge.

This release changes backend extraction only. It needs no schema migration,
customer-data correction, message publication, notification, new polling or
scheduled job. Existing UI, delivery/access controls, bindings and schedules are
preserved. The previous production Worker was
522d3cc3-6a68-4b14-93e2-1f65fd44f548.

## Production verification

- Implementation f0ad4447e054ca6d62194c01b1db518c171a6886 is pushed to
  origin/codex/live-package-phase-a.
- Worker f14e5756-78d7-4dac-9779-6e97583ef336 is deployed at 100%, with the
  implementation commit in deployment metadata. Live variables were retained;
  the existing bindings and all four schedules remain in place.
- API health and the recommendation page return HTTP 200. The page retains
  noindex/nofollow. Anonymous parser and diagnostic requests return HTTP 401.
- Production still contains zero capture activation rows and nine diagnostic
  samples. The release did not restart capture or create any sample.
- This is a Worker-only release; the existing frontend consumes the improved
  parser response. No production recommendation was sent as a test. Actual
  signed-in production auto-fill and post-release latency remain unmeasured.
