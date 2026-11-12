# Homepage QA remediation plan

Prepared: 12 November 2026. User approved local Phases 2–5 and subsequently authorized production deployment on 12 November. Implementation, verification and release status are recorded in [the verification report](homepage-qa-remediation-verification.md).

## Objective and scope

Resolve all 14 findings from the 11 November homepage QA, preserving the academy's dark/green visual identity and Arabic/English experience. QA-13 and QA-14 are copy/flow review findings; this plan includes them alongside the 12 technical/content-consistency defects.

Baseline evidence: [QA report](../output/playwright/homeqa/QA-REPORT.md). The evidence folder is local and ignored; this link is intended for this workspace and is not a public or portable evidence archive.

Primary implementation file: `frontend/src/pages/CinematicHomePage.tsx`. Consult `frontend/src/components/public/cinematicPublicNav.ts`, the established shared public layout and article-language availability rules as needed. Academy country/time labels must use `shared/academyLocale.ts`; support wording must agree with `shared/studentWelcome.ts` and `docs/student-support-welcome.md`.

Scope is homepage presentation, navigation and wording. Package prices, renewal amounts, eligibility, purchases, payment confirmation, key issuance/redemption, support operations and stored timestamps retain their current behaviour. This plan requires no backend release, database migration or new runtime dependency.

## Phase 1 — Prepare the fix specification and approval package

**Completed with this document. No application fixes have started.**

- Reviewed the audit, current homepage, navigation definitions, locale conventions and current support policy.
- Mapped every finding to an implementation phase and measurable acceptance criteria below.
- Prepared the bilingual copy replacements in this document.
- Defined layout, motion, contrast and logo approaches so approval covers a concrete scope.
- Checked the existing logo candidates: the asset named `xflex-logo-2026-transparent.png` has visibly different styling. Its name alone does not establish suitability as a replacement for the current flat brand mark.

**Approval gate requested by the user:** the user explicitly approved this plan before Phase 2 began. That approval covers local Phases 2–5 and does not authorize production deployment.

## Phase 2 — Repair navigation and responsive usability

Findings: **QA-02, QA-03, QA-04, QA-05, QA-06, QA-07**.

1. Keep the active language on every homepage internal destination: footer Home, Basic, Comprehensive, Free Content, Articles, Events, Contact, FAQ and authentication, plus article-preview links. Preserve query strings and hashes where present. Follow existing article-language availability rules. Correct the originating links rather than changing the site-wide legacy `/ar` redirect policy.
2. Use a compact navigation menu below **1280px** as the initial breakpoint; verify it against both languages. Keep the logo at a readable width and prevent it from shrinking under navigation pressure. Full desktop navigation must fit at and above the chosen breakpoint.
3. Stack renewal options on narrow cards; show two columns only when their contents fit. Allow saving badges and amounts to wrap without overlap. Preserve all price values and savings calculations.
4. Give the mobile menu a scrollable region bounded by the available dynamic viewport height beneath the header, with contained overscroll. Ensure every option is reachable in landscape, even when the underlying page is long.
5. Add an accurate `aria-expanded`, a matching menu ID/`aria-controls`, and localized Open menu/Close menu labels. Support Escape to close and return focus to the trigger; close the menu after a selection. Retain normal keyboard traversal for a navigation disclosure.
6. Use the established Wouter Link markup when touching these links, avoiding nested anchors and maintaining existing anchor-scroll offsets.

**Exit criteria:** all audited English destinations stay English; equivalent Arabic destinations stay Arabic; the primary English Contact CTA still works; all menu options can be reached by pointer and keyboard at 667×375; no crowded tablet header or price collision at 320px; menu state and labels are correct in the accessibility tree.

**Deliverable:** local implementation, targeted navigation/menu checks and before/after screenshots for the affected widths.

## Phase 3 — Repair branding, contrast and motion

Findings: **QA-01, QA-08, QA-09, QA-10**.

