# Express/proxy-addr security update — 24 October 2026

## Change and finding

Updated the locked Express dependency **proxy-addr 2.0.7 → 2.0.8**. Express stays at 4.22.1, whose existing `~2.0.7` dependency range permits this patch. Other lock entries, direct dependency declarations and overrides are unchanged from the AWS/XML phase. Added `pnpm test:security-proxy` for repeatable focused verification.

**PROXY-01 — CVE-2026-90711 / GHSA-jqcg-44mw-7w3h.** The maintainer rates this finding critical. Under particular IPv6 trusted-subnet settings, the old dependency can mistakenly trust unrelated IPv4 peers and accept their forwarded client identity. Version 2.0.8 corrects the subnet matching. [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [patch](https://github.com/jshttp/proxy-addr/commit/780911d).

This checkout imports Express in `backend/_core/index.ts:2` for development and the retained standalone server. A search of application source/scripts/configuration found no `trust proxy` setting or use of Express `req.ip`/`req.ips`. The application creates its server at `backend/_core/index.ts:32` with Express's default trust policy. Therefore, the advisory prerequisite was **not demonstrated in the checked application code**. Actual deployed standalone ingress/configuration remains unverified. Express documents how [proxy trust changes request metadata](https://expressjs.com/en/guide/behind-proxies/).

Status: fixed in the local locked/installed dependency; production deployment status is unchanged. This patch is not a clearance of all Express dependencies or all application IP handling.

## Compatibility and security checks

The new `server/expressProxySecurity.test.ts` contains 15 tests. On 2.0.7, **10 compatibility tests passed and 5 security tests failed**. On 2.0.8, **all 15 pass**. The checks exercise Express's own resolved dependency and disposable Express instances; HTTP requests connect directly to 127.0.0.1, use synthetic headers/data and ignore environment HTTP proxies.

Compatibility covers the default untrusted-proxy policy, missing forwarding headers, correctly trusted fixture hops, stopping at the nearest untrusted hop, IPv4/mapped-IPv6/native-IPv6 subnet boundaries, mixed-family subnet lists, bilingual JSON, form parsing, parsed cookies and the existing session-cookie lifetime/attribute conversion. Security checks cover short mapped prefixes, zero-leading IPv6 prefixes, mixed subnet lists and rejection of forwarded identity/protocol/host from an untrusted socket. Deliberately unsafe trust settings exist only in the disposable test applications.

`pnpm test:security-proxy` also includes existing cookie, password-recovery, checkout authentication and development-host tests: **29 tests pass across five files**. The focused command uses mocked business dependencies or local fixtures; it does not perform real login, email or customer operations.

## Wider verification

Under project Node 24.22.1:

- Frozen-lockfile installation passed with lifecycle scripts disabled.
- The configured TypeScript check, frontend/standalone build, Worker build and SEO checks passed. SEO validation covers 36 static pages, six curated article pages and middleware behavior.
- The full suite reports **1,011 passed and the same 3 existing UI-contract failures**, across 193 files. All **33 critical-cycle files** pass. The failures remain subscriber-report rendering, Arabic renewal wording and finance-manager navigation. Existing assertions and business permissions were preserved.
- The rebuilt Worker and standalone server bundles are byte-identical to their pre-phase versions. The Worker build metadata lists 371 inputs, with no Express/proxy-addr input or external runtime import. The standalone build keeps dependencies external, so its unchanged bundle hash does not imply that its installed dependency behavior is unchanged: the proxy patch is active there.
- The server bootstrap, Worker entry point, API router, cookie/context code and full Worker configuration match their pre-phase hashes. No production settings or business implementation changed.

The package-manager update initially refreshed unrelated optional tooling dependencies. Those changes were excluded before the frozen install and tests. The final lock comparison proves that only the proxy-addr package entry, its snapshot and Express's resolution reference changed. Metadata and integrity values came from the package manager's registry resolution.

The refreshed registry audit no longer reports proxy-addr. Severity metadata reports **3 critical, 37 high, 57 moderate and 14 low** remaining findings, including development tooling; these are not counts of exploitable production vulnerabilities. The critical records concern Vitest/Tinypool. Raw registry results are in `security_proxy_registry_audit_2026-10-24.json`; versions, scope, hash comparisons and verification results are in `security_proxy_dependency_audit_2026-10-24.json`.

## Remaining checks and next phase

Application code separately reads `cf-connecting-ip` and `x-forwarded-for` in `backend/routers.ts:666`, including IP-derived OTP controls at `backend/routers.ts:2615`. Cookie code separately reads `x-forwarded-proto` in `backend/_core/cookies.ts:54`. These paths do not become protected by patching proxy-addr. Verify header provenance/rewriting and any public standalone ingress before changing that behavior; doing so requires its own topology and compatibility review. Current tests do not attest to those deployed trust boundaries.

Next focused phase: review and remediate Vitest/Tinypool with an independently validated tooling update. Other dependency advisories, staging isolation, provider/runtime verification, three existing UI failures and representative browser/Cloudflare integration checks remain open.

Nothing was deployed, migrated or tested against production data. Validation builds disable external article fetching and require rebuilding with intended production inputs before release.
