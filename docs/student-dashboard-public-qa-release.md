# Student dashboard and public-page QA release

The owner approved the reviewed dashboard and production deployment on 14 November 2026. Authenticated verification will follow deployment using the student Chrome session the owner provides.

Automatic approval review rejected the GitHub push because the owner's go-ahead did not explicitly authorize sharing the repository source and private project-memory commits with GitHub. The implementation commit is local. A separate source-push decision is pending.

The student dashboard now emphasizes the next unfinished course, learning progress, course documents and existing subscription states. It uses the installed Framer Motion package and a small adaptation of React Bits SpotlightCard. Reduced-motion preferences and native page scrolling are supported. The upstream copyright and license ship at `/licenses/react-bits-LICENSE.md`.

The public-page changes address the 14 findings in `output/playwright/other-pages-qa/QA-REPORT.md`. They cover the transparent logo, package-price visibility, locale-preserving links and registration mode, homepage section navigation, responsive menus, Escape and focus handling, reduced motion, contrast, contact labels, FAQ state and student-support copy. Gifts and free-library copy now describe the resources linked from those pages.

The dashboard reuses `subscriptions.serviceAccessSummary` for active, expiring, expired, pending and frozen states. Course-loading failures have a retry action. Authentication, terms and survey gates run on the normal `/courses` route. Customer service dates use the academy timezone from `shared/academyLocale.ts`.

Local validation passed TypeScript, the production build, SEO checks, 18 focused regression tests, 58 dashboard/public browser groups and 27 homepage browser groups. Browser checks used synthetic API responses in Chrome, across Arabic and English layouts and widths from 320px to 1440px. The final release check passed 20 focused tests across six files, including the existing SEO-content regressions.

The current release targets Cloudflare Pages project `xflexacademy`, production branch `main`. The previous frontend deployment is `2ba29f63-e79d-4156-8718-294c23b69d6a`, which is the rollback target for this frontend release. Rollback consists of restoring that Pages deployment and verifying the live localized pages. This work changes frontend assets and Pages routing output.

The implementation is committed locally as `de1779c`. Source-push approval status is recorded in `16d1ff3`, which is the source revision attached to Cloudflare Pages production deployment `f7e08460-0913-43b7-b903-e2244d463542`. The deployment URL is `https://f7e08460.xflexwithai.pages.dev`. Publication completed on 14 November 2026 and the release is live on `https://xflexacademy.com`.

Production verification passed eight exact asset SHA-256 matches, including the dashboard, public layout and React Bits notice. Eleven public/private route checks and API health returned 200. `/courses` and `/profile` retained private noindex/no-store headers. Eighteen live browser groups passed against real public data in Arabic and English, covering shared logos, Contact, FAQ state, visible package prices, responsive menus, Escape/focus return, reduced motion, homepage anchors, registration routes and mode preservation, and legal/resource locales. The browser recorded zero JavaScript exceptions. Normal telemetry writes were blocked in the isolated anonymous QA browser.

Machine-readable evidence and screenshots are under ignored `output/playwright/dashboard-public-release/`. Signed-in student verification is pending the owner-provided Chrome session. Physical devices and Safari are pending. Internal release identifiers and this document belong to project records.
