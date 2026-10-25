# XFlex security remediation and business continuity plan

Prepared: 24 October 2026, Asia/Amman.

Objective: remediate the findings in `security_vulnerability_assessment_2026-10-24.md` while preserving sales, account access, student learning, and staff operations. Target no customer-visible downtime or behavior regressions; this is a release objective, not a guarantee. This document is a plan; it does not authorize or perform deployment.

## Active scope update — critical only

At the user's request, the active scope is now the critical-only closeout in `docs/security-critical-only-plan.md`. The latest local audit has zero critical dependency findings, but deployed applicability/runtime status remains unverified and nothing has been deployed. Retain completed work; defer further general dependency upgrades and broader cleanup. Start with read-only production-critical exposure verification, then prepare/review a minimal release only if required. Allow approximately 2–4 hands-on hours with access ready and no new critical discovery, plus a 24-hour observation window if a release occurs. The broader sections below are historical evidence and deferred backlog, not the current execution queue.

## Implementation checkpoint — critical-only production verification

Read-only verification completed on 24 October 2026. Confirmed the active API Worker version and Pages canonical deployment through Cloudflare. Downloaded the exact active API source with matching ETag; original critical package names, known signatures and corresponding external imports were not found. Pages middleware at its reported commit imports no packages, although the deployed Functions artifact was not downloaded. Normal API/page/redirect checks pass, and a fresh local registry audit has zero critical entries.

No critical dependency redeployment is indicated by this evidence. Cloudflare native Brotli/runtime patch assurance remains unconfirmed; this is not complete production security clearance. Nothing was deployed or changed in production. The prepared provider question is recorded but was not sent. Details and evidence: `docs/security-critical-production-review.md`, `security_critical_production_review_2026-10-24.json`. The wider backlog remains deferred.

## Implementation checkpoint — first small phase

Completed locally on 24 October 2026:

- Added a resource-isolation preflight to the staging deployment shortcut. The current unsafe staging configuration is rejected before building or invoking Wrangler. This does not change already deployed staging infrastructure or certify secret/outbound integration isolation.
- Explicitly disabled routes and cron schedules in the local staging configuration. Production configuration was compared with the previous revision and is unchanged.
- Defaulted the local Vite and Express development listeners to loopback, with explicit `XFLEX_DEV_HOST` opt-in for trusted LAN use. Vite middleware now retains hostname/filesystem restrictions. Production listener behavior is preserved.
- Added 16 resource guard tests and 4 development/middleware tests. Corrected the pre-existing scheduler assertion to recognize the existing retention schedule without changing the actual production schedule.
- Verified: 203/203 critical-cycle tests; 31/31 foundation checks (including 11 scheduler checks also present in the critical cycle); TypeScript; frontend build; Worker build; no diff whitespace errors. The frontend build retains a non-blocking large-chunk warning.

No Cloudflare resources were provisioned, no remote write tests were run, and no application was deployed during this phase. Node remains 24.11.0, and the previously reported application dependency findings remain open. The only added dependency is the pinned development-only TOML parser used by the preflight/tests; no registry advisories were reported for that version during this check.

Next work: patched Node/build-runtime setup and focused backend dependency changes, while completing read-only Cloudflare inventory and dedicated staging resource/integration isolation. Remote write tests remain gated until isolation is verified. Operational details are in `docs/security-staging-isolation.md`.

## Implementation checkpoint — local Node runtime phase

Completed locally on 24 October 2026:

