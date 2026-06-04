# XFLEX Project Memory

Last updated: 2026-06-04

## Project Overview

- Local project path: `C:\Users\islamt\website-xflexwithai`.
- GitHub repo: `https://github.com/IslamThwabeh/xflexwithai`.
- Production website: `https://xflexacademy.com`.
- Stack: Cloudflare Pages + Cloudflare Worker + R2 + D1 SQLite.
- Frontend: React + Vite under `frontend`, with build output in `dist/public`.
- Backend Worker entry: `backend/_core/worker.ts`, bundled to `dist/worker.js`.
- Local/server backend entry for non-Worker build: `backend/_core/index.ts`.
- Main router: `backend/routers.ts`.
- Database wrapper/helpers: `backend/db.ts`.
- SQLite schema source: `database/schema-sqlite.ts`.
- Key tables to remember: `admin_settings`, `supportMessages`, `userRoles`, `users`, `email_delivery_logs`, `recommendationSubscriptions`.

## Deployment

- Production frontend is Cloudflare Pages project `xflexacademy`.
- Manual Pages upload artifact is `dist/public`.
- Full build command: `npm run build` or `pnpm run build`.
- Full deploy sequence when Wrangler Pages works: `npm run build && npm run deploy:pages && npm run deploy:worker`.
- Pages deploy script: `pnpm run deploy:pages`.
- Production Worker deploy script is `pnpm run deploy:worker`.
- Worker deploy command expands to `wrangler deploy dist/worker.js --config wrangler-worker.toml --env production`.
- D1 database binding: `xflexwithai-db`.
- Remote production D1 query pattern:
  `npx wrangler d1 execute xflexwithai-db --remote --config wrangler-worker.toml --env production --command "SELECT ..."`
- Latest Worker deploy completed on 2026-06-04 with version `a234c242-b9a5-455d-9eda-02c78ba24f82`.
- Pages deploy via Wrangler failed on 2026-06-04 because Cloudflare returned `POST /pages/assets/upload -> 502 Bad Gateway`; user planned to upload `dist/public` manually from the Cloudflare dashboard.

## Email And Notifications

- Central email sender is `backend/_core/email.ts`, function `sendEmail`.
- Outbound automated emails are logged to `email_delivery_logs` with status, errors, and metadata.
- Logged email flows include staff alerts, welcome/milestone emails, recommendation alerts, trade results, and admin bulk notifications.
- Admin dashboard for email logs is in Admin Notifications -> `Email Delivery Logs` tab.
- Recommendation email inactivity filter was removed: recommendation alerts, updates, and trade results are sent regardless of recent `lastInteractiveAt`.
- Recommendation email event types include `recommendation_alert`, `recommendation_update`, and `trade_result`.
- Admin bulk email audit logs each recipient individually as `admin_bulk_notification`.

## Known Fixed Bugs / Lessons Learned

- Episode prerequisite skip for no-quiz episodes was fixed.
- Admin chat list loads newest first.
- `admin_settings` insert should use `INSERT OR REPLACE` behavior where appropriate.
- Support email trigger is inside `createSupportMessage` when `senderType = 'client'`.
- Client support chat message text selection/copy was fixed.
- Email delivery logging is the audit trail for outbound emails and should be preserved when adding email flows.
- For support/chat changes, check both client and admin surfaces; they often implement similar behavior separately.
- For bug report evidence, existing storage column is still `imageUrl`; avoid schema churn unless there is a strong reason.
- Wrangler Pages deploy can fail from Cloudflare upload 502 even when the app build is valid; manual dashboard upload of `dist/public` is a practical fallback.

## Support Media Uploads

- Commit `80b948e` added short video upload support to client support chat, admin support chat, and bug reports.
- Shared frontend media helpers live in `frontend/src/lib/supportMedia.ts`.
- Client support chat is `frontend/src/pages/SupportChat.tsx`.
- Admin/support chat is `frontend/src/pages/AdminSupport.tsx`.
- Client bug report panel for `/support?tab=bugs` is `frontend/src/components/SupportBugReportsPanel.tsx`.
- Admin bug report review is `frontend/src/pages/AdminBugReports.tsx`.
- Backend support upload and bug report upload validation live in `backend/routers.ts`.
- Support message DB schema comments are in `database/schema-sqlite.ts`; no migration was needed because `attachmentType` and `attachmentDuration` already existed.

## Current Media Rules

- Images: max 5 MB.
- Generic chat files: max 5 MB.
- Voice notes: max 2 MB.
- Videos: max 25 MB and must be shorter than 60 seconds.
- Frontend checks video duration before upload via browser metadata.
- Backend requires video duration metadata and rejects duration `>= 60` seconds for support chat and bug report evidence uploads.
- Bug reports still store evidence in the existing `imageUrl` column for compatibility, but UI copy now says screenshot/video/evidence.

## Verification Run

- `pnpm run check` passed.
- `pnpm test` passed: 19 test files, 68 tests.
- `pnpm run build` passed.
- `pnpm run build:worker` passed.
- Focused tests also passed: `server/supportChatNotifications.test.ts` and `server/bugReports.test.ts`.
- Browser smoke could not be completed in Codex because the in-app browser backend reported `iab` unavailable.

## Future Hardening

- Do not rely only on browser duration checks; for stronger abuse prevention, add server-side video probing or a quarantine process before long-term R2 retention.
- Consider signed/private access for support evidence URLs if evidence may contain sensitive client data.
- Add R2 lifecycle cleanup for rejected bug reports, deleted support messages, and abandoned uploads.
- Manual QA before release should cover client/admin chat image upload, short video upload, 60s+ rejection, oversized rejection, existing voice notes, `/support?tab=bugs` evidence submit, and admin bug evidence playback on mobile and desktop.

## User Working Style

- User is non-developer and prefers low-token, practical instructions.
- When user reports a bug, first ask them for targeted PowerShell search output, usually with `Select-String` or concise `rg` alternatives.
- Then provide a short prompt they can paste into VS Code AI/Copilot/Cursor.
- Keep those prompts focused on file paths, line numbers, and exact code changes; avoid long explanations.
- Preferred verification/deploy loop after fixes: build, deploy Pages, deploy Worker, then smoke test.
