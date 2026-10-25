# Critical-only security plan

Scope narrowed at the user's request on 24 October 2026. This is the active plan; the larger remediation program remains a deferred backlog.

## Current position

**Production update, 25 October:** the owner authorized the rebuilt security candidate after backups and waived the notice-delivery measurement gate after team receipt. Application commit `a7e1ad9` was pushed and deployed while preserving the support release. See [the production record](security-production-release-2026-10-25.md) for current IDs, checks and recovery targets. Earlier statements below about no deployment describe the preceding assessment checkpoint.

**25 October readiness update:** the user separately authorized a focused release-readiness phase. It produced a hash-frozen source snapshot and verified production-input artifacts, repeated the full/critical tests, checked the built UI and isolated Cloudflare runtime, and refreshed rollback/schedule evidence. See [the release runbook](security-release-readiness-2026-10-25.md) and [the three-test baseline triage](security-release-baseline-triage-2026-10-25.md). No push or deployment occurred. This preparation is not evidence of a new critical production vulnerability or a request to finish the deferred dependency backlog.

Read-only production checkpoint: the active API Worker was downloaded by exact version and checked with a matching ETag. No original critical dependency package/name/signature/import was identified. Public health checks pass, and the saved local critical audit is zero. No emergency critical dependency release is indicated on this evidence. Pages middleware was reviewed at the deployment-reported commit, with the exact live Functions artifact still unverified. The Cloudflare native Brotli/runtime assurance question is deferred at the user's request and is not a release gate. See `docs/security-critical-production-review.md` and `security_critical_production_review_2026-10-24.json` for scope and limits. Production promotion remains conditional, not an automatic next action.

The latest saved local dependency audit reports **zero critical findings**. The original critical-rated matches involving fast-xml-parser, proxy-addr, Vitest and Tinypool have been addressed in the working tree. Their production exploitability was conditional, not established by the original audit.

Nothing has been deployed. Local audit clearance does not establish which code/dependencies run in production or attest to the provider runtime. Completed local fixes are retained; this scope change does not revert them or authorize deploying the whole working tree.

## Small closeout plan

| Step | Work | Hands-on estimate |
| --- | --- | --- |
| 1. Verify actual critical exposure | Read-only inspection of deployed revisions, runtime/build configuration and any standalone Node server. Determine whether any original critical dependency path is present and reachable. Check the outstanding runtime/provider question separately without labeling it a confirmed critical finding. | 45–90 minutes |
| 2. Prepare only what is necessary | If production exposure warrants a release, select the smallest justified patch set from the completed work, record candidate/rollback versions, and verify the frozen install, relevant security checks, critical business tests and required builds. Preserve the documented pre-existing test baseline. | 45–90 minutes |
| 3. Release conditionally | Present the concrete candidate and test evidence for release review. If authorized and applicable, deploy in a suitable business window, perform focused smoke checks and observe existing metrics. | 30–60 minutes |

**Planning allowance: approximately 2–4 hours of hands-on work**, assuming access is available and no new critical issue is discovered. If the first review finds no production-critical exposure requiring changes, stop after documenting that result; deployment may be unnecessary. Waiting for credentials/provider confirmation is additional elapsed time.

If deployed, observe errors and critical business outcomes through at least one complete daily-job cycle, approximately **24 hours elapsed**. This is a monitoring window, not 24 hours of continuous engineering work.

## Business protections and completion

- Preserve business rules, database schema, customer sessions, signing keys and production bindings in the selected patch set.
- Keep the existing staging isolation guard. Any required write/integration test must use isolated resources and synthetic data; shared staging is not a shortcut. If the selected fix needs additional isolation/setup, estimate that specific requirement before expanding work.
- The three existing UI-contract failures remain documented. Investigate within this scope if they affect the selected critical fix or its business checks; do not weaken assertions to manufacture a green result.
- Complete when the known critical findings are either fixed in the applicable environment or shown not to apply with evidence, and any necessary release has test/rollback evidence and observation results. Zero local audit entries alone is insufficient.

## Deferred

Further Nano ID and other high/moderate/low dependency upgrades, broad compatibility cleanup, unrelated UI fixes, a full staging buildout and scanning automation are deferred. These are tracked risks/work, not findings declared safe. Promote a deferred item into this plan only if evidence establishes critical impact/reachability or it is necessary for a critical fix.

## User-directed deferral — 25 October 2026

The user has asked to stop pursuing the Cloudflare/Brotli provider question. Record it as deferred with unverified applicability/patch status, not as fixed or confirmed unaffected. It is not a release gate under the current user-selected scope. This deferral does not waive unrelated test, artifact, rollback or production-isolation checks. Release readiness is assessed separately in `docs/security-release-readiness-2026-10-25.md`.