- Installed official Node **24.22.1** in ignored `.tools/node/`, verifying both archive and executable against the official release SHA-256 checksums. The administrator-free PowerShell activation changes only the current process PATH and verifies the cached executable before use.
- Pinned `.node-version` and `.nvmrc`, tightened `engines.node` to patched Node 24, and enabled strict dependency-install engine checks. Development, build, typecheck, test and Pages deployment scripts now check the runtime before starting their work. Worker deployments retain the guarded build; the staging resource gate is preserved.
- Confirmed the old system Node **24.11.0** is rejected. It remains installed; other terminals, existing processes and unrelated projects are not patched by project-local activation. An administrator-managed system update is still outstanding.
- Frozen-lockfile installation passed without changing application dependency versions. The existing native SQLite binary loaded and performed in-memory reads/writes successfully; the existing disposable local-D1 batch/rollback integration test also passed under the new runtime.
- Verified under Node 24.22.1: 13/13 runtime policy tests; 203/203 critical-cycle tests; 31/31 foundation checks (11 overlap the critical suite); 1/1 local-D1 batch test; TypeScript; full frontend/standalone Node build; SEO checks; Worker build. The frontend retains the existing non-blocking large-chunk warning.

The local validation build deliberately disabled dynamic article fetching; it generated and checked the static/curated SEO pages without external requests. These are validation artifacts, not an approved production release candidate. Rebuild with the intended production SEO inputs when preparing the release.

No application dependencies, database schema, production bindings, signing secrets, sessions, or deployed application were changed in this phase. The package-manager advisory findings remain outstanding as well. No CI or Cloudflare account settings were changed or remotely verified; validate any Node build override against the new pin before promotion. Provider-side Worker/Brotli status remains a separate open item.

Each Windows project terminal must activate with `. .\scripts\use-project-node.ps1` before package-manager commands. The setup and CI requirements are documented in `docs/security-node-runtime.md`. Next focused dependency work starts with Zod and its request-validation behavior, followed by the remaining advisory register; staging write tests remain gated by resource/integration isolation.

## Implementation checkpoint — Zod dependency phase

Completed locally on 24 October 2026:

- Updated and pinned Zod **4.3.6 → 4.6.7**, including its existing OpenAI peer resolution. Frozen-lockfile installation passed. No other application dependency declarations, API schemas, request capacities or business logic changed.
- Added 13 focused API validation/security regression checks. All 10 request-compatibility checks passed before and after; all 3 early-rejection security checks failed on 4.3.6 and passed on 4.6.7. `pnpm test:security-zod` reruns them.
- Verified the installed dependency graph and lockfile use only Zod 4.6.7; the registry returned no Zod advisories for that version. Scoped evidence is in `security_zod_audit_2026-10-24.json`.
- Project TypeScript, frontend/standalone Node build, SEO checks and Worker build pass. The full root Vitest suite reports **966 passing tests and 3 existing UI-contract failures**; all 33 critical-cycle files passed. The same three failures reproduced with the old cached Zod in an isolated baseline run. Their UI/permission source files are unchanged; no tests or business permissions were altered to conceal the failures.

The three existing failures concern subscriber-report rendering, Arabic renewal wording, and the finance-manager navigation contract. They remain tracked for separate review before a fully green release baseline. Existing OpenAI/Vite-plugin peer warnings also remain, and unbounded API collections still require a separate capacity/request-limits review. Details are in `docs/security-zod-update.md`.

Nothing was deployed or tested against production data. Staging and provider-runtime verification remain open. Validation artifacts use static/curated SEO inputs and require a normal production-input rebuild before release. Next focused dependency work: Drizzle ORM review/update and D1/financial/access regression checks, with no schema migration planned.

## Implementation checkpoint — Drizzle ORM dependency phase

Completed locally on 24 October 2026:

- Updated and pinned **Drizzle ORM 0.44.7 → 0.45.4**, containing the fix for CVE-2026-39356 / GHSA-gpj5-g38j-94v9. Frozen-lockfile installation passed. Drizzle Kit remains at locked 0.31.9, and no schema generation, migration, database push or remote query ran.
- Added 9 focused identifier/security and D1 query-mechanics tests, alongside the existing batch rollback test. The old ORM passed 7 compatibility/batch checks and failed the 3 escaping checks; the updated ORM passes all 10. Disposable local SQLite fixtures exercise the real D1 driver/local adapter and use verified cleanup paths.
- Verified parameter binding, boolean/null/default mapping, scoped affected-row counts, grouped integer-money totals, unique-key handling and ordered/atomic batch behavior. These are local representative mechanics; they do not replace live D1 staging verification of the full application schema.
- Project TypeScript, frontend/standalone Node build, SEO checks and Worker build pass. The full suite reports **975 passing tests and the same 3 existing UI-contract failures** across 190 files. All 33 critical-cycle files and all 13 non-UI financial test files passed. No new test failure appeared.
- The manifest, installed dependency and lockfile resolve Drizzle ORM only to 0.45.4, and its scoped registry advisory check returned none. Evidence is in `security_drizzle_audit_2026-10-24.json`; details and exposure limits are in `docs/security-drizzle-update.md`.

