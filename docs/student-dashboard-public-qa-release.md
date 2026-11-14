# Student dashboard and public-page QA release

The owner approved the reviewed dashboard, GitHub source push and production deployment on 14 November 2026. Authenticated verification will follow deployment using the student Chrome session the owner provides.

The student dashboard now emphasizes the next unfinished course, learning progress, course documents and existing subscription states. It uses the installed Framer Motion package and a small adaptation of React Bits SpotlightCard. Reduced-motion preferences and native page scrolling are supported. The upstream copyright and license ship at `/licenses/react-bits-LICENSE.md`.

The public-page changes address the 14 findings in `output/playwright/other-pages-qa/QA-REPORT.md`. They cover the transparent logo, package-price visibility, locale-preserving links and registration mode, homepage section navigation, responsive menus, Escape and focus handling, reduced motion, contrast, contact labels, FAQ state and student-support copy. Gifts and free-library copy now describe the resources linked from those pages.

The dashboard reuses `subscriptions.serviceAccessSummary` for active, expiring, expired, pending and frozen states. Course-loading failures have a retry action. Authentication, terms and survey gates run on the normal `/courses` route. Customer service dates use the academy timezone from `shared/academyLocale.ts`.

Local validation passed TypeScript, the production build, SEO checks, 18 focused regression tests, 58 dashboard/public browser groups and 27 homepage browser groups. Browser checks used synthetic API responses in Chrome, across Arabic and English layouts and widths from 320px to 1440px. The final release check passed 20 focused tests across six files, including the existing SEO-content regressions.

The current release targets Cloudflare Pages project `xflexacademy`, production branch `main`. The previous frontend deployment is `2ba29f63-e79d-4156-8718-294c23b69d6a`, which is the rollback target for this frontend release. Rollback consists of restoring that Pages deployment and verifying the live localized pages. This work changes frontend assets and Pages routing output.

Production verification and the final deployment identifiers will be recorded here after publication. Signed-in student verification, physical devices and Safari are pending. Internal release identifiers and this document belong to project records.
