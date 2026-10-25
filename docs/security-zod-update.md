# Zod security update — 24 October 2026

## Change and applicability

The application dependency is pinned from Zod **4.3.6** to **4.6.7**. The lockfile, installed application dependency, and OpenAI's existing optional peer resolution all select 4.6.7; no active 4.3.6 resolution remains in the lockfile. No application schema, business rule, request capacity, database schema, or production setting was changed for this phase.

The [reviewed advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) lists versions below 4.6.6 as affected. The [maintainer fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd) rejects oversized bounded arrays, sets and maps before walking their elements. The [4.6.6 release notes](https://github.com/colinhacks/zod/releases/tag/v4.6.6) include that fix; the maintainer comparison to the current stable [4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7) showed version/release metadata changes.

The npm bulk advisory endpoint returned no advisories for 4.6.7 at verification time. The scoped response and installed/locked version evidence are saved in `security_zod_audit_2026-10-24.json`. This is a Zod check, not a clean audit for all dependencies.

## Behavioral evidence

`server/zodRequestValidation.test.ts` tests the registered API input schemas directly, without invoking write handlers, plus one invalid public registration call that fails before business logic. It performs no customer data operations or external delivery.

Before the update, all **10 compatibility checks passed** and the **3 security regression checks failed** on Zod 4.3.6. With 4.6.7, all **13 checks pass**:

- Bilingual registration, unknown-key stripping and tRPC `BAD_REQUEST` behavior.
- Quiz answer acceptance and the existing non-empty requirement.
- The existing 100-answer survey boundary, trimming and nullable values.
- The existing staff survey audience capacity and audience/date refinements.
- The existing 1,000-recipient notification boundary and optional fields.
- Staff form record validation.
- Early rejection of an oversized notification array without reading its elements, and oversized set/map rejection without invoking element validators. These use small, bounded fixtures rather than resource-exhaustion probes.

Run this focused suite in the approved runtime with `pnpm test:security-zod`.

## Wider verification and existing failures

Frozen-lockfile installation passed with lifecycle scripts disabled. Project TypeScript, frontend/standalone Node build, static/curated SEO checks, and Worker build passed under Node 24.22.1. The frontend retains its existing large-chunk warning. The Worker bundle is approximately 3.2 MB uncompressed; deployment size/quota checks remain part of release preparation.

The full root Vitest suite ran with four workers: **966 tests passed and 3 failed**, across 189 files. All **33 critical-cycle test files passed** within that run. The three failures are:

| Test file | Existing contract failure |
|---|---|
| `server/adminSubscribersReportUi.test.ts` | Subscriber report currency/rendering source assertion. |
| `server/clientKeyActivationNavigation.test.ts` | Expected Arabic renewal wording is absent from the current packages page source. |
| `server/financialAuthorizationUi.test.ts` | Expected finance-manager navigation excludes the current `/admin/copier` entry. |

The same three failures reproduced with cached Zod **4.3.6** in an isolated temporary Vitest configuration. An additional baseline proof confirmed the old collection parser was selected in that run. The implicated UI/permission files, router schemas and database business logic were also compared with the repository revision and are unchanged. These failures are independent of the Zod update; their underlying UI contracts still need separate review. They were not hidden, disabled, or weakened to make the suite green.

The Windows sandbox prevented esbuild from traversing the project configuration path. The local test/build commands were rerun using approved tool escalation. No deployment or remote data operation was involved.

## Limits and next work

- A collection without an upper bound remains unbounded. This dependency update improves enforcement of existing size bounds; it does not supply missing application limits or guarantee protection from every denial-of-service input. Quiz/job and other unbounded collections require a separately scoped review of legitimate capacity and request limits.
- OpenAI 4.104.0 already declares an optional Zod 3 peer while this project already used Zod 4. That warning persists, and no application imports of OpenAI's Zod parsing/format helper APIs were found. The SDK version was not changed here; reassess compatibility before adopting those helpers or during the SDK update phase. The existing Vite-plugin peer warning also remains outside this change.
- Remaining runtime/provider, staging isolation and other dependency findings stay open. Existing UI-contract failures require review before claiming a fully passing release baseline.
- Validation builds disabled dynamic article fetching and are not approved production artifacts. Rebuild with the intended production inputs before release. Nothing was deployed, and the unsafe staging resource preflight remains in place.

The next focused dependency review is Drizzle ORM, with explicit checks around D1 query behavior and financial/access workflows and no planned schema migration.
