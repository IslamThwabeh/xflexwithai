# XFLEX Project Memory

Last updated: 2026-06-04

## Deployment

- Production frontend is Cloudflare Pages project `xflexacademy`.
- Manual Pages upload artifact is `dist/public`.
- Production Worker deploy script is `pnpm run deploy:worker`.
- Latest Worker deploy completed on 2026-06-04 with version `a234c242-b9a5-455d-9eda-02c78ba24f82`.
- Pages deploy via Wrangler failed on 2026-06-04 because Cloudflare returned `POST /pages/assets/upload -> 502 Bad Gateway`; user planned to upload `dist/public` manually from the Cloudflare dashboard.

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
