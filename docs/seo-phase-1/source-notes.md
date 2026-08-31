# SEO Phase 1 source and review notes

Review date: 24 August 2026 (Asia/Amman)

## Scope

This is a read-only planning review. It does not authorize publication, legal claims, configuration changes, database changes, or deployment.

## Sources reviewed

- Production Cloudflare D1 tables `seo_owner_intake` and `seo_owner_intake_answers`.
- Repository SEO roadmap, measurement plan, content strategy, first Arabic content brief, and owner-input checklist.
- Current implementation in `shared/seo.ts`, `scripts/generate-seo.ts`, `frontend/src/lib/analytics.ts`, and `backend/routers.ts`.
- Live responses from the public Arabic and English homepages, robots file, sitemaps, article sitemap, `llms.txt`, and a deliberately missing URL.
- Production Worker secret-name inventory. Secret values were not inspected.

## Dataset and grain

- Questionnaire grain: one row per question, keyed by `question_id`.
- Expected questions: 61.
- Stored non-empty answers: 61.
- Submission status: submitted on 24 August 2026.
- The report deliberately excludes raw answer text and personal contact details.

## Manual readiness rubric

Each question received one primary planning status. This is a content-governance assessment, not a legal opinion.

- **Usable for planning:** sufficiently specific to shape the draft plan, but not automatically approved for publication.
- **Needs clarification:** ambiguous, incomplete, overly broad, internally inconsistent, or apparently mistyped.
- **Needs evidence or permission:** depends on a document, public link, consent record, calculation, or asset inventory that was not supplied with the answer.
- **High-risk review:** could create financial-promotion, regulatory, trust, privacy, or editorial-accountability risk if used publicly without specialist review.

Primary classification:

- Usable for planning (24): q01, q04, q16, q17, q18, q19, q21, q22, q24, q26, q29, q30, q31, q32, q34, q35, q36, q37, q43, q53, q55, q59, q60, q61.
- Needs clarification (14): q02, q03, q06, q07, q10, q11, q14, q20, q27, q45, q46, q47, q49, q56.
- Needs evidence or permission (9): q12, q13, q15, q41, q44, q50, q51, q52, q54.
- High-risk review (14): q05, q08, q09, q23, q25, q28, q33, q38, q39, q40, q42, q48, q57, q58.

## Highest-value reconciliation checks

1. Distinguish the academy launch date from the founder's trading/training experience dates.
2. Obtain the exact registered owner/entity name and documentary permission for public identity claims.
3. Replace the broad geographic audience with a prioritized country list and confirm where services may legally and operationally be offered.
4. Name accountable human technical, Arabic-language, and English-language reviewers. AI can assist drafting but should not be the approving reviewer.
5. Obtain licenses, registrations, qualification evidence, event evidence, testimonial releases, and content-use permissions before citing them.
6. Do not publish performance percentages, student counts, leadership claims, or “first/only” claims until the source, denominator, period, exclusions, and approval are documented.
7. Reconcile “education only” positioning with consultations, real-account readiness, broker selection, account-opening/deposit/withdrawal assistance, recommendations, and any referral or commission arrangements.
8. Rewrite outcome language around learning objectives and risk controls; avoid profit targets, high-success implications, and loss-recovery framing.

## Technical observations

- Live technical SEO endpoints responded successfully; canonical tags and GA4 were present on Arabic and English homepages, and the missing-page test returned HTTP 404.
- Local SEO tests validated 36 static localized pages and 6 localized article pages.
- Google and Bing HTML verification meta tags were not present on the live Arabic homepage. DNS verification may still exist and requires console or DNS confirmation.
- Production contains the GA4 measurement ID, but event receipt and key-event configuration require GA4 account access.
- Production Worker secrets did not include `SEO_REBUILD_WEBHOOK_URL` or `SEO_REBUILD_WEBHOOK_SECRET`; automatic rebuild after article publication is therefore not confirmed as configured.

## Assumptions and limitations

- A non-empty answer is not treated as a complete or publication-safe answer.
- No attachments, legal documents, analytics-console data, or Search Console reports were available in this review.
- The readiness classification is intentionally conservative because trading education is a high-trust, financially sensitive topic.
- Search Console sitemap submission is recorded in the roadmap but was not independently verified in the account.
- This review provides planning and data-quality guidance, not legal or regulatory advice.

## Visualization contract

- Analytical question: How much of the submitted questionnaire can safely shape the next planning stage without follow-up?
- Takeaway: all 61 fields are populated, but 37 require clarification, evidence, or high-risk review.
- Family and type: comparison, vertical bar.
- Grain: one row per mutually exclusive primary readiness status; four rows total.
- Palette: single-root preferred, no legend, direct category labels.
- Delivery: canonical portable HTML report.

## Delivery QA note

- The canonical artifact schema validation passed.
- The combined delivery command repeatedly failed its Chromium verifier after static-chart insertion because that Windows run reported desktop horizontal overflow.
- The fallback HTML was generated by the canonical validated builder without the inserted static SVG.
- Direct browser checks against the delivered file passed at 1440 px and 390 px: the report title and chart rendered, document width matched viewport width, no browser errors occurred, and no external network requests were made.
- This is a packaging-verifier limitation, not a claim of full cross-browser certification.
