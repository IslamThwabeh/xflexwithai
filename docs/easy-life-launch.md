# Company information and Easy Life announcement

The approved company statement and bilingual Easy Life copy live in
`shared/companyPublicInfo.ts`. Both public footers and the About page use this
copy. Easy Life links open the existing business WhatsApp number with an inquiry;
they do not create an order or select an online card payment method.

The homepage promotes Easy Life below the navigation and the company statement
inside the opening section for seven days. Afterward, both extra placements hide
automatically, including for visitors who keep the page open. The About page,
footers, homepage packages, package details and checkout inquiries remain.

## Publication

Set `VITE_EASY_LIFE_LAUNCH_AT` to the agreed publication timestamp **before building
the frontend**, using ISO 8601 with a timezone, for example
`2026-11-07T20:45:00+03:00`. Preserve the same timestamp on later builds so the
campaign does not restart. The checked-in release start is `2026-11-07T17:45:00Z`
(20:45 Asia/Amman on November 7); the seven-day window ends at 20:45 on November 14.
This is a public frontend build setting, not a Worker runtime variable.

The window includes the start and excludes the instant seven days later. Invalid
or timezone-less values hide the temporary placements; permanent information is
unaffected. No per-visitor timer, browser storage, API polling or cron job is used.

When the business owner's licence image arrives, reconcile the company/ministry
names in the shared copy. Do not infer installment counts, fees, interest terms,
eligible products or online card processing from this announcement.

## Verification — 2026-11-07

- TypeScript check and full production build passed. The build used
  `SEO_FETCH_DYNAMIC_ARTICLES=false` for a reproducible local SEO generation.
- Ten focused tests passed across `server/easyLifeAnnouncement.test.ts` and the
  existing checkout account-gate tests. These cover exact start/expiry boundaries,
  timezone equivalence, invalid dates, inquiry encoding and checkout authentication.
- Browser checks covered Arabic at 320, 390, 768 and 1440 CSS pixels, and English
  desktop/mobile; the company statement, both public footers, WhatsApp destination,
  mobile menu and package-section navigation were verified.
- The expanded mobile menu is excluded from anchor offsets. The final browser
  regression check placed the package section at 161.39px against a 162px target.
- Browser clock simulation verified prelaunch hiding, automatic start and automatic
  expiry on an open page, with the permanent package/footer inquiries remaining.
- Browser-only fixtures verified simultaneous Live/Easy Life banners, Basic and
  Comprehensive pricing cards, guest checkout and signed-in checkout. The local
  development database has no `basic` package, so these checks validate UI behavior,
  not production package eligibility or payment processing. No account or order
  was created.
- Screenshots are in `output/playwright/easy-life/`. Existing nested-anchor React
  console warnings and existing build chunk-size warnings remain outside this
  change. This local verification preceded the production release below.

## Production release — 2026-11-07

- Combined source commit: `6c8d095`, pushed to `origin/codex/live-package-phase-a`.
- Includes the completed customer password-recovery changes. All 33 focused tests,
  TypeScript, frontend/SEO build and Worker build passed before release.
- API Worker version: `e78050b7-75df-4012-acb6-6c0e5b02b15f` (100% production).
- Pages production deployment: `e2c20382-2a29-4b15-baf7-f3bb8a766ed7`, source
  `6c8d095`, at `https://e2c20382.xflexwithai.pages.dev` and
  `https://xflexacademy.com`.
- Launch window: November 7, 2026 at 20:45 through November 14 at 20:45,
  Asia/Amman. The build explicitly used `2026-11-07T17:45:00Z`.
- Production `/ar`, `/en`, `/ar/about`, `/auth` and `/ar/packages/basic` returned
  200 with the new entry script. Entry, Home, Auth and shared-layout JavaScript
  SHA-256 hashes matched the local release build.
- API health and deliberately invalid recovery-input probes passed. No real
  reset email, password change, account or order was created during production
  verification. No database migration or new runtime secret was needed.
