# XFlex detailed SEO plan — source notes

Prepared: 24 August 2026 (Asia/Amman)

## Decision and audience

- Decision: what sequence of SEO work should XFlex follow after the owner questionnaire, while preventing unsupported or financially sensitive claims from reaching publication?
- Audience: business owner and product/project stakeholders.
- Planning horizon: 90 days after Gate 0 approval, followed by monthly iteration.
- Current authorization: data collection and planning only.
- Success: a prioritized, owner-reviewable plan with explicit dependencies, owners, exit criteria, measurement definitions, and publication gates.

## Sources and authority

1. The submitted production questionnaire is the newest owner-authored source for business intent, but non-empty answers are not automatically treated as verified facts.
2. `docs/seo-phase-1/source-notes.md` controls the readiness classification and evidence gaps.
3. `docs/organic-search-roadmap.md` controls the existing 90-day strategy, provisional Palestine/Jordan focus, editorial sequence, and KPI framework unless a later approved owner decision changes it.
4. `docs/organic-measurement-plan.md` controls acquisition-event definitions and baseline timing.
5. `docs/seo-content-brief-01-beginner-trading-ar.md` controls the first article's draft structure and publication prerequisites.
6. Current repository implementation and live smoke checks control statements about what is already implemented or operating.

## Reconciled conflicts

- The roadmap records Palestine and Jordan as the confirmed starting markets. The later questionnaire describes the whole Arab world and Arabic speakers in Europe, but does not rank countries. The plan therefore keeps Palestine and Jordan as provisional launch markets and requires an explicit ranked-country approval before final keyword targeting.
- The questionnaire describes XFlex as educational, while other answers mention consultations, real-account readiness, recommendations, broker selection, and account-opening/deposit/withdrawal assistance. The plan treats the service boundary as a critical approval gate.
- AI was named as an Arabic or English approver. The plan permits AI drafting assistance but requires accountable human approval for trading accuracy and published language.
- Performance and scale claims are treated as excluded from publication until source data, calculation rules, period, denominator, exclusions, and approval are documented.

## Phase design

The plan uses gates rather than fixed calendar promises because several tasks depend on owner evidence, account access, qualified review, or explicit publication approval.

- Gate 0: evidence and governance closure.
- Phase 1: measurement and technical readiness.
- Phase 2: keyword, page, and content architecture.
- Phase 3: reviewed editorial production and controlled publication.
- Phase 4: local authority and earned distribution.
- Phase 5: baseline measurement and iteration.

## Quantitative validation

- Submitted questions: 61.
- Primary classifications: 24 usable for planning + 14 needing clarification + 9 needing evidence/permission + 14 needing high-risk review = 61.
- Follow-up population: 14 + 9 + 14 = 37.
- Usable-now share: 24 / 61 = 39.34%.
- Follow-up share: 37 / 61 = 60.66%.
- The four classifications are mutually exclusive primary statuses; a question may still have secondary caveats.

## Visualization contract

- Analytical question: how much of the owner questionnaire can support immediate planning versus gated follow-up?
- Takeaway: completion is 100%, but 37 of 61 answers require follow-up before publication-level use.
- Family/type: category comparison, vertical bar.
- Grain: one row per primary readiness class; four rows.
- Scale: absolute question count from zero.
- Palette: single-root preferred; category names remain visible without a redundant legend.
- Final surface: canonical portable HTML report.

## Report structure mapping

- Title: `XFlex SEO Plan`.
- Executive Summary: recommendation and sequencing.
- Key findings with visual evidence: readiness gate plus chart.
- Recommended next steps: Gate 0 and five execution phases.
- Further questions: explicit owner decisions and access dependencies.
- Caveats and assumptions: no ranking guarantees, no legal conclusion, targets after baseline.

## Validation assessment

- Overall assessment: ready to share as a provisional planning document.
- Calculations reconcile to 61 questions.
- Recommendations remain within evidence and planning scope.
- Publication, regulated-service characterization, licences, performance claims, and account-level measurement status remain explicitly unverified.
- No traffic or ranking forecast is presented as a target before the 28-day baseline.

## Delivery QA

- The canonical artifact schema validated and the report was generated as a self-contained HTML file.
- The combined Windows delivery helper reproduced its known static-chart overflow false positive, so the documented canonical-builder fallback was used.
- Direct local Chromium checks passed at 1440 × 900 and 390 × 900: correct title and heading, rendered chart content, no horizontal overflow, no browser errors, and no external network requests.
- Keyboard activation of the chart options exposed both `Explore chart` and `View data source`, confirming the source affordance is available.
- This local check validates the delivered file at the tested widths; it is not a full cross-browser certification.
