# Security release — support baseline preserved

Current release preparation, **25 October 2026, Asia/Amman**. Supersedes the older archived candidate in `security-release-readiness-2026-10-25.md`.

## Authorization and scope

The owner authorized production deployment after backups and explicitly waived the earlier 90% provider-delivery verification condition after the owner/team received the maintenance notice. This is a release decision, not measured 90% delivery. The latest measured notice counts were 163 provider-accepted addresses and eight provider-confirmed unique deliveries out of 174 valid selected addresses. No accepted email was resent. See [notice record](security-release-notice-2026-10-25.md).

Preserve support source commit `1e8a7f41abd330be210361ff0fa529549f11ab1e` and release-record commit `ba4216c`. HEAD was `ba4216c` when the new candidate was frozen. All 63 pre-existing security-work files matched the other chat's preservation manifest at handoff. The five support implementation files remain unchanged against HEAD. The security cron-test correction is retained. No activation policy, role, migration, signing-key rotation, customer-access change or R2 object operation is part of this release.

The older security archive is explicitly marked **superseded and not deployable**. Only the rebuilt candidate below may be published.

## Candidate and verification

| Item | Verified result |
| --- | --- |
| Source candidate | `434e425c44305f12a90b8875b7620c3893213dfa10abf1624d868c6664a73109`, 815 source/configuration/test/asset entries; 30 selected changed/new application/configuration/test files |
| Artifact set | `93c82c3371ac9be32b3f81bac12758b92564ba3936eb68e22aaf047a9d7dcebe`, 772 archived entries |
| Runtime/install/typecheck | Node 24.22.1, frozen install with scripts disabled, TypeScript and 29 runtime/staging-policy tests passed |
| Full regression | 1,025 passed, three unchanged baseline failures, 1,028 total across 194 files; full-suite exit code 1 preserved |
| Critical cycle | All 33 files / 203 tests passed, derived from the full report |
| Known baseline exceptions | Subscriber CSV terminology, Arabic renewal wording, finance-manager copier navigation; unchanged business behavior and assertions. See [triage](security-release-baseline-triage-2026-10-25.md). |
| Browser/content | 9/9 built-site scenarios; 6/6 support-release scenarios including Arabic/mobile pending/freeze views; 11/11 content/diagram checks; all APIs intercepted synthetically |
| Actual local Cloudflare runtime | 6/6 health, local D1, anonymous-access rejection and CORS checks; isolated fake resource IDs, no cron invocation |
| Production-input artifacts | Frontend/standalone, Worker and SEO passed using `https://api.xflexacademy.com` and dynamic article fetching; 36 public pages and six article pages |
| Packaging | Wrangler 4.83.0 production dry run passed, with no upload |
| Dependency audit | Same unchanged lockfile as the fresh 25 October audit: zero critical, 28 high, 18 moderate, six low; remaining noncritical backlog deferred |
| Integrity | Both ZIP archives read back entry by entry against SHA-256 manifests; publication copy checked against all 772 artifact hashes; no matched private local environment values in public output |

These synthetic/fixture checks are not a full paid or authenticated production journey. Remote staging still shares production resources and remains blocked for write tests. The provider/Brotli item remains deferred at the owner's request.

Local source/archive/evidence: `.tools/security-release-readiness/candidate-ba4216c/`. Source ZIP SHA-256: `490748c999337ccfaf0d7603ad5f4b003d7fc8a401812226819ece59a02fd1c2`. Artifact ZIP SHA-256: `68ba71e6f6d7f1b8e857720203229d580718889bf6c7afd93774fff3fafc324d`.

## Backups and rollback baseline

The 18:01 UTC read-only snapshot confirmed:

