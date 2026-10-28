# Client payment reporting production release

Released on **28 October 2026, Asia/Amman**, after explicit owner approval to push and deploy. Implements the [rollout plan](client-payment-reporting-plan-2026-10-28.md); local and candidate-source checks are in the [verification record](client-payment-reporting-verification-2026-10-28.md).

## Published identities

| Item | Identity |
| --- | --- |
| Application commit | `b86cc87745d988abb4db44bec37c7fde8fde9105` — Correct client payment reporting across staff views |
| Pushed branch | `origin/codex/live-package-phase-a`, verified at the exact application commit before deployment; no force push or unrelated merge |
| Worker version | `5d217126-60be-4522-a7c7-7fb8ee11f684` (version number 414), 100% traffic |
| Worker deployment | `a668ae4f-3d85-4f05-84b5-4eebae32cf9a`, created 17:40:15 Asia/Amman |
| Pages production deployment | `bb3d8771-c9d4-49bc-96ad-c1adcd53b114`, production branch `main`, source `b86cc87` |
| Pages deployment URL | <https://bb3d8771.xflexwithai.pages.dev> |
| Live client report | <https://xflexacademy.com/admin/reports/subscribers> — authorized staff sign-in required |

The 20 verified candidate files matched their recorded hashes before committing. The approved existing frontend/Worker artifacts were deployed without rebuilding or changing application source. Worker packaging dry-run passed. Worker promotion preceded Pages; existing variables/secrets were retained with `--keep-vars`. D1, public media, private finance receipts and Live Expert attachment bindings remain configured. The four existing schedules are preserved: `* * * * *`, `*/5 * * * *`, `30 23 * * *`, `0 5 * * *`.

No database migration, historical reconciliation, order/payment/refund edit, entitlement activation or customer message was executed. Hala's individual case remains paused. Omar's separate access issue was not repaired by this reporting release.

## Live verification

- Worker `/health` and `/api/test/db` returned 200. Anonymous client-report, client-profile and finance-report requests returned 401.
- Public Arabic/English pages and canonical client/report routes returned 200. Both canonical private routes and the deployment report route retain `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`.
- All six affected live JavaScript artifacts returned 200 and exactly matched the tested local SHA-256 hashes: entry, client list, subscriber report, client profile, shared payment summary and dashboard navigation.
- A fresh read-only source comparison at **17:41:53 Asia/Amman** matched all **170 client accounts**, with zero per-client amount/source-ID differences and zero bulk/profile differences. It found the same 145 orders, 43 approved payments/confirmations and 194 keys. Confirmed recorded receipts/net remain ILS 53,400, with no refunds. Coverage remains 93 clients needing historical review, 31 with recorded evidence only, and 46 with no payment recorded. Verification wrote zero business rows; source counts did not change during these checks.
- Exact source read cost remains 470 D1 rows per authorized summary request at the measured source sizes. No polling or scheduled reporting work was added.
- Cloudflare's aggregate window before release (17:30–17:40 local) reported 82 requests and zero errors. The first post-release window (17:40:30–17:45:46 local) reported 23 requests and zero errors. Different traffic mixes and the small observation window do not establish endpoint latency/CPU equivalence or a completed daily cycle. No authenticated report request was synthesized to manufacture such a result.
- D1 info returned rolling 24-hour telemetry of 3,397,671 rows read and 34,320 rows written, database size 368,287,744 bytes. These are rolling observations, not exact calendar-day quota counters or release-attributed work.

There was no connected browser session available for a genuine signed-in production staff screen check. The authenticated role/UI/Arabic/mobile/CSV/print scenarios passed locally with synthetic fixtures; production verification establishes publication, health, anonymous access rejection, artifact identity and source-calculation parity. Genuine signed-in UI acceptance and longer-running normal-use performance observation remain unverified limits, not completed checks.

## Recovery targets

| Item | Before this release |
| --- | --- |
| Worker version | `649c2d9b-a277-4323-b22a-fcc186089e2a` |
| Pages deployment | `6c77942e-f7f2-4b44-ad7a-c64f8ec7fc06`, source `2b2ae48` |
| D1 Time Travel bookmark | `000018cf-00001806-00005112-777353cfdbcc02ddc810cc8aa1a48606` |

Routine rollback must preserve current customer data. No database restore or full export was performed or required. Set `CLIENT_PAYMENT_SUMMARIES_ENABLED=false` while preserving other Worker settings to suppress monetary summaries/new reads if a reporting fault appears; the UI shows unavailable information and never falls back to legacy key values. Restore compatible Pages/Worker code only as needed. The prior display is known to be misleading, so do not expose it as authoritative paid history during recovery.

## Evidence

Ignored local evidence: `tmp/client-payment-worker-deploy.log`, `tmp/client-payment-pages-deploy.log`, `tmp/client-payment-worker-after.json`, `tmp/client-payment-pages-after.json`, `tmp/client-payment-worker-live-smoke.json`, `tmp/client-payment-frontend-live-verification.json`, `tmp/client-payment-production-postdeploy.log`, `tmp/client-payment-candidate-production-verification.json`, and `tmp/client-payment-release-metrics.json`. No credentials, receipt files or customer-source datasets are committed.

The published Worker input SHA-256 is `2715d0a121329a7a3205a247dc1f8071769234a76092dc3cf9048b71fd1dceeb`. The Cloudflare-bundled Worker version identity above is the live publication reference; the local input hash is not claimed to be the remote bundle hash.
