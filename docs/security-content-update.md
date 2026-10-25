# Rich-content security phase — 24 October 2026

## Changes

Updated the locked Streamdown dependency chain while retaining Streamdown 1.6.11 and its existing API:

| Package | Before | After |
| --- | --- | --- |
| Mermaid | 11.12.2 | 11.17.2 |
| DOMPurify | 3.3.1 | 3.4.17 |
| lodash-es | 4.17.21 / 4.17.23 | 4.18.1 |

The selected Mermaid version fits Streamdown's existing `^11.11.0` range; DOMPurify fits Mermaid's `^3.3.3` range. The parser/rendering dependencies changed with the parent upgrade: 22 package versions were removed and 13 added. Other direct dependency declarations and overrides are unchanged. The only manifest addition is `test:security-content`.

Also replaced Admin Jobs' raw HTML insertion of AI screening output with `AiScreeningContent`, which builds headings, bold spans and line breaks from React elements and escaped text nodes. Existing classes and the parent RTL container are preserved. HTML-looking model output now appears as literal text. Backend screening prompts, provider calls, permissions, application statuses and applicant data are unchanged.

## Findings and applicability

**RICH-01 — High: unsafe model-output rendering in Admin Jobs.** The former renderer converted a few Markdown patterns to HTML, then passed the entire model response to `dangerouslySetInnerHTML`. Applicant answers enter the model prompt at `backend/routers.ts:10206`; a response containing HTML could create active elements when viewed by an administrator. The new rendering component removes that HTML interpretation. Reproducing the old behavior with a synthetic response created an image and triggered a harmless in-memory event marker in an isolated browser. This establishes the rendering weakness, not a demonstrated production attack, prompt-injection success or bypass of deployed CSP.

**RICH-02 — dependency advisory ranges.** Admin LexAI imports Streamdown at `frontend/src/pages/AdminLexai.tsx:54` and renders message content in static mode with controls disabled. Streamdown uses strict Mermaid rendering and the DOMPurify chain. The old locked packages fell within multiple published ranges, including [DOMPurify hook/in-place handling](https://github.com/cure53/DOMPurify/security/advisories/GHSA-mrv2-3pqr-j5jr) and [Mermaid CSS injection](https://github.com/mermaid-js/mermaid/security/advisories/GHSA-6x64-9x62-f2gx). Their prerequisites vary; advisory presence alone did not demonstrate that every feature or attack path was reachable through this page. The selected versions have no entries in the refreshed registry response for DOMPurify, Mermaid, Streamdown or lodash-es.

No new permissive Mermaid setting, HTML allowlist, sanitizer bypass, provider call, live content upload or production probe was introduced.

## Regression evidence

The old screening expression was first extracted unchanged into the component so its behavior could be tested independently of account/provider flows. Before the fix, **8 compatibility tests passed and 6 security tests failed**. After the fix, all **14 pass**. Checks cover English/Arabic, heading and bold formatting, scores/currency, line breaks and literal rendering of image/script/SVG/iframe/style/script-link input. Existing tests were preserved.

`pnpm test:security-content` runs those tests and `scripts/check-content-rendering.mjs`. The browser harness bundles the actual packages/component into a synthetic page served only on 127.0.0.1. All other page requests are blocked, service workers are blocked, and no application authentication or production API/provider call occurs. It uses installed Playwright Chromium, falling back to installed headless Edge; environments without either need a separately provisioned browser.

The isolated browser baseline passed **9 checks** and failed the two screening-safety checks. After the changes, all **11 checks pass**:

- Bilingual headings, emphasis, lists/tables, code and HTTPS links.
- Flowchart, sequence and state diagrams, including Arabic labels.
- Existing Markdown handling rejects active event/script markup and script links.
- Screening formatting survives while HTML-looking content stays text and the synthetic marker does not execute.
- No browser runtime errors.

The harness waits for actual diagram/code rendering rather than loading icons. Results, synthetic HTML and screenshots are under `output/playwright/content-security/`; the current screenshot was inspected. These are structural/rendering checks in a fixture, not production styling comparisons or authenticated Admin Jobs/LexAI browser journeys. The browser and local server are closed after the check.

## Wider verification

Under project Node 24.22.1:

- Frozen installation passed with lifecycle scripts disabled.
- The configured TypeScript check, frontend/standalone build, Worker build and SEO checks pass. SEO covers 36 static pages, six curated article pages and middleware behavior.
- Full suite: **1,025 passed and the same 3 existing UI-contract failures**, across 194 files. All **33 critical-cycle files / 203 tests** pass; there are no skipped tests.
- All **193 prior test files** retain their hashes and per-file test counts. The new file contributes 14 tests. The only changed pre-existing application file is Admin Jobs; the new rendering component is added separately. Other checked source/configuration files, including backend/schema/auth and Worker configuration, are unchanged.
- Worker and standalone server outputs are byte-identical to the phase baseline. Frontend assets changed as expected and require normal release validation.

The resolver's unrelated optional libsql/typing refresh was excluded. An intermediate cleanup omitted empty lock snapshots; the frozen check caught it. The cleanup was corrected from the untouched resolver output before successful installation and all final validation. Original libsql-related snapshots and retained package metadata match the baseline.

The refreshed registry metadata reports **0 critical, 28 high, 18 moderate and 6 low** findings, compared with 0/31/43/12 before this phase. These are package-manager classifications across application dependencies and tooling, not counts of exploitable production vulnerabilities. Exact inventory, version, browser and test evidence is in `security_content_dependency_audit_2026-10-24.json`; raw registry results are in `security_content_registry_audit_2026-10-24.json`.

## Remaining gates

No denial-of-service, prototype-pollution or DOMPurify in-place-hook exploit was replayed. The browser tests exercise normal string/strict rendering and the specific screening weakness. Other diagrams, browsers, optional features and production edge/CSP behavior are not certified by these checks.

Next small phase: Nano ID dependency usage and compatible remediation. Other advisories, package-manager alignment, existing peer warnings, staging isolation, provider/runtime verification, the three existing UI failures and representative business journeys remain open. Nothing was deployed, migrated or tested against production data. Validation builds disable external article fetching and need rebuilding with intended production inputs before release.
