# Scoped security production release

Released **25 October 2026**, Asia/Amman. Owner authorization: deploy after required backups; the owner explicitly replaced the earlier 90% provider-confirmation prerequisite after the owner/team received the maintenance notice. This record does not claim measured delivery to 90% of clients.

## Source and production identities

| Item | Published identity |
| --- | --- |
| Application source | `a7e1ad9c3659f83195c7e12115d4ad155824d153` |
| Branch | `codex/security-release-20261025-434e425c`, pushed to origin |
| Preserved support implementation | `1e8a7f41abd330be210361ff0fa529549f11ab1e` |
| Preserved support release record | `ba4216c` |
| Worker version, 100% | `cab4809f-3f70-4d42-9edd-50d9a6e7fd60` |
| Worker deployment | `883024f7-82ad-459e-ba49-92e1d38533f2`, 18:12:23 UTC |
| Pages production deployment | `950ecd6b-cd16-49c2-a847-bb6c0aa206aa` |
| Pages URL | <https://950ecd6b.xflexwithai.pages.dev> |
| Canonical site | <https://xflexacademy.com> |

The API was deployed first using the verified Wrangler-packaged module, `--no-bundle` and `--keep-vars`. Eleven API production checks passed before Pages was promoted. Pages used the verified assets and Functions source, production branch `main`, and the exact application commit in its metadata. No rebuild occurred after artifact verification. The CLI compiled the existing Pages Functions during upload.

Dependency/runtime/development safeguards and escaped AI-screening rendering were released. The support freeze/pending-service distinctions and team handoff remain present. No activation policy, staff/customer permission, database schema, key/session rotation or R2 object mutation was introduced. All existing plain variables, binding identities, secret binding names, compatibility settings and four schedules matched the preceding support version.

The release was prepared and committed in an isolated worktree, initially preserving the shared workspace on `ba4216c`. The owner then requested that everything be pushed. All 67 outstanding shared-workspace files were verified equivalent to published commit `959aa0e`; the current `codex/live-package-phase-a` branch was advanced to that history and pushed without changing working file bytes or resetting the workspace. Later record commits do not change the deployed application source `a7e1ad9`. Future chats must inspect current HEAD and this release record. The older security source/artifact candidate is superseded and was **not deployed**.

## Backups and recovery

- Verified recovery ZIP: **766 entries**, SHA-256 `a7c028f3b3fe1f7f60100428e728e0b15c82a419a7494ae321c01dff78eddaea`. It includes the prior support Pages artifacts, config/lock/Functions source, exact-version baseline Worker download and recovery metadata. Local path: `.tools/security-release-readiness/candidate-ba4216c/recovery-snapshot.zip`.
- D1 automatic Time Travel recovery bookmark was verified at **18:01:40 UTC** and refreshed immediately before Worker deployment at **18:12:08 UTC**: **`00001801-00000002-0000510f-de08fc001a0032ba1219d2ec6fb42dd4`**. The immediate snapshot is retained separately in `immediate-preworker.json`.
- No blocking offline database export or database restore was run. No R2 object-copy backup was made; the release does not alter stored objects or their bindings. Managed secret values were not exported.
- Verified release source/archive identity: `434e425c44305f12a90b8875b7620c3893213dfa10abf1624d868c6664a73109`. Artifact-set identity: `93c82c3371ac9be32b3f81bac12758b92564ba3936eb68e22aaf047a9d7dcebe`. All ZIP entries and the isolated publication copy matched their SHA-256 manifests.

**Rollback targets for this security release preserve the support improvements:** Worker `4b952089-4bd2-4bcd-8f26-006707b01bba`; Pages `875d6ef3-0e42-4c28-99bf-9d11fc626905`. Use the [support-baseline runbook](security-release-readiness-support-baseline-2026-10-25.md). Routine rollback restores code and preserves new customer activity; do not restore D1 or delete orders/payments/progress as a routine rollback. Rollback was not needed or executed, and the Cloudflare rollback operation has not been rehearsed end to end.

## Verification

- Rebuilt against `ba4216c`, using Node 24.22.1 and frozen dependencies. TypeScript, builds, SEO, 29 runtime/staging-policy tests and the production packaging dry runs passed.
- Full suite: **1,025 passed / three existing baseline failures / 1,028 total**. All **33 critical-cycle files / 203 tests** passed. The three documented baseline mismatches were preserved without weakening assertions. [Baseline triage](security-release-baseline-triage-2026-10-25.md).
- Local browser/content/runtime: **9/9** general site scenarios, **6/6** support scenarios including Arabic/mobile freeze/pending views, **11/11** content/diagram checks and **6/6** actual local Cloudflare runtime checks. Browser APIs were fulfilled synthetically; financial/entitlement coverage used existing mocks and disposable SQLite/D1 fixtures.
- Live API checkpoint: **11/11** before Pages. After Pages: **14/14** checks passed. These covered active deployment IDs, exact Worker module SHA-256, variables/bindings/compatibility/schedules, API health, D1 fixed `SELECT 1`, anonymous session and protected-access rejection, allowed/untrusted CORS, canonical Pages source metadata, Arabic/English pages and www redirect.
- **Ten live frontend asset hashes** matched the verified build, including Admin Jobs, LexAI, the client profile, subscription holders, recommendations, entry scripts and stylesheet. Worker module SHA-256: `83b8c648ee6513e7ddc008ea4ecb787225146446b0013028dc37e1a464ba38f1`.
- Pre-release sampled analytics: **134 requests / zero Worker errors**. Early post-Worker window, 18:12–18:15 UTC: **55 requests / zero Worker errors**. The later 18:12–18:21 UTC post-release window recorded **508 requests / zero Worker errors**. CPU quantiles are not customer latency percentiles.
- No production checkout, payment, entitlement, customer-data mutation or cron invocation was performed as a test. The first post-release signed-in recheck was limited by a detached browser connection. After Chrome reconnected, the authenticated admin dashboard and announcement workflow worked, including the owner-authorized completion notice. No authentication code fix is claimed for the earlier slow browser connection.

## Notice and observation

The bilingual notice went from `support@xflexacademy.com`, with refresh/cache guidance and dashboard Support chat. **163 valid addresses were provider-accepted**; eight had recipient-specific delivery confirmation in the last measured snapshot. Eleven existing permanent suppressions and one invalid account placeholder were preserved. [Notice and owner override](security-release-notice-2026-10-25.md).

The owner subsequently authorized a separate bilingual completion email to the same audience. See [completion notice and workspace push record](security-completion-notice-2026-10-25.md) for its distinct campaign and final aggregate status.

A temporary hidden **one-hour local read-only monitor** was started at 18:21 UTC. It records public health about once per minute and Worker analytics about every five minutes in `.tools/security-release-readiness/candidate-ba4216c/monitor-status.json`. It depends on this computer remaining running, records locally, and does not send external alerts or perform automatic rollback. The process identity is in `monitor-process.json`.

The complete daily-job cycle has **not yet elapsed**. Check queue/job outcomes and customer reports through the next daily cycle, approximately 24 hours. Do not describe that observation as complete at deployment time. The deferred provider/Brotli question and noncritical dependency backlog remain outside this release.

Ignored local evidence, archived inputs, publication logs and live verification reports are under `.tools/security-release-readiness/candidate-ba4216c/`. No private recipient list or credential file was committed.
