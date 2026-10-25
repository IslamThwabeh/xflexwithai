# Vitest/Vite security tooling update — 24 October 2026

## Change and scope

Pinned **Vitest 2.1.9 → 4.1.12** and **Vite 7.3.1 → 7.3.7**. These are the current stable releases on the selected major-version branches at the registry check. Their Node requirements accept the project's Node 24.22.1. Other direct dependency declarations and overrides are unchanged from the proxy-addr phase. [Vitest release](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12), [Vite release](https://github.com/vitejs/vite/releases/tag/v7.3.7).

Vitest 4 removes Tinypool through its pool redesign. The active lockfile now contains no Tinypool or nested Vite 5; it resolves Vite only to 7.3.7. The package inventory removes 48 package versions and adds 17, all related to the tooling change. Metadata for retained package versions is unchanged. [Vitest 4 migration guide](https://v4.vitest.dev/guide/migration.html).

Vite is shared by the frontend build/development server and the test runner. Its patch is included to address its own open advisories while using a compatible engine for Vitest. The root Vite and Vitest configurations, test sources, application sources and production settings are unchanged. No UI/API/browser test server was enabled in project configuration.

## Findings addressed locally

- **TOOLS-01:** the installed Vitest version was within the registry's critical UI/API advisory range. Its prerequisites involve UI/browser-mode or network exposure; the checked project runs Node-mode CLI tests and has no configured UI/API listener. This review does not attest to every developer's manual invocation. [Maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp).
- **TOOLS-02:** both Tinypool prototype-pollution gadget findings are removed from the active dependency tree. They require prerequisite prototype pollution and particular worker/run options; their presence did not establish a remote attack path in this website. Removing Tinypool does not establish that all prototype-pollution risks elsewhere are fixed. [Worker-options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3), [run-options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr).
- **TOOLS-03:** Vitest's redirect-mock file-read advisory is addressed by the selected version. Its standalone mocker-plugin/WebSocket prerequisites were not found in the searched application setup. [Maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).
- **TOOLS-04:** the fresh registry response contains no advisory entries for the selected Vite package. Its wider dependency closure still has findings, including Rollup, PostCSS and picomatch; these remain open.

No code-execution proof of concept, prototype mutation or request for real sensitive files was performed in this phase.

## Migration and validation

Reviewed the [Vitest 3](https://v3.vitest.dev/guide/migration.html) and [Vitest 4](https://v4.vitest.dev/guide/migration.html) migration guidance, including mocks, fake timers, pooling and removed options. No source/assertion/configuration adaptation was needed. Vitest 4 removes `minWorkers`; the full-suite command is now `pnpm test --maxWorkers=4`.

The old runner's `list` command failed inside its console reporter, including with `--silent`. Baseline discovery therefore comes from the completed pre-update full suite, with file hashes captured before changing dependencies. The updated runner's JSON report confirms the exact same **193 files and 1,014 tests**, with identical counts in every file. All original test files and the other checked application/configuration files remain unchanged: **697 source/configuration files verified**.

- **1,011 tests pass; the same three existing UI-contract tests fail**, concerning subscriber-report rendering, Arabic renewal wording and finance-manager navigation. No test was skipped or weakened.
- All **33 critical-cycle files / 203 tests** pass.
- Frozen-lockfile installation passed with lifecycle scripts disabled.
- The configured TypeScript check, frontend/standalone build, Worker build and SEO checks pass under Node 24.22.1. SEO checks cover 36 static pages, six curated article pages and middleware behavior.
- Worker and standalone server outputs have identical SHA-256 hashes to the phase baseline. Worker metadata lists 371 inputs and no Vitest/Tinypool/Vite input or external runtime import. The standalone build keeps dependencies external; its unchanged output does not certify external dependencies or every frontend asset.
- An actual Vite server using the root project configuration was bound only to 127.0.0.1. HTML and entry-module requests returned 200; a synthetic hidden fixture file returned 403 without disclosing its marker. Browser code was not executed, and no production API was called. After requesting shutdown, the helper stayed alive with zero listening sockets and was explicitly stopped after verifying its process identity. This smoke check does not certify all Windows path variants or browser journeys.

Exact versions, package changes, per-file counts/hashes and validation results are in `security_tooling_dependency_audit_2026-10-24.json`. The raw registry response is in `security_tooling_registry_audit_2026-10-24.json`.

## Remaining work

Registry severity metadata changed from **3 critical, 37 high, 57 moderate and 14 low** to **0 critical, 31 high, 43 moderate and 12 low**. Zero critical classifications is not clearance of the website or proof of production security; the audit includes development tools and transitive packages.

Existing peer warnings remain for the Builder plugin's older Vite range and OpenAI's Zod range. The successful local checks do not establish complete compatibility with every optional plugin/provider feature.

Next small review: DOMPurify/Mermaid rich-content dependency usage and compatible remediation. Other build-tool findings, package-manager alignment, staging isolation, provider/runtime verification, the three existing UI failures and representative browser/Cloudflare business checks remain open.

Nothing was deployed, migrated or tested against production data. Validation artifacts disable external article fetching and require rebuilding with intended production inputs before release.
