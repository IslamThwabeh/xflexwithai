# Security release readiness and rollback runbook

> **Superseded after support release `1e8a7f4` / `ba4216c`. Do not deploy the archived candidate or use its older rollback targets.** Use [the rebuilt support-baseline runbook](security-release-readiness-support-baseline-2026-10-25.md), which preserves the support improvements and security cron-test correction. Its rollback baseline is Worker `4b952089-4bd2-4bcd-8f26-006707b01bba` and Pages `875d6ef3-0e42-4c28-99bf-9d11fc626905`. The owner later waived the 90% provider-verification condition after team receipt and authorized deployment after backups; see [the notice record](security-release-notice-2026-10-25.md). Earlier evidence below is historical.

Assessed: **25 October 2026, Asia/Amman**. This is a readiness review of the completed local security changes, not deployment authorization or a restart of the deferred vulnerability backlog.

## Decision

**Focused readiness work completed: a scoped candidate and production-input artifacts are prepared for release review.** The confirmation suite has no new failures, but still has three reviewed baseline failures. This is a conditional release recommendation, not an all-green sign-off: accepting those exceptions, confirming release ownership/window and collecting the live monitoring baseline remain deployment gates. The user has deferred the Cloudflare/Brotli provider question; it is not a release gate and is not recorded as resolved.

No Git push, deployment, rollback, database operation or production configuration change was performed for this readiness review.

## Evidence already available

- Full candidate confirmation, **25 October**: **1,025 passed / 3 existing failures / 1,028 total**, across 194 files. All **33 critical-cycle files / 203 tests** passed. TypeScript, frozen dependency installation and **29 runtime/staging-policy tests** passed.
- The three baseline failures have a [specific triage and recommended exception disposition](security-release-baseline-triage-2026-10-25.md). Their source and test files remain unchanged. The full-suite exit code remains 1; user exception acceptance is still pending. Two additional financial tests failed during a concurrent build, then passed 8/8 in isolation and passed in the full confirmation run without changing assertions or timeouts.
- Node 24.22.1 was used for installation, checks and builds. The Windows shell activation does not change system-wide Node.
- A fresh registry audit on 25 October reports **0 critical, 28 high, 18 moderate and 6 low** findings; `--audit-level=critical` exited successfully. High/moderate/low findings remain in the user's deferred scope. This does not attest to the managed provider runtime or establish production exploitability.
- Candidate identity: **`1161700c2727e10e2df9abdb5a818920eea422bd6c64784b5ee0b25a5080639b`**, a SHA-256 identity of 814 sorted source/configuration/test/asset hashes. It selects 30 changed/new application/configuration/test files against base commit `bfda25efa922ba87627bc0c6f9b6ddb867e269e5`. Source hashes were checked again after verification. This is an archived, uncommitted candidate; no Git commit or push was made. Documentation/reports are outside the executable candidate identity.
- The intervening committed difference from the Pages-reported source commit is project-memory documentation only. Backend/database/shared source has no committed change from the active Worker's reported source commit `d60bc21` to HEAD. The selected source changes add development safeguards and safe AI rendering; there is no schema migration or production configuration change. Deployment metadata is supporting evidence, not byte-for-byte live artifact attestation.
- Read-only Cloudflare checks at **09:12 UTC on 25 October** reconfirmed the rollback versions below, all four live production schedules, compatibility date and flags. Earlier same-day checks confirmed plain variables and D1/R2 binding identities match local production settings. Public API health and Arabic/English pages returned 200; www redirected to the canonical apex.
- The staging guard was rerun and correctly failed: staging shares production D1/video storage, lacks an isolated finance-receipt binding, and lacks distinct site/media origins. It is unavailable for remote write testing as configured.
- Frontend/standalone and Worker builds passed with **`VITE_API_URL=https://api.xflexacademy.com`** and dynamic article fetching enabled. The read-only production article endpoint returned HTTP 200 and a three-record array; the generator produced 36 public pages and six article pages. SEO tests passed. All observed built-site API requests used the production origin and were intercepted during browser testing.
- **11/11** isolated content/diagram checks and **9/9** built-site browser scenarios passed: Arabic/English home, both package pages, checkout account/return-path selection, customer/admin access redirects and Arabic/English Admin Jobs AI evaluation with synthetic responses. No browser runtime errors or local asset failures occurred. These are frontend checks against synthetic API data, not real paid checkout or authenticated production journeys. Screenshots of checkout and Arabic Admin Jobs were visually inspected.
- The built Worker passed **6 actual local workerd checks** with dedicated local D1/R2 and fake identifiers: health, D1 SELECT, anonymous tRPC session, protected-procedure rejection, allowed-origin credentialed CORS and untrusted-origin rejection. No cron was invoked and no production credentials were supplied. Business mutation/financial/entitlement coverage comes from the full suite's mocks and disposable SQLite/D1 fixtures; a remote staging end-to-end journey was not performed.
- Wrangler **4.83.0** production packaging **`--dry-run`** passed without upload. The packaged Worker, Pages assets, Functions source and source snapshot were archived. Artifact-set identity: **`4bf7a3025b67c3b66ab545316e3c2af8586536e756ff9e7da75a15f39867daae`**. Each ZIP entry was read back and checked against its SHA-256 manifest. No compared private local environment value was found in public build output; the selected changed-file scan found no high-confidence credential pattern. These bounded checks are not a comprehensive secret attestation.

