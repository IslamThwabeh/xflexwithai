# Brand QA Fix Implementation Plan

## Scope

This plan translates the May 2026 brand and currency QA findings into concrete implementation work. It is ordered by production risk, dependency chain, and deploy practicality.

Primary audit inputs:

- Production and preview live audit results in [test-results/qa-live-http.txt](test-results/qa-live-http.txt)
- Lighthouse smoke run in [test-results/qa-lighthouse-prod.json](test-results/qa-lighthouse-prod.json)
- CSS token counts in [test-results/qa-css-counts.txt](test-results/qa-css-counts.txt)
- Repo findings across [functions/_middleware.js](functions/_middleware.js), [frontend/src/pages/Checkout.tsx](frontend/src/pages/Checkout.tsx), [frontend/src/pages/Upgrade.tsx](frontend/src/pages/Upgrade.tsx), [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx), [frontend/src/contexts/LanguageContext.tsx](frontend/src/contexts/LanguageContext.tsx), [frontend/src/index.css](frontend/src/index.css), [frontend/src/pages/PackageDetails.tsx](frontend/src/pages/PackageDetails.tsx), [backend/routers.ts](backend/routers.ts), and [backend/db.ts](backend/db.ts)

## Delivery Strategy

Use three implementation batches.

Batch 1 is the public hotfix batch and should be shipped together because these issues affect crawlability, trust, public package accuracy, or accessibility.

Batch 2 is the consistency batch and should land after Batch 1 is validated on preview.

Batch 3 is the decision-dependent batch for the standalone admin shell and the wider locale sweep.

This matches repo deploy practice: batch at least five fixes before build and deploy.

## Batch 1: Public Hotfixes

### 1. Restore robots.txt and sitemap.xml

Status: highest priority

Why this is first:

- Production and preview both serve HTML instead of real SEO files.
- Lighthouse flags robots.txt as invalid with 47 syntax errors.
- The SPA middleware in [functions/_middleware.js](functions/_middleware.js) serves the app shell for any path without a dot, which is a strong candidate root cause for routing these URLs into the SPA.

Files to inspect and likely change:

- [functions/_middleware.js](functions/_middleware.js)
- [vite.config.ts](vite.config.ts)
- [frontend/public](frontend/public)
- [scripts](scripts) if sitemap generation already exists elsewhere and should be reused

Implementation tasks:

1. Confirm whether [frontend/public](frontend/public) already contains deployable robots.txt and sitemap.xml. If missing, add them there or add a generation step that emits them into dist/public.
2. Tighten [functions/_middleware.js](functions/_middleware.js) so known static SEO paths bypass SPA fallback. Minimum exclusions should cover /robots.txt and /sitemap.xml.
3. Verify that the final emitted files use the production canonical host and are not rewritten by runtime middleware.
4. If preview should also expose valid files, keep content host-aware only where necessary. Do not let preview return HTML for these URLs.

Validation:

1. Run npx vite build.
2. Confirm dist/public contains robots.txt and sitemap.xml.
3. Fetch preview output locally if possible or inspect the built files directly.
4. After Pages deploy, verify prod and preview return text/plain or application/xml rather than text/html.
5. Re-run the narrow SEO checks and confirm the robots Lighthouse audit passes.

Definition of done:

- [test-results/qa-live-http.txt](test-results/qa-live-http.txt) equivalent checks show non-HTML responses for both files on prod and preview.
- Lighthouse no longer reports robots.txt invalid.

### 2. Fix PayPal billing disclosure on Checkout and Upgrade

Status: highest priority

Why this is in Batch 1:

