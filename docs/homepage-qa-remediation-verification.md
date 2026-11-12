# Homepage QA fix verification

12 November 2026. Local implementation of the approved Phases 2–5. The user subsequently authorized production deployment; release verification is pending.

## What changed

- Homepage footer and article-preview destinations retain the selected language. Existing global legacy redirects remain intact.
- Full navigation starts at 1280px; smaller viewports use a compact menu. The header logo cannot shrink under navigation pressure. The footer stacks below the same breakpoint.
- Renewal choices stack on narrow screens. Prices and renewal terms retain their original values.
- The menu scrolls within available viewport height, exposes expanded state and localized labels, supports Escape/focus return, closes on selection and closes when resizing into desktop navigation.
- Homepage branding uses a transparent dark-background version of the flat logo, with a white subtitle for readability.
- Footer text contrast is increased; green CTAs use dark labels and icons. Keyboard focus has an explicit visible outline.
- Reduced motion stops decorative animations and animated scrolling. A localized pause/resume control stops homepage movement for other visitors. Paused/reduced motion retains a static readable trust strip and visible reveal content.
- English and Arabic payment/support FAQs, activation explanations, Gifts/Articles and testimonial introductions now describe the customer experience and current academy policy. Palestine labels come from the shared locale constants.

Application changes are confined to `frontend/src/pages/CinematicHomePage.tsx`, the new small `frontend/src/lib/publicLocaleHref.ts` helper and the new homepage logo asset. No Worker code, database, payment/activation rules, schedules, production account or customer communication was changed.

## Closure matrix

The baseline is the [original QA report](../output/playwright/homeqa/QA-REPORT.md). Evidence links below point to local ignored artifacts; they are available in this workspace, not published with the application.

| ID | Result | Evidence |
| --- | --- | --- |
| QA-01 — Logo white background | Passed locally | [Desktop](../output/playwright/homeqa-fixed/en-1440-top.png), [footer](../output/playwright/homeqa-fixed/en-1440-footer.png); all four image corners have alpha 0 |
| QA-02 — English links open Arabic | Passed locally | Actual clicks through nine footer destinations per language, filtered article previews and the main Contact CTA; language switch also retains query and anchor |
| QA-03 — Tablet header crowds/shrinks logo | Passed locally | [768px](../output/playwright/homeqa-fixed/en-768-top.png); 1024px/1279px compact mode and 1280px/1440px desktop mode checked |
| QA-04 — Renewal prices overlap | Passed locally | [English 320px](../output/playwright/homeqa-fixed/en-320-pricing.png), [Arabic 320px](../output/playwright/homeqa-fixed/ar-320-pricing.png); actual text lines checked against their cells |
| QA-05 — Landscape menu cutoff | Passed locally | [English landscape](../output/playwright/homeqa-fixed/en-667-menu.png), [Arabic landscape](../output/playwright/homeqa-fixed/ar-667-menu.png); final action is within the viewport after menu scrolling |
| QA-06 — No expanded-state information | Passed locally | Expanded/collapsed values, permanent controls target and Escape/focus return checked |
| QA-07 — English Arabic-menu label | Passed locally | Arabic Open menu/Close menu accessible names checked in compact layouts |
| QA-08 — Motion cannot be stopped | Passed locally | Zero running animations under reduced/paused motion; resume and live preference changes checked; content remains visible |
| QA-09 — Faint footer text | Passed locally | [Footer screenshot](../output/playwright/homeqa-fixed/en-1440-footer.png), [computed contrast](../output/playwright/homeqa-fixed/contrast.json) |
| QA-10 — Green CTA label contrast | Passed locally | [Keyboard focus](../output/playwright/homeqa-fixed/en-desktop-focus.png), [computed contrast](../output/playwright/homeqa-fixed/contrast.json); hover/active retain the readable label colour |
| QA-11 — Installments missing from FAQ | Passed locally | [English FAQ](../output/playwright/homeqa-fixed/en-faq.png), [Arabic FAQ](../output/playwright/homeqa-fixed/ar-faq.png) |
| QA-12 — Daily/WhatsApp student-support promise | Passed locally | Same FAQ evidence; Sunday–Thursday 15:00–19:00 Palestine time, website student support, and a separate pre-sales Contact route |
| QA-13 — Instant purchase-to-access promise | Copy concern addressed | Approval and key-redemption steps now precede the access promise, in both languages |
| QA-14 — Public layout-author commentary | Editorial concern addressed | Customer-focused Gifts/Articles/testimonial text replaces the identified design commentary in both languages |

