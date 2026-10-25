# Patched Node runtime for XFlex

The approved build/development baseline is **Node 24.22.1**, the 21 October 2026 security release. `.node-version` and `.nvmrc` pin it, while `package.json` permits that release and later stable Node 24 versions. Other major versions require separate compatibility validation.

Source: [Node 24.22.1 release and security fixes](https://nodejs.org/en/blog/release/v24.22.1).

## Windows activation

This repository provides an administrator-free Windows x64 runtime under ignored `.tools/node/`. It verifies the downloaded archive and cached executable against the official release SHA-256 checksums before execution. It changes only the current PowerShell process PATH. It does not replace the Windows installation, edit persistent PATH, or restart existing processes.

First activation, from the repository root:

```powershell
. .\scripts\use-project-node.ps1 -Install
node --version
pnpm security:runtime
```

For each subsequent project terminal:

```powershell
. .\scripts\use-project-node.ps1
```

The leading `. ` is required to retain activation in the current shell. Each independent automation shell must activate its own runtime too. Close the terminal to discard activation. Do not weaken PowerShell execution policy system-wide; use an existing approved version manager or the organization's installation procedure if script execution is restricted.

The installer supports only the reviewed pinned release and Windows x64. A missing/incomplete runtime or checksum mismatch stops activation. It does not overwrite an existing incomplete installation. Before changing the pinned version, review the new security release, update both version files, the engine range and installer checksums, then validate the candidate.

## Checks that enforce the policy

`pnpm security:runtime` verifies the actual process version and consistency of `.node-version`, `.nvmrc`, and `engines.node`. Project development, build, typecheck, test and Pages deployment commands run this check before their work. Worker deployment invokes the guarded Worker build. The staging deployment shortcut additionally retains its resource-isolation preflight.

`.npmrc` enables strict package engine checks so dependency installs using the project manifest reject an older runtime. Use the activated shell for `pnpm install --frozen-lockfile`. On an unpatched default shell, the engine/build failure is intentional; activate the project runtime before retrying. Do not use engine-ignore flags as a workaround.

`pnpm test:runtime` tests the runtime policy using Node's built-in test runner. Before activation, use `node --test scripts/check-node-runtime.test.mjs` directly if package-manager engine checks reject the old runtime; these tests perform no application work or network calls. Direct tool invocations such as `pnpm exec vite build` bypass package-script preflights, so use `pnpm build` or run the runtime check explicitly first. These repository checks do not replace host/CI policy.

## CI and Cloudflare builds

- Configure each CI job's Node setup from `.node-version`, print the actual `node --version`, and run `pnpm security:runtime` before installing/building. Use a frozen lockfile and retain test/build results.
- Cloudflare Pages documents support for `.nvmrc`, `.node-version`, and `NODE_VERSION`. Check the actual build image, root directory and any dashboard override: a stale `NODE_VERSION` must not override the approved pin. Confirm the selected runtime in a preview build log before promoting a build-setting change. [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-image/)
- A direct Pages upload uses the runtime of the machine that built its assets. Do not confuse that runtime with Cloudflare Workers' managed request-processing runtime.
- Node version pins and local checks do not attest to the live Worker, provider-side Brotli fixes, or remote build hosts. Those require separate read-only inventory/provider verification.

## Business continuity and remaining scope

Validate frozen-lockfile installation, native better-sqlite3 behavior using a disposable local database, existing business tests, TypeScript, frontend/SEO generation, and Worker/standalone Node bundles before release. Input contracts, database schema, sessions, signing secrets and access/pricing rules are outside this runtime phase.

The local runtime validation build used `SEO_FETCH_DYNAMIC_ARTICLES=false` to avoid external requests. Its generated `dist/` content is for validation only; rebuild with the intended production inputs before a release.

The old system-wide Node remains installed until the normal administrator-managed update is completed. Existing terminals/processes and other projects are not patched by this project-local activation. The package manager and application dependencies also retain their previous versions and still require the separately planned advisory remediation.
