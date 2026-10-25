# Axios security update — 24 October 2026

## Change and usage

Axios is pinned from **1.13.5** to the current stable **1.20.0**. Its resolved HTTP dependency chain now includes follow-redirects 1.16.1, form-data 4.0.6, proxy-from-env 2.1.0 and https-proxy-agent 5.0.1. Required shared dependencies also resolve hasown 2.0.4. Other direct application dependency declarations are unchanged from the previous phase.

The scoped source search found Axios imported by `backend/_core/sdk.ts`, which constructs a client with a configured OAuth base URL and the existing 30-second timeout. Its retained legacy OAuth callback helper is defined in `backend/_core/oauth.ts`; no route-registration call was found in the searched application sources. Current authentication/session code and both legacy helper files were left unchanged. This source review does not attest to deployed configuration or prove every historical deployment lacks that callback.

The [1.20.0 release](https://github.com/axios/axios/releases/tag/v1.20.0) addresses the remaining advisory ranges identified for the older version. Representative maintainer advisories cover an [inherited default-method gadget](https://github.com/axios/axios/security/advisories/GHSA-9fr6-4gfg-395g), [streamed upload limit bypass](https://github.com/axios/axios/security/advisories/GHSA-5c9x-8gcm-mpgx), and [streamed response limit bypass](https://github.com/axios/axios/security/advisories/GHSA-vf2m-468p-8v99).

## Regression evidence

`pnpm test:security-axios` runs 14 tests using fake data and HTTP servers bound only to 127.0.0.1. Environment-proxy tests point only to local proxy fixtures and restore environment variables afterward. An isolated child process uses a custom no-network adapter for the inherited-method probe, so prototype mutation never enters the Vitest process or a running application.

Before the update, **11 compatibility tests passed and 3 security tests failed**. After the update, all **14 pass**:

- Relative JSON POST requests matching the legacy helper's request pattern, bilingual payloads, headers and the existing timeout setting.
- Default GET behavior and query encoding.
- Same-authority 307 POST redirects preserve the body and authorization.
- Authorization is withheld from a redirect to a different loopback authority.
- Structured non-2xx responses, configured timeouts and explicit cancellation.
- HTTP proxy selection and explicit NO_PROXY host/port bypass.
- In-limit streamed uploads and responses.
- An inherited default HTTP method cannot replace the intended GET.
- Configured upload and response size limits are enforced on streamed data.

The limit tests use only 64-byte fixtures. They do not perform resource-exhaustion probes. The prototype test simulates a prerequisite inherited value; Axios itself is not asserted to be a prototype-pollution source. These are library/request-pattern tests, not an end-to-end login against a real OAuth provider.

## Wider verification

Frozen-lockfile installation passed with lifecycle scripts disabled. Project TypeScript, the frontend/standalone Node build, static/curated SEO checks and the Worker build pass under Node 24.22.1. The root Vitest suite reports **989 passing tests and the same 3 existing UI-contract failures**, across 191 files. All **33 critical-cycle files** passed. No new test failure appeared, and no existing test or business permission was changed to hide a failure.

The existing failures remain subscriber-report rendering, Arabic renewal wording, and the finance-manager navigation contract. Their prior baseline evidence is documented in the Zod phase. They require separate review before claiming a fully green release baseline.

The installed Axios and lockfile resolve only to 1.20.0. A recursive check of Axios's resolved regular dependency closure submitted **27 package names**, including Axios, to the npm bulk advisory endpoint; it returned no advisories. Exact version evidence is in `security_axios_audit_2026-10-24.json`. Optional/peer dependencies and unrelated application/tooling packages are not covered by this scoped check.

## Remaining limits and release gates

- The application HTTP factory, endpoint paths, login/session behavior, proxy defaults and request-size settings were not changed. Size-limit fixes protect configured limits; unlimited defaults remain unlimited. Application-specific input/response caps require their own compatibility review. [Axios request configuration](https://axios-http.com/docs/req_config)
- Testing loopback HTTP behavior does not verify a production provider, HTTPS/proxy deployment configuration, browser/fetch adapters or HTTP/2 behavior. Those still need appropriate environment/integration validation if used.
- The lockfile still contains form-data 4.0.5 through a different dependency path. It is outside the updated Axios chain and remains tracked; no global override was introduced to conceal it. Other dependency advisories, existing peer warnings, system-wide Node patching, provider status and staging isolation are also still open.
- Local validation builds disable external article fetching. Generated files are validation artifacts and require rebuilding with intended production inputs before release.
- No deployment, live OAuth call, customer-data operation, database migration or production setting change occurred.

Next focused review: the AWS S3 SDK/XML parser dependency chain, including actual application usage and the smallest compatible remediation.
