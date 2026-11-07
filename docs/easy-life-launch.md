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
  change. No production deployment was performed.