## Validation

- Patched project Node 24.22.1 was selected through the existing local runtime script.
- TypeScript passed.
- Four focused test files passed: **12 tests**, covering public locale destinations, established public-link markup, article language availability and public SEO content quality.
- Production frontend/application build passed; generated **36 public pages and 6 article pages**. The build reports the existing large-chunk advisory.
- SEO checks passed: generated page validation, canonical redirects, private noindex handling, prerender routing and true 404 behaviour.
- **27 browser check groups passed against the final production build** served locally at `http://127.0.0.1:4174`. They use `scripts/verify-homepage-qa.mjs` and synthetic public API fixtures, never submit API mutations and reject a non-local frontend origin. No JavaScript exceptions or unhandled fixture queries occurred.
- Browser matrix: both Arabic/RTL and English/LTR at 320×740, 390×844, 667×375, 768×1024, 1024×768, 1279×900, 1280×900 and 1440×900.
- Additional checks cover language/query/hash preservation, menu selection and desktop resizing, normal/reduced/paused motion, keyboard focus, transparency, contrast, article language filtering, loading/empty articles and hidden/closed/open Live states.
- Minimum measured footer text contrast is **7.33:1**; minimum green CTA label contrast is **5.89:1**. A separate production-build check at 320px confirmed that the expanded payment/support FAQ answers do not clip in either language.
- [Machine-readable browser results](../output/playwright/homeqa-fixed/results.json), [contrast measurements](../output/playwright/homeqa-fixed/contrast.json) and [build log](../output/playwright/homeqa-fixed/build.log).

Commands to reproduce, after activating the project's Node runtime:

```powershell
. ./scripts/use-project-node.ps1
npm run check
node node_modules/vitest/vitest.mjs run server/publicLocaleHref.test.ts server/cinematicPublicLinkMarkup.test.ts server/articleLanguageAvailability.test.ts server/seoContentQuality.test.ts
npm run build
npm run test:seo
# In one terminal:
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort
# In another terminal:
$env:HOME_QA_BASE_URL = 'http://127.0.0.1:4174'
node scripts/verify-homepage-qa.mjs
```

## Limits and release status

Testing uses isolated Chrome and synthetic data. Physical iOS/Android devices and Safari were not available. The 200% check verifies equivalent CSS reflow at 720px; it is not a native browser-zoom or physical-device claim. Real purchases, authenticated student journeys, support response times and production after-release behaviour were not exercised.

The user reviewed the local results and separately authorized production deployment on 12 November. The release will use the normal Pages workflow followed by production checks. Deployment evidence will be recorded below after verification.

## Logo asset provenance

- Original: `frontend/public/xflex-logo.png`, retained unchanged.
- New project asset: `frontend/public/xflex-logo-dark-transparent.png`.
- Tool: built-in imagegen edit mode, using the original as the reference and genuine alpha transparency. Two candidates were inspected; the second is used. The new asset retains the flat XFlex composition, adapts the subtitle to white and is visually checked at actual header/footer sizes.
- Final edit prompt:

> Background removal and flat logo cleanup. Output the exact attached flat logo as a clean professional transparent PNG. MATCH THE REFERENCE EXACTLY: same geometric X, same XFLEX letterforms, positions, proportions, italic slant, and bottom TRADING ACADEMY letterforms and kerning. Use solid flat fills green #0DB287 and navy #101829; make bottom subtitle white #FFFFFF for dark website readability. Cut all white background to alpha, including counters and negative spaces between letters. IMPORTANT last attempt produced ragged edges, noise, speckles and distressed text: this output must have perfectly smooth clean antialiased vector-like edges and solid opaque uniform letters. Absolutely no gradients, texture, noise, speckles, scratches, outlines, white borders, shadows, glow, bevels or distressing. Tight consistent transparent margin. The exact lettering is XFLEX and TRADING ACADEMY. This is preserving an existing brand, not redesigning.