No attacker-controlled identifier route was established in the scoped backend/database search; the fix removes the affected library version without claiming exploitation or a complete SQL-injection audit. API/business query code, database schemas, permission rules and production bindings are unchanged. Other application dependency declarations are unchanged from the previous phase.

Nothing was deployed, and no production customer data was read or written. Staging isolation, live provider verification, existing UI-contract failures and other dependency findings remain open. The next focused dependency phase is Axios and its HTTP request behavior; final release preparation still requires the complete staging/business validation gates.

## Implementation checkpoint — Axios dependency phase

Completed locally on 24 October 2026:

- Updated and pinned **Axios 1.13.5 → 1.20.0**, with its required redirect, proxy and form-data dependency updates. Frozen-lockfile installation passed. Application HTTP settings, legacy helper code, current authentication/session behavior, business logic and schemas are unchanged.
- Added 14 local HTTP/security checks. All 11 compatibility checks passed before and after; all 3 security checks failed on the old version and pass on the update. Tests cover JSON requests, headers, redirects, query encoding, error responses, proxy/NO_PROXY behavior, timeout/cancellation and configured streaming limits. Prototype mutation is restricted to a no-network child process, and every HTTP fixture stays on loopback.
- TypeScript, frontend/standalone Node build, SEO checks and Worker build pass. The full suite reports **989 passing tests and the same 3 existing UI-contract failures** across 191 files; all 33 critical-cycle files passed. No new failure appeared.
- Axios's installed and locked resolution is 1.20.0. Its resolved regular dependency closure covers 27 package names and has no reported registry advisories at this check. Evidence is in `security_axios_audit_2026-10-24.json`; implementation and applicability limits are in `docs/security-axios-update.md`.

The search found Axios only in the retained OAuth helper and no call registering its callback route; this does not replace deployed-state verification. Existing unlimited size defaults, fetch/browser/HTTP2 and production HTTPS/proxy behavior were not claimed to be validated by the local HTTP fixtures. An older form-data 4.0.5 remains elsewhere in the dependency tree and is still tracked.

Nothing was deployed or tested against production services/data. Staging isolation, provider verification, the three existing UI-contract failures and the remaining dependency findings stay open. Next focused phase: AWS S3 SDK/XML parser dependency-chain usage and remediation. Validation artifacts still require a production-input rebuild before any release.

## Implementation checkpoint — AWS/XML dependency phase

Completed locally on 24 October 2026:

- Confirmed no application, script or configuration usage of the declared AWS S3 client, presigner or XML parser in this checkout. Storage uses native Cloudflare R2 bindings, and the retained Forge helper uses fetch/FormData.
- Removed the two unused direct AWS dependencies, pruning **100 package versions**, including all AWS SDK/Smithy packages and `fast-xml-parser` 5.3.4. No new package versions were added. Other direct dependency declarations are unchanged from the Axios checkpoint, and the frozen install passed.
- All seven new native R2 compatibility checks passed before and after removal. The focused storage/business suite passes **36 tests across six files**, using mocked bindings or disposable local fixtures.
- TypeScript, frontend/standalone server build, Worker build and SEO checks pass. The full suite reports **996 passing tests and the same 3 existing UI-contract failures** across 192 files; all 33 critical-cycle files pass.
- Rebuilt Worker and standalone server bundles are byte-identical to their pre-removal versions. Storage code, Worker entry point, API router, OAuth helpers and schema match HEAD; parsed production environment configuration also matches HEAD.