- The current copy in [frontend/src/pages/Checkout.tsx](frontend/src/pages/Checkout.tsx#L286) and [frontend/src/pages/Upgrade.tsx](frontend/src/pages/Upgrade.tsx#L223) only says support will confirm the amount and payment method.
- The backend order flow still records USD billing defaults in [backend/db.ts](backend/db.ts), so the UI must be explicit if PayPal remains available.

Files to inspect and likely change:

- [frontend/src/pages/Checkout.tsx](frontend/src/pages/Checkout.tsx)
- [frontend/src/pages/Upgrade.tsx](frontend/src/pages/Upgrade.tsx)
- [frontend/src/contexts/LanguageContext.tsx](frontend/src/contexts/LanguageContext.tsx) if copy should move into shared translations
- [backend/routers.ts](backend/routers.ts)
- [backend/_core/orderEmails.ts](backend/_core/orderEmails.ts)
- [frontend/src/pages/OrderDetail.tsx](frontend/src/pages/OrderDetail.tsx)
- [frontend/src/pages/MyOrders.tsx](frontend/src/pages/MyOrders.tsx)

Implementation tasks:

1. Replace the generic note in Checkout with a bilingual PayPal-specific disclosure near the PayPal option and near the order CTA.
2. Apply the same disclosure pattern in Upgrade so the warning is not limited to Checkout.
3. Review [backend/routers.ts](backend/routers.ts#L4033) and [backend/routers.ts](backend/routers.ts#L4645) to ensure the created order metadata can support consistent downstream wording.
4. Update order confirmation surfaces and email templates if they currently imply the ILS display amount is the charged PayPal amount.
5. If the exact USD amount is not reliably known at commitment time, the copy must say so clearly. If the product decision is stricter, disable PayPal until the amount can be disclosed precisely.

Validation:

1. Run a focused frontend smoke check on Checkout and Upgrade in both languages.
2. Verify PayPal selection makes the warning visible before submit.
3. If order-detail and email wording change, run a narrow worker or typecheck validation for touched backend files.

Definition of done:

- A user selecting PayPal can see, before submitting, that display prices are in ILS while PayPal billing is in USD.
- The same trust story is visible on checkout, upgrade, and any first-order confirmation surface.

### 3. Correct the Basic package LexAI mismatch at the data source

Status: highest priority

Why this is in Batch 1:

- The public Basic package page shows LexAI as included.
- [frontend/src/pages/PackageDetails.tsx](frontend/src/pages/PackageDetails.tsx#L67) only reflects pkg.includesLexai, which means the likely issue is backend package data or production package rows, not the rendering code itself.

Files and data to inspect:

- [frontend/src/pages/PackageDetails.tsx](frontend/src/pages/PackageDetails.tsx)
- [frontend/src/pages/Checkout.tsx](frontend/src/pages/Checkout.tsx)
- [frontend/src/pages/StudentPackages.tsx](frontend/src/pages/StudentPackages.tsx)
- [backend/routers.ts](backend/routers.ts#L3903)
- [backend/db.ts](backend/db.ts#L6382)
- [frontend/src/pages/AdminPackages.tsx](frontend/src/pages/AdminPackages.tsx)
- Production packages table data in D1

Implementation tasks:

1. Confirm the Basic package row in production D1 has includesLexai set correctly.
2. If the production row is wrong, prepare a one-off D1 correction and verify no seed or admin path would reintroduce the bad value.
3. If the backend router or package normalization layer mutates this field incorrectly, fix it there instead of masking it in the page.
4. Recheck downstream surfaces that consume the same package object so Basic stays consistent across public pages and student surfaces.

Validation:

1. Verify packages.bySlug for basic returns includesLexai false on preview and production.
2. Check PackageDetails, Checkout, and StudentPackages for consistency.
3. If admin editing or pricing helpers are touched, run the relevant targeted tests and a typecheck.

Definition of done:

- Basic is consistently represented as no LexAI across the public journey and the student package surfaces.

### 4. Complete the Home rename rollout

Status: high priority

Why this is in Batch 1:

- Navigation is already updated to Gift, but the body section still uses home.free.title from [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx#L640).
- The current translation values in [frontend/src/contexts/LanguageContext.tsx](frontend/src/contexts/LanguageContext.tsx#L171) and [frontend/src/contexts/LanguageContext.tsx](frontend/src/contexts/LanguageContext.tsx#L1265) still read Free Content and محتوى مجاني.

Files to inspect and likely change:

- [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx)
- [frontend/src/contexts/LanguageContext.tsx](frontend/src/contexts/LanguageContext.tsx)

Implementation tasks:

1. Decide whether home.free.title should be renamed to Gift or whether Home should use the already-renamed footer key for the relevant section.
2. Update the bilingual strings so navigation, body sections, and footer use the same wording.
3. Sweep for any remaining public-facing old labels promised by the brand rollout and decide whether they belong in this batch or the later consistency pass.

Validation:

1. Check Home in English and Arabic.
2. Verify desktop nav, mobile drawer, section headings, and footer labels match.

Definition of done:

- No visible Home surface still says Free Content or محتوى مجاني unless explicitly intended.

### 5. Fix reduced-motion so fade-up content is visible immediately

Status: high priority

Why this is in Batch 1:

- With reduced motion active, browser checks still showed .fade-up at opacity 0 and translated down, even though [frontend/src/index.css](frontend/src/index.css#L250) contains a reduce-motion rule.
- [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx#L111) always wires an IntersectionObserver for fade-up elements, which likely reintroduces the hidden state.

Files to inspect and likely change:

- [frontend/src/index.css](frontend/src/index.css)
- [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx)

Implementation tasks:

1. Inspect the interaction between the base .fade-up class, the .fade-up.visible class, and the Home IntersectionObserver.
2. Ensure reduced-motion users do not start in a hidden state. The cleanest fix is usually to skip observer wiring when matchMedia prefers-reduced-motion is true.
3. Keep the CSS media rule as a defensive fallback, but do not rely on it alone if JS still suppresses visibility.

Validation:

1. Run the reduced-motion browser check again and confirm prefers-reduced-motion is true while computed fade-up styles show opacity 1 and no transform.
2. Confirm the non-reduced-motion experience still animates as intended.

Definition of done:

- Reduced-motion users see static visible content from first paint.

## Batch 2: Visual and Metadata Consistency

### 6. Remove remaining hard-coded old brand colors on public surfaces

Status: medium priority

Why this is Batch 2:

- This is visible drift, but less urgent than SEO, trust, package truth, and accessibility.
- The CSS audit confirms old hex values still ship in the bundle.

Files to inspect and likely change:

- [frontend/src/index.css](frontend/src/index.css)
- [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx#L684)
- [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx#L901)

Implementation tasks:

1. Replace explicit #10b981 and #0f172a literals with the approved brand tokens or CSS variables where those literals are part of the new brand rollout.
2. Leave intentionally deferred emerald utility classes alone in this batch unless they are part of the public shell and clearly violate the new token contract.
3. After edits, re-run a source search and a built CSS search to confirm the remaining old-color references are only the known deferred utilities.

Validation:

1. Run npx vite build.
2. Recompute the bundle token counts and compare with [test-results/qa-css-counts.txt](test-results/qa-css-counts.txt).
3. Spot-check the login button, Home CTA, heading accent, and nav underline.

Definition of done:

- The public shell no longer ships obvious leftover hard-coded emerald and slate values from the old palette.

### 7. Resolve preview metadata drift

Status: low to medium priority

Why this is Batch 2:

- Production metadata is fine for users, but preview inspection is less reliable if og:url always points to production.

Files to inspect and likely change:

- [frontend/index.html](frontend/index.html)
- Any Vite env wiring used to stamp metadata

Implementation tasks:

1. Decide whether preview should expose self-referential og:url or intentionally keep production canonicals.
2. If preview-specific metadata is desired, make og:url environment-aware without breaking production SEO.
3. Keep canonical behavior aligned with the user’s SEO consistency rules.

Validation:

1. Inspect page source on preview and production.
2. Confirm the chosen behavior is deliberate and documented.

Definition of done:

- Preview metadata behavior matches product intent rather than accidental production carryover.

## Batch 3: Decision-Dependent and Wider Consistency Work

### 8. Decide the fate of the standalone admin shell

Status: medium priority, decision required

Why this is Batch 3:

- The standalone admin shell at /admin-panel is a public 404 on both prod and preview, but the product may not actually need that path live.
- Fixing it requires a deployment and routing decision, not just a code patch.

Files to inspect and possibly change:

- [admin-panel/index.html](admin-panel/index.html)
- [functions/_middleware.js](functions/_middleware.js)
- Deploy config for any standalone Pages project if one exists outside the main SPA pipeline

Decision options:

1. Keep it live. Then route and deploy it intentionally so /admin-panel resolves to the standalone shell.
2. Retire it. Then remove it from QA expectations and any rollout claims.

Validation:

1. If kept live, verify /admin-panel and /admin-panel/index.html load the intended shell on prod and preview.
2. If retired, update internal QA prompts and rollout notes so it is no longer reported as a failure.

### 9. Finish the date-locale sweep with a shared helper

Status: medium priority

Why this expanded from the original audit:

- The first QA note named four files, but the repo search shows more default-locale usages across admin and user pages.
- High-risk examples include [frontend/src/pages/AdminCoupons.tsx](frontend/src/pages/AdminCoupons.tsx#L147), [frontend/src/pages/AdminEvents.tsx](frontend/src/pages/AdminEvents.tsx#L162), [frontend/src/pages/MySubscriptions.tsx](frontend/src/pages/MySubscriptions.tsx#L49), [frontend/src/pages/AdminRecommendations.tsx](frontend/src/pages/AdminRecommendations.tsx#L1105), [frontend/src/pages/AdminJobs.tsx](frontend/src/pages/AdminJobs.tsx#L463), and [frontend/src/pages/AdminOrders.tsx](frontend/src/pages/AdminOrders.tsx#L119).

Files to inspect and likely change:

- [frontend/src/pages/AdminCoupons.tsx](frontend/src/pages/AdminCoupons.tsx)
- [frontend/src/pages/AdminEvents.tsx](frontend/src/pages/AdminEvents.tsx)
- [frontend/src/pages/MySubscriptions.tsx](frontend/src/pages/MySubscriptions.tsx)
- [frontend/src/pages/AdminRecommendations.tsx](frontend/src/pages/AdminRecommendations.tsx)
- [frontend/src/pages/AdminJobs.tsx](frontend/src/pages/AdminJobs.tsx)
- [frontend/src/pages/AdminOrders.tsx](frontend/src/pages/AdminOrders.tsx)
- [frontend/src/pages/AdminPackageKeys.tsx](frontend/src/pages/AdminPackageKeys.tsx) for export and display paths
- [frontend/src/pages/AdminReviews.tsx](frontend/src/pages/AdminReviews.tsx)
- [frontend/src/pages/AdminSubscribersReport.tsx](frontend/src/pages/AdminSubscribersReport.tsx)
- [frontend/src/lib/printReport.ts](frontend/src/lib/printReport.ts)

Implementation tasks:

1. Create or reuse a small shared date formatting helper that always maps Arabic to ar-EG and English to en-US.
2. Replace direct default-locale calls on user-facing and admin-visible surfaces first.
3. Leave raw machine-only or library-internal date attributes alone unless they affect rendered user text.
4. Do not introduce ar-SA anywhere.

Validation:

1. Run a repo search for toLocaleDateString and manually classify any remaining raw calls.
2. Spot-check Arabic date rendering on subscriptions, events, articles, orders, and recommendations.
3. Run a focused typecheck if many TSX files are touched.

Definition of done:

- All user-visible Arabic dates consistently use Gregorian ar-EG formatting.

## Suggested Test Coverage Additions

Current server tests are useful for package pricing and upgrade logic, but there is no obvious targeted coverage yet for the new public trust-copy and locale consistency fixes.

Add or extend tests as follows:

1. Extend [server/packageKeyPricing.test.ts](server/packageKeyPricing.test.ts) only if any pricing helper logic changes.
2. Add a small frontend or shared helper test if a reusable locale formatter is introduced.
3. Add a narrow regression test around upgrade eligibility only if [backend/db.ts](backend/db.ts#L3927) changes during package cleanup.
4. If order email wording changes materially, add a small snapshot or string assertion around [backend/_core/orderEmails.ts](backend/_core/orderEmails.ts).

## Validation Sequence Per Batch

### Batch 1 validation

1. Run targeted checks for the touched public files.
2. Run npx vite build.
3. Run npm run build:worker only if backend router or email files changed.
4. Run the narrowest available tests for any shared helper or backend logic touched.
5. Deploy Pages preview.
6. Re-check Home, PackageDetails basic, Checkout, Upgrade, robots.txt, and sitemap.xml on preview.
7. Promote to production only after preview matches expectations.

### Batch 2 validation

1. Run npx vite build.
2. Re-run CSS bundle searches for old brand tokens.
3. Verify preview metadata and the main brand token surfaces.

### Batch 3 validation

1. If the admin shell is kept, verify the actual deployed route rather than source files only.
2. Re-run the date-locale grep and Arabic spot-check pass after the helper rollout.

## Recommended Execution Order Inside the Repo

1. Fix [functions/_middleware.js](functions/_middleware.js) and ensure robots.txt and sitemap.xml exist in the frontend public output.
2. Fix Checkout and Upgrade disclosures.
3. Correct the Basic package LexAI source of truth, including production data if needed.
4. Finish the Home rename.
5. Repair reduced-motion.
6. Build and validate Batch 1 together.
7. Clean up old hard-coded brand colors.
8. Decide and implement preview metadata behavior.
9. Build and validate Batch 2.
10. Decide and resolve the standalone admin shell.
11. Sweep date locale usage with a shared helper.
12. Build and validate Batch 3.

## Open Decisions Before Coding Starts

1. Should PayPal stay enabled while billing remains USD and display remains ILS, or should it be disabled until exact USD disclosure is available?
2. Should preview metadata self-reference preview URLs, or intentionally mirror production for card testing consistency?
3. Is /admin-panel a real deploy target, or only a repo artifact that should no longer be treated as live?

## Notes

No product code changes are included in this document. This is the execution plan only.