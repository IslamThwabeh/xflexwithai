# Staging isolation and private development

The current staging TOML references production D1 and video storage. It also uses the production site origin and an automatic email provider. It is **not ready for remote write tests**.

Before package-manager commands, activate the approved project Node runtime as described in `docs/security-node-runtime.md` (Windows: `. .\scripts\use-project-node.ps1`).

## Resource preflight

Run `pnpm security:staging-resources`. The staging deployment shortcut runs this check **before building or invoking Wrangler**. It currently fails intentionally because the configured resources are shared. Production deployment commands are unchanged.

The check parses the actual `wrangler-worker.toml` and requires:

- A distinct explicit staging Worker name and `ENVIRONMENT = "staging"`.
- Explicit staging D1 UUID/name and both video and private finance-receipt R2 bindings, distinct from production/top-level identities, including preview identities.
- Distinct explicit HTTPS site and public-media hosts.
- Explicit empty staging routes and cron schedules. The first phase permits only a separate workers.dev endpoint, with no custom routing or scheduled runs.
- Additional binding types to receive an explicit isolation policy before use.

The CLI uses the fixed repository configuration and accepts no overrides. It is a safeguard for the repository's staging deployment command, not a replacement for Cloudflare IAM. Direct Wrangler/API/dashboard actions bypass it and must not be used to deploy unsafe staging configuration. Existing deployed staging settings are not changed by editing local TOML or adding this check.

## Before permitting staging tests or deployment

1. Inspect actual Cloudflare configuration, existing staging routes/triggers, and credentials using read-only commands. Record deployed production/rollback revision IDs. Avoid exposing secret values in terminal output.
2. Provision a dedicated staging database and video/receipt buckets. Use synthetic fixtures and maintain private receipt access. Replace only staging identities in TOML; leave production bindings intact.
3. Supply staging site/media origins and verify the compiled frontend targets the staging API. Passing a TOML URL comparison does not prove the frontend bundle or deployed media URLs use it.
4. Provision separate staging secrets and explicitly isolate every external integration. Current `EMAIL_PROVIDER = "auto"` is not a mail sandbox. Configure a tested capture/recipient restriction before exercising email flows. Do not assume an unsupported provider value disables sending. Verify AI, webhook, and any other outbound paths reached by tests.
5. Verify no active staging schedules, queues, or indirect bindings can process production work. Test jobs manually against staging fixtures and captured outbound delivery first.
6. Run the resource preflight, baseline tests, builds, and representative business checks. A successful resource preflight is necessary, but **does not certify secret, frontend, outbound-integration, or deployed-account isolation**.

Until those steps are complete, use local mocked tests only. In particular, do not use the old direct staging deploy command as a workaround for a failing check. No production data cleanup, database restore, secret rotation, or customer logout is part of this phase.

## Local development access

Vite and the outer Express development listener now default to `127.0.0.1`. Middleware mode retains the Vite host allowlist and filesystem-deny settings instead of replacing the host check with an unrestricted one.

For an intentional LAN session in PowerShell:

```powershell
$env:XFLEX_DEV_HOST = "0.0.0.0"
pnpm dev
```

After the session, remove that override:

```powershell
Remove-Item Env:XFLEX_DEV_HOST
```

Use only a trusted network/firewall policy. An opt-in host does not disable Vite's hostname allowlist. The production standalone listener keeps its previous binding behavior; production Workers do not use this listener.

## Verification

- `pnpm test:security-foundation`: resource identity substitution, missing bindings, inherited routes/schedules, parser failures without source disclosure, real loopback socket binding, LAN opt-in, production listener compatibility, and existing scheduler behavior.
- `pnpm test:critical-cycle`: business-critical regression suite.
- `pnpm check`: project TypeScript checks.
- Review the parsed production configuration against its prior version to confirm the staging-only TOML edit did not alter production settings.

The pre-existing scheduler test expected an older three-cron string. It now parses production TOML and checks the four existing schedules, including retention. The production schedule itself was not changed.