Details and limits are in `docs/security-storage-dependencies.md`; exact removal and hash evidence is in `security_storage_dependency_audit_2026-10-24.json`. A refreshed repository-wide registry response is retained in `security_remaining_dependency_audit_2026-10-24.json`. Its severity metadata still reports 4 critical, 37 high, 57 moderate and 14 low findings across dependencies/tooling, with no AWS SDK/Smithy/XML-parser advisory entries. Audit severity is not proof of production exploitability. Next small phase: Express/proxy-addr usage and compatible remediation; Vitest/Tinypool requires a separate tooling phase.

Nothing was deployed or tested against real buckets or customer data. Live Cloudflare integration, staging isolation, provider/runtime verification, existing UI failures and remaining dependency findings stay open. Validation artifacts require a production-input rebuild before release.

## Implementation checkpoint — Express/proxy-addr dependency phase

Completed locally on 24 October 2026:

- Updated only the locked **proxy-addr 2.0.7 → 2.0.8**, within Express 4.22.1's existing compatible range. Other package resolutions, direct dependency declarations, overrides and application proxy settings are unchanged from the preceding phase. Frozen-lockfile installation passed with lifecycle scripts disabled.
- Added 15 Express/proxy checks. On the old dependency, 10 compatibility cases passed and five security cases failed; all 15 pass after the patch. The focused cookie/account/development-host suite passes **29 tests across five files**, using local fixtures or mocks.
- The configured TypeScript check, frontend/standalone build, Worker build and SEO checks pass. The full suite reports **1,011 passing tests and the same 3 existing UI-contract failures** across 193 files; all 33 critical-cycle files pass.
- Worker build metadata confirms no Express/proxy-addr inputs or external runtime imports. Worker and standalone outputs are byte-identical to the phase baseline; standalone dependencies remain external and include the patched package at runtime. Server/bootstrap, Worker, router, cookie/context and configuration hashes are unchanged.
- The refreshed registry response clears proxy-addr and reports 3 critical, 37 high, 57 moderate and 14 low remaining findings across dependencies/tooling. Severity alone does not establish production exploitability.

No application trust-proxy setting was found; the advisory's subnet prerequisite was not demonstrated in checked application code. Direct Cloudflare/forwarded-IP handling and forwarded protocol checks are separate application paths requiring deployed-ingress/header-provenance review. This patch does not establish their safety or certify historical/current deployments.

Details are in `docs/security-proxy-update.md`; exact change/validation evidence is in `security_proxy_dependency_audit_2026-10-24.json`, with raw registry results in `security_proxy_registry_audit_2026-10-24.json`. Next small phase: Vitest/Tinypool tooling review and remediation.

Nothing was deployed or tested against production data. Staging isolation, provider verification, existing UI-contract failures, other dependency findings and business integration checks remain open. Validation artifacts require a production-input rebuild before release.

## Implementation checkpoint — Vitest/Vite tooling phase

Completed locally on 24 October 2026:

- Pinned **Vitest 2.1.9 → 4.1.12** and **Vite 7.3.1 → 7.3.7**, compatible with project Node 24.22.1. Vitest 4 removes Tinypool, and the active lockfile contains only Vite 7.3.7. Other direct dependency declarations/overrides are unchanged; frozen installation passes with lifecycle scripts disabled.
- Verified all **193 original test files / 1,014 tests** retain their per-file counts. All original assertions and checked application/configuration sources are unchanged, with 697 file hashes verified. No test was skipped or weakened.
- The full suite reports **1,011 passing tests and the same 3 existing UI-contract failures**. All **33 critical-cycle files / 203 tests** pass. The configured TypeScript check, frontend/standalone build, Worker build and SEO checks pass.
- Worker and standalone outputs are byte-identical to the phase baseline. Worker metadata has no Vitest/Tinypool/Vite input or external runtime import. A root-configured loopback Vite smoke check served HTML/modules and denied a synthetic hidden file; its temporary helper was cleaned up.
- The refreshed registry response reports **0 critical, 31 high, 43 moderate and 12 low** findings, with no Vitest/Tinypool/mocker/Vite package advisory entries. Other transitive build-tool findings, including Rollup/PostCSS/picomatch, remain open; zero critical classifications is not website security clearance.

