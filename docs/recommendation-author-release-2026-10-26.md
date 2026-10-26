# Private recommendation author attribution

Deployed on 26 October 2026, Asia/Amman, following the owner's request to push and deploy.

Full admins can open **Recommendations → Channel View** at `/admin/recommendations` and see **Posted by** on every root recommendation and follow-up, including history. The label shows the saved author's name, email, and account ID. Negative admin session IDs resolve against the admin directory. Missing/deleted author records retain the saved account ID as a fallback.

Recommendation publishers must use the `analyst` role for private workspaces. Full admin accounts retain global oversight. Existing analyst-scoped open/history feeds are preserved; the legacy feed and summary totals now also scope to the signed-in analyst. Non-admin feed responses mask author names, email addresses, other account IDs, closing actors, analyst markers, and delivery diagnostics. The analyst directory and performance comparison remain full-admin-only.

## Production identities

| Component | Identity |
| --- | --- |
| Application source | `20cdacf00a11c6d92e4ad52ce1a472858d471280` |
| Pushed branch | `codex/live-package-phase-a` |
| Worker, 100% traffic | `649c2d9b-a277-4323-b22a-fcc186089e2a` |
| Pages production deployment | `9b4241dc-896d-41a5-9b04-ceb005f521d0` |
| Pages source metadata | `20cdacf`, production branch `main` |
| Deployment URL | https://9b4241dc.xflexwithai.pages.dev |
| Canonical site | https://xflexacademy.com |

The verified production Worker was deployed first with `--keep-vars`, preserving the configured bindings and all four schedules. Eight API checkpoint checks passed before Pages deployment. No database migration, role assignment, customer-data mutation, notification, or email was required.

## Verification and recovery

- Focused tests: 37 passed. Critical cycle: all 33 files / 209 tests passed. TypeScript and production frontend/Worker builds passed.
- Production verification: 13 HTTP checks and two exact artifact hash comparisons passed. API and database health returned 200; six anonymous recommendation/admin procedures returned 401. Arabic, English, and the admin route returned 200; the admin route retained `no-store` caching. Live entry and AdminRecommendations bundles matched the tested local build byte-for-byte.
- Cloudflare metadata confirmed the new Worker at 100% and the Pages deployment as production source `20cdacf`.
- Authenticated production role journeys were not exercised. Role isolation and response redaction were verified through local tests.
- Previous release / rollback references: Worker `f3c00d04-2ebc-45d3-a494-4b84a2efadd9`; Pages `dcf4f5dc-6688-4f80-9d09-1600f95ae51a`. Routine code rollback needs no database restore.

Ignored local build, critical-suite, and live-verification evidence is retained under `tmp/recommendation-release-*`.