1. Display the existing flat brand artwork with a clean transparent background in the homepage header and footer. Prefer an authentic matching transparent source. If one is unavailable, remove only the opaque white background while preserving the artwork and inspect edges and the dark wordmark over the actual page background. Do not substitute the differently styled metallic logo merely because its filename says transparent. Make a local dark-background preview part of review evidence.
2. Raise footer headings, labels and small-print contrast to at least **4.5:1** for ordinary text against their actual backgrounds.
3. Prefer dark labels/icons on the current green CTA gradient to preserve the green identity while achieving at least **4.5:1** for ordinary text. Check default, hover, focus and active states, plus focus-indicator visibility.
4. Under reduced motion, stop decorative floating, pulsing, zooming, particles and marquee movement, disable animated smooth scrolling, and render reveal content immediately. All content must remain visible and usable.
5. Provide an accessible localized Pause animations/Resume animations control for automatically moving homepage content under normal motion preferences. A pause must persist until resumed; hovering alone is insufficient. Reduced-motion settings take precedence over resume. A static, nonduplicated trust strip is acceptable if it gives a simpler and clearer result.

**Exit criteria:** no opaque logo rectangle or obvious edge halo; readable brand artwork; verified text contrast; reduced motion produces static content; automatic movement has a usable pause mechanism; both preferences preserve all links and content.

**Deliverable:** local screenshots, contrast measurements and motion/keyboard verification. No brand redesign.

## Phase 4 — Correct customer-facing copy in both languages

Findings: **QA-11, QA-12, QA-13, QA-14**.

Use the draft replacements below. Reuse existing public company/installment copy where appropriate. These changes describe the current service; they do not change support hours, payment arrangements or activation rules.

| Location | English draft | Arabic draft |
| --- | --- | --- |
| Payment-method FAQ | You can pay by bank transfer. Installment payments are also available with the Easy Life card; contact our team for details and arrangements. Published prices include 16% VAT. | يمكنك الدفع عبر الحوالة البنكية. ويتوفر التقسيط أيضاً عبر بطاقة إيزي لايف؛ تواصل مع فريقنا لمعرفة التفاصيل وآلية الدفع. الأسعار المعلنة تشمل ضريبة القيمة المضافة بنسبة 16٪. |
| Support FAQ | For questions before joining, contact our team through the Contact page. Enrolled students receive follow-up through website support, Sunday–Thursday, 3–7 pm Palestine time. Messages received outside these hours are followed up during working hours. | للاستفسار قبل الاشتراك، تواصل مع فريقنا عبر صفحة تواصل معنا. أما متابعة الطلاب المشتركين فتكون عبر دعم الموقع، من الأحد إلى الخميس، من الساعة ٣ إلى ٧ مساءً بتوقيت فلسطين. نتابع الرسائل الواردة خارج الدوام خلال ساعات العمل. |
| Activation heading | Access after approval and activation | الوصول بعد الموافقة والتفعيل |
| Activation description | Complete your order and payment confirmation, then redeem your approved package key to access your learning content for life. | أكمل طلبك وتأكيد الدفع، ثم استخدم مفتاح الباقة المعتمد لتفعيل وصولك إلى المحتوى التعليمي مدى الحياة. |
| Gifts/Articles introduction | Explore practical resources for your trading routine and educational articles that help you understand the markets. | استكشف موارد عملية لتنظيم روتينك في التداول، ومقالات تعليمية تساعدك على فهم الأسواق. |
| Gifts description | Find resources that help you organize your trading, prepare before each trade, and review your progress. | اكتشف موارد تساعدك على تنظيم تداولك، والاستعداد قبل كل صفقة، ومراجعة تقدمك. |
| Articles heading | Latest educational articles | أحدث المقالات التعليمية |
| Articles description | Read our latest articles on trading, risk management and market awareness. | اقرأ أحدث مقالاتنا حول التداول وإدارة المخاطر والوعي بالأسواق. |
| Testimonial introduction | A student-shared moment from the learning journey. Individual experiences and results vary. | لقطة شاركها أحد الطلاب من رحلته التعليمية. تختلف التجارب والنتائج من شخص لآخر. |