Details and migration limits are in `docs/security-tooling-update.md`; exact inventory/hash evidence is in `security_tooling_dependency_audit_2026-10-24.json`, with raw registry results in `security_tooling_registry_audit_2026-10-24.json`. The older runner's inventory command had a reporter bug, so baseline file/count evidence uses the completed pre-update full suite and pre-update hashes. No application or test configuration adaptation was needed; verification uses `--maxWorkers=4` without the removed `minWorkers` option.

Next small phase: DOMPurify/Mermaid rich-content dependency usage and compatible remediation. Existing peer warnings, other advisories, package-manager alignment, staging isolation, provider verification, UI-contract failures and representative business integration checks remain open. Nothing was deployed or tested against production data. Validation artifacts require a production-input rebuild before release.

## Implementation checkpoint — rich-content rendering phase

Completed locally on 24 October 2026:

- Updated the compatible locked Streamdown chain to **Mermaid 11.17.2 / DOMPurify 3.4.17 / lodash-es 4.18.1**, retaining Streamdown 1.6.11 and its API. Other direct dependency declarations/overrides are unchanged. Unrelated optional database-tooling refreshes were excluded, and the final frozen install passed.
- Fixed a separate unsafe AI-screening HTML insertion in Admin Jobs. `AiScreeningContent` preserves headings, emphasis, bilingual text and line breaks with escaped React text/elements. Provider prompts/calls, backend access, statuses, schemas and data behavior are unchanged.
- All **14 new screening tests** pass; before the fix, 8 compatibility tests passed and 6 security checks failed. The isolated loopback browser fixture now passes **11 checks**, including Markdown, three diagram types, safe screening text and no synthetic script execution. The original browser baseline passed 9 and failed the two screening-safety checks. No application account, live provider or production API was used.
- The configured TypeScript check, frontend/standalone build, Worker build and SEO checks pass. Full suite: **1,025 passed and the same 3 existing UI-contract failures** across 194 files. All **33 critical-cycle files / 203 tests** pass. The 193 prior test files and per-file counts are preserved.
- Worker/standalone output hashes match the phase baseline. Frontend assets changed as expected. Backend/auth/schema and Worker configuration are unchanged. The only changed pre-existing application file is Admin Jobs, with the safe component added separately.
- The refreshed registry response reports **0 critical, 28 high, 18 moderate and 6 low** findings and no DOMPurify/Mermaid/Streamdown/lodash-es advisory entries. These classifications do not establish production exploitability or overall website clearance.

Details, browser scope and remaining gates are in `docs/security-content-update.md`; exact evidence is in `security_content_dependency_audit_2026-10-24.json`, with raw registry results in `security_content_registry_audit_2026-10-24.json`. Next small phase: Nano ID dependency usage and compatible remediation.

Nothing was deployed, migrated or tested against production data. Existing UI failures, other advisories, package-manager alignment, peer warnings, staging isolation, provider/runtime verification and authenticated business/browser checks remain open. Validation artifacts require a production-input rebuild before release.

## Release principles

- Prioritize demonstrated exposure and business consequences. Audit severity alone does not prove production exploitability.
- Use focused, independently reviewable commits and cohesive release bundles. Follow the repository's batching policy for deployments; an urgent reachable issue may require a separately justified release.
- Choose the smallest compatible supported updates that clear the relevant advisories. Read release notes and inspect lockfile changes. Avoid blanket forced upgrades and unrelated framework migrations.
- Preserve API contracts, existing sessions, entitlement calculations, pricing, VAT, payment confirmation, and notification deduplication. No JWT signing-key rotation, global logout, database migration, or Worker compatibility-date change is planned for the initial dependency releases.
- Use synthetic accounts, orders, payment receipts, and files for write tests. New tests should target actual exploit prerequisites or meaningful business regressions.
- Assign one technical release owner and one business tester before rollout. Every release has a recorded candidate, test evidence, previous deployment IDs, and stop/rollback criteria.

