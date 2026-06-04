# XFLEX Agent Memory

Last updated: 2026-06-04

## Project

- Repo path: `C:\Users\islamt\website-xflexwithai`.
- GitHub: `https://github.com/IslamThwabeh/xflexwithai`.
- Production: `https://xflexacademy.com`.
- Stack: React + Vite frontend, Cloudflare Pages, Cloudflare Worker, R2, D1 SQLite.
- Frontend build artifact for manual Cloudflare Pages upload: `dist/public`.
- Worker entry: `backend/_core/worker.ts`.
- Worker bundle: `dist/worker.js`.
- Main backend router: `backend/routers.ts`.
- DB helpers: `backend/db.ts`.
- SQLite schema: `database/schema-sqlite.ts`.

## Deploy And Data

- Build: `pnpm run build`.
- Pages deploy: `pnpm run deploy:pages`.
- Worker deploy: `pnpm run deploy:worker`.
- Production D1 binding: `xflexwithai-db`.
- Remote D1 query pattern:
  `npx wrangler d1 execute xflexwithai-db --remote --config wrangler-worker.toml --env production --command "SELECT ..."`
- Latest successful Worker deploy from Codex: version `a234c242-b9a5-455d-9eda-02c78ba24f82` on 2026-06-04.
- Wrangler Pages deploy failed on 2026-06-04 due Cloudflare API `502 Bad Gateway` during asset upload; user planned manual Pages upload from `dist/public`.

## Important Areas

- Support chat client page: `frontend/src/pages/SupportChat.tsx`.
- Admin support chat: `frontend/src/pages/AdminSupport.tsx`.
- Client bug report tab `/support?tab=bugs`: `frontend/src/components/SupportBugReportsPanel.tsx`.
- Admin bug report queue: `frontend/src/pages/AdminBugReports.tsx`.
- Shared support media helpers: `frontend/src/lib/supportMedia.ts`.
- Support upload and bug evidence backend validation: `backend/routers.ts`.
- Email sender: `backend/_core/email.ts` function `sendEmail`.
- Email audit table: `email_delivery_logs`.

## Support Media Rollout

- Commit `80b948e` added short video upload support to client chat, admin/support chat, and bug report evidence.
- Videos are limited to 50 MB and shorter than 60 seconds.
- Images and generic files are 5 MB. Voice notes are 2 MB.
- Browser checks duration before upload; backend requires duration metadata and rejects `>= 60` seconds.
- Bug evidence still uses the existing `imageUrl` column for compatibility.
- Regression test added in `server/supportChatNotifications.test.ts`.

## Fixed Bugs / Lessons

- Episode prerequisite skip for no-quiz episodes fixed.
- Admin chat newest-first loading fixed.
- `admin_settings` needs insert-or-replace behavior where applicable.
- Support email trigger belongs in `createSupportMessage` for `senderType = 'client'`.
- Support chat copy/select message text fixed.
- Recommendation emails no longer skip recently interactive users.
- Recommendation alerts, updates, trade results, and admin bulk emails should be logged in `email_delivery_logs`.
- When changing support features, update client, admin/support, backend validation, tests, and mobile/desktop layouts together.

## Verification Baseline

- `pnpm run check` passed.
- `pnpm test` passed: 19 files, 68 tests.
- `pnpm run build` passed.
- `pnpm run build:worker` passed.
- Browser smoke was not completed because Codex in-app browser backend reported `iab` unavailable.

## User Preference

- User prefers concise, low-token bug-fixing help.
- For a new bug, ask for targeted PowerShell search results first.
- Then provide a paste-ready VS Code AI prompt with file paths, line targets, and exact requested diff.
- Avoid long explanations unless the user asks for them.
