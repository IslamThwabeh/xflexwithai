# Client how-to guides

`/guides` is a signed-in guide library in the client menu above Support, with a
dashboard shortcut. LexAI and Recommendations each have a contextual help button
that opens the related collection in a dialog without navigating away. Closing
the dialog pauses playback and removes its video source; LexAI draft input stays
in the parent page. No video autoplays or preloads its content.

The six Arabic recordings are grouped into Getting started (1), Recommendations
(1) and LexAI (4). English interface labels describe the same Arabic recordings.
The library is available before service activation and while survey access is
blocked. Normal sign-in, account restrictions and terms requirements still apply.
Watching does not invoke an activation procedure, consume a service day or grant
access to a paid feature. Existing LexAI/recommendation access gates are unchanged.

## Media

- Catalog: `shared/clientGuides.ts`.
- Source mapping and privacy windows: `scripts/client-guides.manifest.json`.
- Preparation: `scripts/prepare-client-guides.ps1 -SourceDir '<source directory>'`.
- Prepared output: ignored `output/client-guides/`; originals are untouched.
- Portrait H.264/AAC video is retained with MP4 fast-start. Four videos are
  remuxed without re-encoding. Two have gallery thumbnails blurred during the
  reviewed photo-picker intervals; their audio is copied unchanged.
- Clean JPEG posters are bundled under `frontend/public/images/client-guides/`.
- Videos are stored in private bucket `xflexacademy-client-guides`, bound as
  `CLIENT_GUIDES_BUCKET`, under `client-guides/v1/<slug>.mp4`.
- `clientGuides.playback` requires a signed-in account and issues a two-hour,
  guide-specific playback token. `/api/client-guides/<slug>/stream` validates it
  before reading storage. It supports GET, HEAD, single byte ranges and CORS;
  responses are private/no-store and noindex. Video URLs are temporary bearer
  links, not DRM, and remain valid until their two-hour expiry.
- Deploy the API Worker before the frontend. No database migration is needed.

## Verification

- TypeScript and production frontend/Worker builds passed.
- 24 focused tests passed for signed-in/no-service guide access, anonymous and
  arbitrary-object rejection, token scope/expiry, range/HEAD/preflight behavior,
  missing files, and the existing recording routes. The SEO middleware checks
  include `/guides` as a private, noindex, no-store application route.
- All six prepared MP4 files played and sought in an isolated Chromium session.
  Browser checks used client fixtures and actual prepared video bytes, covering
  category filters, no autoplay, signed-out redirect, the mobile menu, English UI,
  and a signed-in client without active services and with an outstanding survey.
- Contextual dialog checks verified the four LexAI guides and one recommendation
  guide, retained LexAI draft text, playback cleanup on close, mobile layout, and
  the dashboard shortcut. Screenshots: `output/playwright/client-guides/`.
- All six remote R2 objects were downloaded and their SHA-256 hashes matched the
  reviewed prepared files (`output/client-guides/storage-verification.json`).
- No client subscription, activation, account password, order or payment was
  changed during verification. Existing mobile navigation emits a Radix missing
  description warning; the new guide dialogs include titles and descriptions.