## 1. Establish a safe baseline and isolated test environment

Start immediately. This is the prerequisite for remote tests that write data or trigger external actions.

**New finding:** `wrangler-worker.toml:81`–`88` binds staging to the same D1 database and video bucket as production. Its email provider is `auto`, and its site URL is the production URL. A staging name does not establish isolation. The finance receipt staging binding is not configured.

Actions:

1. Verify the actual deployed frontend/Worker versions, routes, bindings, scheduled triggers, and build-host runtimes through read-only inspection. Confirm whether any standalone Express/Node deployment exists. Verify Cloudflare's handling of CVE-2026-111497; track this separately from our local Node update. Do not change a compatibility date as a substitute for provider patch confirmation.
2. Record production revision IDs, relevant configuration, and a dependency/test baseline. Measure comparable traffic for errors, latency, authentication, order/activation failures, email backlog, scheduled-job failures, and D1/Worker resource use using existing observability. Set numerical rollout thresholds from those observations before deployment.
3. Provision distinct staging D1 and R2 resources, including a private test receipt bucket, separate staging credentials/signing secrets, and a staging origin. Seed synthetic data. Verify that the built staging frontend calls the staging API and uses staging media URLs.
4. Route staging emails to a tested capture mechanism or controlled test-recipient allowlist. Do not assume an undocumented `EMAIL_PROVIDER` value suppresses sending. Inspect and stub/redirect every external integration reached by the tested flows, including AI calls, webhooks, payment integrations if present, and notification delivery.
5. Keep staging schedules disabled initially. Exercise minute, five-minute, and daily jobs deliberately against staging data and captured outbound actions. Confirm runtime configuration and dashboard triggers rather than relying only on TOML inheritance.
6. Add a preflight check that refuses remote test/deploy targets with production resource IDs, bucket names, credentials, or API origins. Verify tests cannot follow a fallback to a production binding.
7. Record D1 recovery capability and a recovery bookmark/export using the available plan features; rehearse recovery only on an isolated database. Document how test resources affect quotas and cost so the setup does not impair production capacity.

Exit gate: synthetic writes appear only in staging; no production emails, files, rows, queue work, or integration actions occur; candidate and previous deployment artifacts are identifiable. Local runtime patching and offline code review can proceed while staging is prepared.

## 2. Patch the build/runtime environment and reduce development exposure

This work can begin immediately without changing the running production website.

- Move the local and verified build/CI runtimes to a supported patched Node 24 release. The October advisory minimum is 24.22.1; select and record the current approved patch at implementation time.
- Pin/document the approved runtime and enforce it in builds. Align the project `engines`, version file/build settings, and the package manager actually used. The manifest currently declares pnpm 10.4.1 as `packageManager` while its dependency resolves a different pnpm version; assess both rather than updating only one declaration.
- Reinstall from the lockfile under the patched runtime and verify native tooling, particularly better-sqlite3, on the developer/CI platforms used. Preserve reproducible frozen-lockfile installs.
- Make Vite/Express development listeners default to loopback. Provide an explicit controlled opt-in where LAN access is a real workflow requirement. Confirm both Vite configuration and the outer Express listener; changing one does not establish effective isolation.
- Keep Vitest UI/API servers private and disabled when not needed. Patch Vite/Vitest and their transitive dependencies in a tooling change set after capturing the original test baseline. If a major test-runner update is necessary, review its configuration/assertion changes and preserve discovery and coverage.

Exit gate: approved runtime and package-manager versions recorded; clean install, original test discovery, typecheck, frontend/SEO build, and Worker build work, with pre-existing failures explicitly separated from regressions. Do not proceed with unexplained failures in a critical business flow.

## 3. Remediate application dependencies by exposure

Create an advisory register using the saved audit response and a refreshed registry check. For each advisory record the affected locked version/path, client/server/tool scope, inclusion in the emitted Worker/browser bundles, exploit prerequisites, selected fix, and validation evidence. Mark entries as fixed, not applicable with evidence, or temporarily mitigated with a named owner and an expiry/review date. A temporary mitigation is not closure of an affected dependency.