Local retained evidence lives in `.tools/security-release-readiness/candidate/` (ignored): `source-manifest.json`, `artifact-manifest.json`, `source.zip`, `artifacts.zip`, both full-suite reports, the financial rerun, browser/runtime reports and dry-run logs. Source ZIP SHA-256: `2dca0d2cfc1b904a31e98ed0dad0b74949844e17f7128fad23a2089318145c09`; artifact ZIP SHA-256: `e54210018a42af1c0089b7d0ad24c21292da0d044b61feb06dd6c6f689c8333f`. The portable summary is `security_release_readiness_2026-10-25.json`.

## Go/no-go checks

| Check | Current status | Required before promotion |
| --- | --- | --- |
| Exact release scope | Reviewed, hash-frozen and archived | Create a publication commit containing the selected source plus intended documentation; verify executable source hashes still match. Recheck if any source/configuration/dependency changes. |
| Local regression evidence | Candidate checks complete; baseline exceptions remain | Retain reports and hashes. Repeat relevant checks only for changed source, new failures or changed build inputs. |
| Existing test failures | Three triaged; no new failure in confirmation | Accept the explicit baseline exceptions in the deployment decision, or resolve them in a separate reviewed candidate. Do not globally ignore nonzero test exits. |
| Production artifact | Built, checked and archived | Promote the verified artifacts using the recorded CLI/configuration. If packaging is repeated, compare output hashes. Pages Functions platform compilation is still part of actual deployment. |
| Business/browser verification | Scoped browser, local runtime and fixture checks complete | Live authenticated/purchase/end-to-end testing is not claimed. Use designated synthetic data for any later production mutation check. |
| Remote staging safety | Blocked as configured | Keep the isolation guard. Use local Cloudflare/D1/R2 fixtures for isolated integration work, or prepare distinct remote resources before any staging write/integration run. A Pages-only preview must intercept/isolate API traffic before it can exercise synthetic mutations. |
| Production resource compatibility | Settings/resources and all four schedules match at snapshot | Refresh immediately before release; preserve schema, bindings, secret/session keys and schedules. |
| Rollback baseline | Targets read-verified; not rehearsed | Refresh targets, retain candidate and baseline evidence, confirm operator access and component compatibility. Record that rollback has not been rehearsed; use an isolated environment for rehearsal where available. Do not test rollback by disrupting production. |
| Observation and ownership | Stop criteria prepared; live metrics and ownership pending | Name a release operator and business checker, select a suitable window and capture the comparable live baseline immediately before deployment. |

These are delivery checks for the selected changes, not a requirement to finish all remaining high/moderate/low findings.

## Verification sequence

1. **Freeze a candidate.** Review/stage the intended files only and record the candidate commit. Pin the source/configuration/lockfile and exact artifact hashes. Keep the current working work intact while preparing a scoped release.
2. **Check the candidate locally.** Activate `scripts/use-project-node.ps1`; verify runtime; install with `pnpm install --frozen-lockfile --ignore-scripts`; run the Node runtime/staging-policy tests, `pnpm check` and the full Vitest suite with JSON results. This candidate's stable confirmation used `--maxWorkers=2` without a concurrent build. The full suite includes the critical and focused security tests. Any unresolved failure outside the reviewed three-test baseline blocks promotion.
3. **Run the selected browser checks.** The content fixture can be run with `node scripts/check-content-rendering.mjs release-candidate`. For an application preview, isolate network/API effects before loading it; a normal preview name does not establish isolation. Test representative Arabic/English public pages and the changed Admin Jobs/LexAI rendering. Capture console/runtime errors and failed assets/API calls.
4. **Verify relevant business behavior.** For a Worker/backend release, cover sessions/login and roles, prices/VAT, checkout/payment proofs, financial totals, key activation/renewal/access, documents/video seeking, private receipts, support/recommendations, and scheduled/outbox deduplication. Use synthetic data and captured external delivery in local Cloudflare fixtures or isolated staging. A scoped Pages-only release can retain the API and use focused frontend/read-only journey checks appropriate to its unchanged API contracts.
5. **Build the production artifacts.** Use the approved runtime and explicit production API/SEO inputs; run SEO checks after the frontend build. Build a Worker only if that component is selected. Archive the exact verified artifacts, their hashes, target IDs and candidate revision. Validate frontend/Worker compatibility before selecting deployment order.
6. **Present release evidence.** Record the selected components, known exceptions, test results, artifact IDs, rollback targets, operator and business checker. The release decision is separate from this readiness review.
7. **Promote and smoke-check.** During an approved release, promote only the verified components. If both change and API compatibility is confirmed, deploy/verify the Worker before promoting Pages. Record the new deployment/version IDs. Check `/health`, redirects, public assets/SEO and approved authenticated read-only journeys immediately.
8. **Observe.** Watch errors, auth/access outcomes, orders/activation, video/private-file errors, Worker/D1 resource use, email backlog and scheduled-job results. Observe closely for 30–60 minutes and through one full daily-job cycle, approximately 24 hours elapsed. Capture a comparable live baseline before release and apply the criteria below. Public health timings collected here are sparse smoke measurements, not a representative customer-traffic latency/error baseline.