- Worker baseline: **`4b952089-4bd2-4bcd-8f26-006707b01bba`**, 100% traffic, deployment `39d710f5-0089-4152-b861-e267453e3a83`.
- Pages baseline: **`875d6ef3-0e42-4c28-99bf-9d11fc626905`**, successful production deployment, source `1e8a7f4`.
- All four schedules match: `* * * * *`, `*/5 * * * *`, `30 23 * * *`, `0 5 * * *`.
- Verified D1 Time Travel recovery bookmark: **`00001800-00000092-0000510f-b7d3a1fd7869e933e173ed1d90be70b2`**, read at 18:01:40 UTC. Automatic Time Travel retains recovery history; no blocking SQL export or restore was performed. [Cloudflare recovery documentation](https://developers.cloudflare.com/d1/reference/time-travel/). SQL exports can temporarily make D1 unavailable, so they were not introduced into this business-preserving release. [Export behavior](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/).
- Recovery archive: **766 verified entries**, including the prior support Pages artifacts, package/lock/config/Functions source, exact-version current Worker download and recovery metadata. `.tools/security-release-readiness/candidate-ba4216c/recovery-snapshot.zip`, SHA-256 **`a7c028f3b3fe1f7f60100428e728e0b15c82a419a7494ae321c01dff78eddaea`**.
- No offline database dump or R2 object copy was made. This release does not mutate the schema or storage objects. Managed secret bindings are retained rather than exported.

Routine rollback restores code and preserves new customer data. Never restore the database as a routine release rollback. Investigate/reconcile bad writes separately if they occur.

Worker rollback, only if required after deployment:

```powershell
. .\scripts\use-project-node.ps1
wrangler rollback 4b952089-4bd2-4bcd-8f26-006707b01bba --config wrangler-worker.toml --env production --message "Rollback security release; preserve support changes"
```

Pages: Cloudflare → `xflexacademy` → Deployments → successful production deployment `875d6ef3-0e42-4c28-99bf-9d11fc626905` → Rollback. If both components changed and the cause is unclear, restore Pages then Worker. Recheck the failed scenario and restored IDs. The Cloudflare rollback operation has not been rehearsed end to end; code/recovery archives and platform target identities have been verified.

## Promotion and observation

1. Use an isolated security branch/check-out preserving both support commits; verify its executable source matches the candidate. Keep the main shared working files intact. Push normally; never force-push.
2. Use the verified publication copy at `.tools/releases/security-20261025/publish`. Confirm Wrangler authentication and retain existing variables with `--keep-vars`; do not use a shortcut that rebuilds the candidate after verification.
3. Deploy/verify the Worker first. Check its active version, artifact, bindings/variables/schedules, health, allowed-origin CORS and anonymous authorization denial. Stop before Pages if a critical check fails.
4. Promote the verified Pages assets/Functions with the security source commit attached. Verify canonical deployment metadata and live affected asset hashes, public Arabic/English pages, redirects and available signed-in read-only views. No production checkout/customer mutation test is implied.
5. Release operator: Codex acting under the owner's deployment instruction. Business checker: owner/team, with the currently disclosed test limits. Observe health/errors closely and retain metrics through the daily-job cycle; do not claim a 24-hour cycle has completed at release time.

Pre-release sampled Worker analytics, 17:44–17:59 UTC: **134 requests / zero errors**, with one client-disconnected invocation. Public health/pages returned 200 and www redirected to the canonical apex. CPU quantiles are recorded separately; they are not request latency percentiles.

Stop or roll back for a reproduced release-caused login/authorization, checkout/payment, activation, private-file/video regression, duplicate delivery/job execution, data-integrity issue or failed critical smoke. Investigate five unexpected Worker/server failures within five minutes; stop for a sustained five-minute exception/5xx rate at least one percentage point above baseline with at least 50 requests. Expected validation/authentication rejections are not server failures. Any available comparable latency baseline must be measured before using the older runbook's numerical latency rule; CPU time must not be substituted for it.

Publication IDs, source commit and post-deployment results will be recorded in `docs/security-production-release-2026-10-25.md` after actual promotion.