| Work item | Approach | Business validation |
|---|---|---|
| Zod 4.3.6 | Prioritize a compatible patched 4.x release; the prior advisory minimum is 4.6.6. Review all affected collection schemas. | Existing valid requests still pass; quiz/survey/bulk workflows retain intended capacity; oversized invalid input fails safely in isolated tests. |
| Drizzle ORM 0.44.7 | Review identifier handling and actual user influence; choose a compatible fixed release without generating migrations. | D1 queries, parameter binding, transactions/batches, affected-row handling, ordering, financial totals, and permissions. |
| Axios 1.13.5 | Check actual reachable imports/adapters and advisory prerequisites; patch compatible usage or remove confirmed unused code with evidence. | Required outbound requests, authentication, redirects, timeouts, headers, response handling, and retries. |
| AWS SDK → fast-xml-parser 5.3.4 | Removed locally after confirming no SDK/presigner/parser usage in this checkout; see the AWS/XML checkpoint. Verify deployed artifacts during release preparation. | Native R2/storage suites pass locally; live video playback/seek and private receipt integration remain release checks. |
| Nano ID and other browser/transitive packages | DOMPurify/Mermaid/lodash-es updated and screening HTML insertion fixed locally; see the rich-content checkpoint. Nano ID usage, stale overrides and remaining packages are next. | Local rich-content/browser checks pass; ID generation and authenticated business/browser release checks remain. |
| Express → proxy-addr | Patched locally to 2.0.8 within Express's existing range; no trust-proxy setting found in application code. Verify any deployed standalone ingress and separate direct forwarded-header handling. | Local proxy, cookie/account and development-host checks pass; deployed client-IP/header provenance remains a release check. |
| Vite, Vitest → Tinypool and other tooling | Vitest 4.1.12 and Vite 7.3.7 are verified locally; Tinypool is removed. Rollup/PostCSS/picomatch and other transitive tooling findings remain tracked. | Original discovery/counts/assertions, critical workflows, builds, SEO and a loopback dev-server smoke check pass at the documented baseline; browser/business release gates remain. |

For input limits, derive sensible caps from actual legitimate batch sizes, documented upload limits, and existing tests. Review encoded payload overhead. Apply endpoint-specific limits with clear errors; a single small global limit could break payment proofs, finance receipts, support media, surveys, or admin bulk actions. Test boundary-valid requests and over-limit rejection. Use bounded fixtures rather than attempting memory exhaustion.

Preserve externally visible behavior. Defer unrelated authentication, cookie, CORS, CSP, rate-limit, and framework changes to separately tested work unless a confirmed finding specifically requires them. If an edge rule is needed for an actively exposed issue, scope it to the affected traffic and validate webhooks, API polling, signed URLs, and video range requests before enforcement.

Exit gate: reachable high/critical findings in the release scope are fixed or have an evidenced effective temporary mitigation with owner/expiry; all remaining entries have explicit status. An unexplained reachable critical issue blocks release completion even if the raw audit total drops.

## 4. Validate business behavior before promotion

First capture results on the original code in the isolated environment, then compare the candidate. Existing source-contract tests are useful but do not replace representative integration and browser checks.

| Business area | Required checks |
|---|---|
| Accounts and staff | Existing sessions survive; student/staff/admin login and logout; password recovery; cookie behavior; role boundaries; unauthorized actions remain denied. |
| Sales and access | Public prices and VAT; checkout authentication; test order/payment-proof submission; staff payment confirmation; package-key activation, duplicate prevention, renewals/upgrades, pending activation, and refunds/access revocation. |
| Learning and live packages | Correct course/LexAI/live-package access; video start/seek/range requests; documents; lesson progress and quiz submission; expiry/freeze rules. |
| Messaging and automation | Support conversations and uploads; recommendations and thread mute; email queues, webhook processing, deduplication/retries, staff badges, minute/five-minute jobs, and daily lifecycle jobs. |
| Finance and public pages | Private receipt upload/access; financial totals and reports; Arabic/English public/customer/staff pages; navigation and SEO output. |

