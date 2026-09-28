# D1 Free-Plan Guardrail Runbook

Use this runbook after the combined deployment and during the observation window before switching Cloudflare billing back to Free.

## Command

```bash
pnpm run d1:guardrail -- xflexwithai-db --time-period 1d
```

For a faster check without query fingerprints:

```bash
pnpm run d1:guardrail -- xflexwithai-db --skip-insights
```

## What The Report Means

- `wrangler d1 info` is a trailing 24-hour view.
- `wrangler d1 insights` is experimental Cloudflare output and uses a rolling window.
- Use complete UTC-day observation records for the final downgrade decision; do not rely only on a partial rolling sample.

## Decision Bands

- Pass: under 3.5M rows read and under 60k rows written.
- Caution: 3.5M-4.5M rows read or 60k-80k rows written.
- Unsafe: above 4.5M rows read, above 80k rows written, or database size at/above 95% of 500 MB.
- Block downgrade: at/above 5M rows read, at/above 100k rows written, at/above 500 MB, D1-limit errors, Worker CPU-limit errors, or functional regressions.

## Required Evidence To Save

1. Full guardrail Markdown output.
2. UTC timestamp of the check.
3. Whether the sample was a full UTC day or a rolling/partial window.
4. Top read fingerprints.
5. Top write fingerprints.
6. Any Worker CPU-limit errors or D1-limit errors.
7. Smoke-check notes for login, public site/API health, support inbox, email queue, recommendations, LexAI, and course watch.

## Safe Operating Notes

- The script only runs read-only Wrangler commands.
- The script does not print secrets.
- If the command fails due missing Cloudflare credentials, run `pnpm exec wrangler whoami` and authenticate before retrying.
- Do not downgrade while the report is `UNSAFE`.
- Treat `CAUTION` as a prompt to investigate the top fingerprints before deciding.