## Prepared stop criteria and release handoff

- **Immediate stop/rollback:** any reproduced release-caused login/role/access, checkout/payment, activation, private-file or video failure; duplicate email/job delivery; data-integrity issue; or failed critical smoke scenario.
- **Errors:** investigate and stop promotion for at least five unexpected 5xx/Worker-exception failures in five minutes. Roll back for a sustained five-minute 5xx/Worker-exception rate at least one percentage point above the pre-release baseline, with at least 50 requests in that window. Expected client validation/authentication rejections are not counted as server failures. Low traffic does not override the immediate functional triggers.
- **Latency:** stop promotion and investigate if comparable endpoint p95 is both above 1,000 ms and over twice its pre-release p95 for five minutes with at least 50 requests. Roll back if the release is the identified cause. These are prepared operational defaults; use comparable request classes and record any adjustment before deployment.
- Capture the preceding 15 minutes of comparable traffic/error/latency metrics and current queue/job state before promotion. Access to representative account analytics and a full paid/authenticated production journey was not exercised in this phase.
- The operator, business checker, release window, baseline metric values and acceptance of the three existing test failures must be entered in the deployment record before publishing. They are not inferred from this readiness authorization.
- The candidate contains no migrations, binding replacement or signing-key/session rotation. If that scope changes, reassess rollback and data compatibility before release.

## Rollback targets and procedures

Snapshot checked on 25 October 2026. Refresh if another release happens before promotion. These are the current production versions to restore **after a future release**, not a reason to execute a rollback now.

| Component | Pre-release target |
| --- | --- |
| Worker | `xflexacademy-api-production`, version `059c1e23-9e9d-4383-94e0-fb62f881c25e` |
| Worker deployment record | `fce4f365-90dd-40e3-aee0-c49cee7bd80f` |
| Pages | Project `xflexacademy`, production deployment `9a6bfc98-8544-4e55-9b68-1cc9410ec60e` |
| Pages baseline URL | `https://9a6bfc98.xflexwithai.pages.dev` |

**Worker procedure — command prepared, not executed:**

```powershell
. .\scripts\use-project-node.ps1
wrangler rollback 059c1e23-9e9d-4383-94e0-fb62f881c25e --config wrangler-worker.toml --env production --message "Rollback security release: describe incident"
```

The installed CLI supports this syntax. Rollback permissions and an actual rollback have not been exercised. Cloudflare creates a new deployment using the selected version. It supports the 100 most recent published versions, and connected-resource compatibility still matters. [Workers rollback documentation](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

**Pages procedure — prepared, not executed:** In Cloudflare, open Workers & Pages → `xflexacademy` → Deployments → All deployments. Locate the pinned successful production deployment above, open its actions menu, choose **Rollback to this deployment**, verify the target and confirm. Preview deployments are not valid rollback targets. The installed Wrangler CLI has no Pages rollback subcommand, so use the documented dashboard workflow or reviewed API operation. [Pages rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/).

If both components were released and the failing component is unclear, stop promotion and restore the verified compatible pair, normally Pages first and then the Worker. If only one component changed, restore that component. Verify the restored platform IDs and rerun health plus the failed smoke scenario.

## Rollback triggers and data protection

Rollback promptly for any reproduced release-caused login, authorization, checkout/payment, activation/access, private-file or video regression; a data-integrity problem; duplicate delivery/job execution; or a failed critical smoke check. Error/latency breaches use the numerical thresholds recorded before release. A pre-existing failure is handled by its explicit exception, not a blanket permission to ignore failures.

**Code rollback preserves new customer activity.** Do not restore the production database or delete new orders, payments, progress, files or notifications as a routine release rollback. Resource/data state is not reversed by Worker rollback. If incorrect writes occurred, stop the affected operation and reconcile the affected records through a separate incident process. No migration, binding replacement or signing-key/session rotation belongs in this release scope.

The source/artifact rollback path is documented, target identities are read-verified, and the candidate's archives were verified. Actual Cloudflare rollback permissions and end-to-end rollback execution have **not been rehearsed**. Isolated Worker smoke checks do not constitute that rehearsal. The remaining deployment-decision/observation gates above must be completed before promotion; no production sign-off or publication occurred in this phase.