Validation commands planned from existing scripts: `pnpm check`, `pnpm test:critical-cycle`, `pnpm test`, `pnpm test:seo`, `pnpm build`, and `pnpm build:worker`. Confirm test isolation and command side effects before execution. Use the root Vite configuration. Run existing focused finance/payment, cookie/auth, media, and webhook tests relevant to the changes. Add integration checks where existing tests only inspect source strings.

Also validate Worker-specific request handling and D1/R2 integrations, candidate bundle contents, frozen-lockfile reproducibility, and negative security cases. Do not perform destructive security tests against production.

Exit gate: critical workflows pass, no new relevant type/build/test failures, legitimate inputs remain accepted, security cases pass, and the business tester confirms representative student and staff journeys. Record exact dependency versions and candidate artifacts for promotion.

## 5. Release with observation and a rehearsed rollback

1. Choose a measured lower-traffic window outside live teaching or major campaigns, and check planned bulk notifications/finance work. Minute jobs continue to matter even in a quiet window.
2. Promote the exact verified artifacts. Prefer a Worker-only release when frontend assets do not change. If both must change, keep contracts compatible with already-open browser sessions and deploy in a tested order. Do not combine this work with schema/binding changes or unrelated features.
3. Use a controlled version deployment with previous revision IDs recorded. Only use split traffic after verifying support, routing/version behavior, and the effects on scheduled/background work. Do not duplicate queues, crons, order processing, or notifications to simulate a canary.
4. Perform production read-only checks, plus tightly controlled designated-account smoke tests when needed. Do not create real charges, alter customer entitlements, or send customer test notifications.
5. Observe closely for the first 30–60 minutes and continue through at least one complete daily-job cycle, including 02:30 and 08:00 Asia/Amman jobs documented in the current config. Compare error rates, p95 latency, auth failures, order/activation outcomes, video errors, email backlog, provider failures, Worker CPU/memory errors, and D1 usage against the baseline. Low traffic alone is not evidence a path is healthy.

Rollback immediately for a reproduced login/order/activation/access regression, data-integrity issue, duplicate delivery, or failed critical smoke test. For performance/error changes, use the numerical thresholds defined before deployment; halt promotion while diagnosing a breach. Record who initiates rollback and test access to the procedure in staging.

Rollback restores the previous compatible Worker and, where changed, Pages artifact. It preserves newly created orders, payments, progress, files, and notification state. **Do not restore the production database as a routine code rollback**: that could erase legitimate business activity. If bad writes occurred, stop the affected write path and plan targeted reconciliation; database recovery is a separate incident action.

Cloudflare documents that Worker rollback does not roll back connected resources, and schema/resource changes can prevent a safe rollback. This is why the initial production releases preserve schema and bindings. A rollback can also reintroduce a vulnerability; retain an effective narrow mitigation and prepare a corrected patch before resuming the affected operation.

Sources: [Workers rollback behavior](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/), [D1 recovery documentation](https://developers.cloudflare.com/d1/reference/time-travel/). Verify the account's actual capabilities during preparation.

## Completion and ongoing prevention

- Verify the approved patched Node version on every relevant host and obtain evidence for the production runtime/provider question.
- Refresh audits after each resolved change set and retain the final inventory, lockfile, reachability decisions, and test results. No applicable high/critical finding is left without a verified fix or a time-limited mitigation/owner.
- Complete production business checks and the scheduled-job observation period. Record rollback readiness and outcomes.
- Add scheduled dependency scanning and runtime checks; use small compatible update proposals. Initially gate new or worsened high/critical findings and triage the existing baseline explicitly rather than silently accepting it. Expired exceptions fail the gate; scheduled checks should detect newly disclosed issues in otherwise unchanged dependencies.
- PHP remains outside this project's identified stack; revisit only if inventory reveals another PHP-backed service.

Implementation starts with read-only production verification, isolated staging preparation, and the local/runtime/tooling work. Production deployment is a later, reviewable action after these exit gates are satisfied.