Use academy country/time constants when rendering the support label. Replace remaining layout-author commentary in the affected bridge/testimonial text. Check the wording against the resources actually linked before keeping specific resource claims. Preserve the distinction between pre-sales inquiries and enrolled-student support.

**Exit criteria:** payment FAQ includes installments; support FAQ matches current hours and channels; activation copy explains the approval/redemption sequence; customer text contains no page-design rationale; Arabic and English communicate equivalent promises.

**Deliverable:** updated bilingual homepage copy and a concise final copy diff.

## Phase 5 — Verify all fixes and prepare the release handoff

Findings: **QA-01 through QA-14**.

- Re-run each original reproduction and attach after evidence. Record pass/fail separately for every QA ID; an issue closes only when its acceptance criteria pass.
- Test Arabic/RTL and English/LTR at **320×740, 390×844, 667×375, 768×1024, 1024×768, 1279×900, 1280×900 and 1440×900**. Check orientation changes, 200% zoom, header/menu state, focus order, FAQ expansion, package CTAs, article links and language switching.
- Test normal, reduced and paused motion states, including changing the preference while the page is open. Check contrast and logo edges on the real homepage backgrounds.
- Verify route destinations, anchor offsets and existing Live/advertisement sections under their public availability states. Check loading and empty article states using local fixtures where needed; do not change production availability to exercise them.
- Add focused behavioural regression coverage for locale destinations and menu/motion state where meaningful. Reuse relevant existing public-link, article-language and SEO checks; do not introduce broad snapshot tests just to mirror cosmetic markup.
- Run TypeScript, the frontend production build, the existing SEO checks and relevant focused tests. Repeat or broaden checks only for failures or shared changes that justify it.
- Request physical-device/Safari verification if available; otherwise record that limitation explicitly. Browser emulation must not be described as physical-device testing.

**Exit criteria:** all 14 findings have passing evidence, or a clearly identified unresolved item; required checks pass; no unexplained regression; screenshots and final copy are reviewable.

**Deliverable:** completion matrix, before/after evidence, validation results and a release-ready change summary. Local completion is distinct from production verification.

## Release authorization

Production deployment is a separate final decision. Once Phases 2–5 are complete, present the tested changes and ask for deployment authorization. If authorized, follow the deployment skill and the project's Pages release workflow, then smoke-test both production languages and the corrected journeys. A frontend-only fix set should not redeploy the Worker or alter production data.

Keep the previous frontend deployment available for rollback. Revert the frontend release if production navigation or layout regresses; no database restoration is part of this plan.

## Coverage checklist

| QA finding | Implementation phase | Required evidence |
| --- | --- | --- |
| 01 — White logo background | 3 | Header/footer dark-background preview |
| 02 — Language routing | 2 | Destinations for footer links and article previews in both languages |
| 03 — Tablet header | 2 | 768px/1024px and breakpoint screenshots |
| 04 — Renewal pricing overlap | 2 | 320px pricing screenshot |
| 05 — Landscape menu cutoff | 2 | All actions reachable at 667×375 |
| 06 — Missing menu expanded state | 2 | Correct accessibility state before/after toggle |
| 07 — English label on Arabic menu | 2 | Arabic open/close accessible names |
| 08 — Motion control | 3 | Reduced-motion and pause/resume checks |
| 09 — Footer contrast | 3 | Computed contrast ratios |
| 10 — CTA contrast | 3 | Contrast ratios and interaction states |
| 11 — Payment FAQ | 4 | Equivalent bilingual payment answers |
| 12 — Support FAQ | 4 | Correct channels, hours and Palestine label |
| 13 — Activation expectations | 4 | Copy consistent with approval/key redemption |
| 14 — Internal editorial wording | 4 | Customer-focused bilingual copy review |

**Current next action:** Phases 2–5 and the authorized production deployment are complete. Production verification is recorded in the verification report. The GitHub source push remains pending separate authorization after automatic approval review rejected that source-sharing action.
