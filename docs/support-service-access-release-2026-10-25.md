# Support service access clarity — production release

Released **25 October 2026**, Asia/Amman. This release was explicitly authorized for the access-clarity work only. The separate security work was excluded.

## Source and scope

- Application commit: `1e8a7f41abd330be210361ff0fa529549f11ab1e` — `Clarify frozen and pending service access for support`.
- Pushed branch: `origin/codex/live-package-phase-a`.
- Parent: `bfda25efa922ba87627bc0c6f9b6ddb867e269e5`.
- Seven committed files: `backend/db.ts`, `frontend/src/components/admin/AdminClientProfileSheet.tsx`, new `frontend/src/components/admin/TimedServiceStatus.tsx`, `frontend/src/pages/AdminLexaiSubscriptions.tsx`, `frontend/src/pages/AdminRecommendations.tsx`, `docs/support-service-access.md`, and one access-status rule in `.github/instructions/frontend-xflex.instructions.md`.
- Backend changes only extend existing read projections with pending/freeze/deadline/account-state fields. No access policy, role, permission, mutation, migration, or customer account change was included. Tala (#154) was not unfrozen or activated.
- The UI shows manual freeze and pending activation independently, explains whether services are available now, distinguishes notification permission from service access, and provides a copyable team handoff. Pending services do not display their temporary end date as an actual service expiry. The holder list offers unfreeze when either service is frozen.

## Deployment

| Component | Current production identity |
| --- | --- |
| Worker | `xflexacademy-api-production` |
| Worker version, 100% | `4b952089-4bd2-4bcd-8f26-006707b01bba` |
| Worker deployment message | `Support service access clarity (1e8a7f4)` |
| Pages project | `xflexacademy` |
| Pages production deployment | `875d6ef3-0e42-4c28-99bf-9d11fc626905` |
| Pages source metadata | `1e8a7f4`, production branch `main` |
| Deployment URL | <https://875d6ef3.xflexwithai.pages.dev> |
| Canonical site | <https://xflexacademy.com> |

The Worker was deployed first, then Pages. Existing Worker variables were retained with `--keep-vars`; the unchanged production configuration preserved all four schedules: `* * * * *`, `*/5 * * * *`, `30 23 * * *`, and `0 5 * * *`.

Before this release, the Worker version was `059c1e23-9e9d-4383-94e0-fb62f881c25e` and Pages deployment was `9a6bfc98-8544-4e55-9b68-1cc9410ec60e`. These are the rollback targets for this release. **For a subsequent security release, refresh the live baseline and use the new production identities above if they are still current**, so rollback preserves the support improvements.

## Isolation and verification

Built from a clean detached checkout at `.tools/releases/access-clarity-20261025/source`, using its committed `package.json` and `pnpm-lock.yaml` with a frozen installation. Node 24.22.1 was selected using the existing local runtime helper; that helper and the security runtime/package changes were not committed or deployed here. The Pages build used `VITE_API_URL=https://api.xflexacademy.com`, dynamic article fetching enabled, and the checkout's root Vite configuration. Both deploy commands ran in that isolated checkout, not the dirty main workspace. No environment files were copied into it.

- TypeScript passed with the baseline dependencies.
- Critical suite: **202 passed / 1 existing failure / 203 total**. The unchanged `server/emailOutboxScheduledHealth.test.ts` expects three schedules while the committed production config has four. The exact failing assertion was separately reproduced on untouched parent `bfda25e`. Its security-chat correction was deliberately excluded.
- Additional freeze controls/routes: **5 passed / 0 failed**. The earlier main-workspace focused run passed all 27 access/freeze tests with the security dependencies; this is distinct from the isolated baseline result.
- Frontend/standalone and Worker builds, SEO checks, and Wrangler production packaging dry run passed.
- **6/6 built-site browser checks passed**: English/Arabic home, shared client profile, and subscription holders. Responses were synthetic; all API requests were intercepted, and no production account mutation was sent. Arabic used a mobile viewport.
- Live `/en`, `/ar`, `/admin/students`, `/admin/lexai/subscriptions`, and API `/health` returned 200. Anonymous `clientProfiles.getProfile` returned 401. These checks do not represent an authenticated production account journey.
- Live `AdminClientProfileSheet-cnfBoEj0.js`, `AdminLexaiSubscriptions-DHZvc0XB.js`, and `AdminRecommendations-C6ewRyeK.js` matched their isolated artifact SHA-256 hashes exactly. Pages metadata was verified as production source `1e8a7f4`; Worker deployment metadata was verified at 100% traffic.
- All **63 existing security-work files remained byte-for-byte unchanged**. Only this chat's line was staged from the shared frontend instruction file; the uncommitted AI-screening security instruction remains in the main workspace.

Local ignored evidence is under `.tools/releases/access-clarity-20261025/`: preserved security-file hashes, artifact manifest (760 files), baseline reproduction, test/build/SEO/dry-run logs, browser results, publication logs, and post-deployment verification. The security candidate directory and main-workspace `dist` artifacts were not overwritten.

## Handoff prompt for the security chat

```text
Continue the existing security work in C:\Users\islamt\website-xflexwithai. Another chat has pushed and deployed ONLY support/admin service-access clarity. Read docs/support-service-access-release-2026-10-25.md and docs/support-service-access.md first.

Preserve application commit 1e8a7f41abd330be210361ff0fa529549f11ab1e and the release-record documentation commit on codex/live-package-phase-a. The implementation changes backend/db.ts, AdminClientProfileSheet.tsx, AdminLexaiSubscriptions.tsx, AdminRecommendations.tsx, adds TimedServiceStatus.tsx, and adds one frontend instruction line. It separates pending activation, manual freezes, and notification permission and adds a team handoff. No policy, permission, migration, or customer access change was made; Tala was not unfrozen.

Your 63 existing security-work files were preserved byte-for-byte. Your AI-screening instruction remains unstaged in the shared frontend instruction file. Do not overwrite this release with older full-file copies, reset the dirty workspace, or deploy the old archived security source/artifact candidate. Inspect the current HEAD and diff, preserve the support changes, then rebuild your security candidate from the new baseline plus your intended security edits. Refresh candidate/artifact hashes and rerun the relevant readiness checks before your release. Keep your existing cron-test correction: the original three-schedule assertion was confirmed failing on bfda25e and was not included here.

This support deployment used the original committed dependency lock and production config, so none of your dependency/runtime/security source updates shipped. Current Worker version is 4b952089-4bd2-4bcd-8f26-006707b01bba and Pages deployment is 875d6ef3-0e42-4c28-99bf-9d11fc626905 (source 1e8a7f4). Refresh these live identities before release and update your rollback baseline; the old rollback targets in the earlier security readiness document now predate the support changes. Continue within the security scope and approval context already established in this chat.
```
