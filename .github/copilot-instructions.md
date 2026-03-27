# XFlex Trading Academy — Copilot Instructions

## Project Summary
XFlex is a bilingual (Arabic/English) online trading academy platform for Jordanian students.
It sells 2 package types: **Basic ($200, no LexAI)** and **Comprehensive ($500, includes LexAI)**.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Wouter (routing) + tRPC client + Tailwind CSS + shadcn/ui |
| Backend | tRPC + Drizzle ORM + Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (videos/attachments) |
| Hosting | Cloudflare Pages (frontend) + Cloudflare Workers (backend API) |
| Auth | JWT via `jose`, bcryptjs, HTTP-only cookies |

---

## Key File Locations

| Purpose | File |
|---|---|
| All DB operations | `backend/db.ts` (large — search before reading whole file) |
| All tRPC routes | `backend/routers.ts` (large — same caution) |
| Drizzle schema | `database/schema.ts` |
| Frontend routes | `frontend/src/App.tsx` |
| Student navigation | `frontend/src/components/ClientLayout.tsx` |
| Admin sidebar | `frontend/src/components/DashboardLayout.tsx` |
| Shared constants | `shared/const.ts` |
| Auth logic | `backend/_core/auth.ts` |
| Env/config | `backend/_core/env.ts` |
| tRPC base | `backend/_core/trpc.ts` |

---

## Architecture Rules

### tRPC
- All backend procedures live in `backend/routers.ts`, organized into sub-routers
- Context type is defined in `backend/_core/context.ts` (Node) / `context-worker.ts` (CF Worker)
- Auth middleware is in `backend/middleware/unified-auth.ts`
- Frontend calls go through `frontend/src/lib/trpc.ts`

### Database
- **D1 is SQLite** — use SQLite-compatible syntax only (no RETURNING, no JSON functions unavailable in SQLite)
- Column names are **camelCase** (e.g., `packageId`, `courseId`, `userId`)
- Always run `PRAGMA table_info(tableName)` before writing SQL against an unfamiliar table
- Production DB queries: `npx wrangler d1 execute xflexwithai-db --remote --command "SQL"`
- DB ID: `cf374361-2caa-4597-a38d-5cecced7827d`

### Package Key System (Critical!)
- **Legacy course keys are no longer used** — the platform has fully migrated to package keys
- All new keys are created as package keys (via `AdminPackageKeys` page and `createPackageKey` in `db.ts`)
- `courseId=0` on a key historically meant "LexAI key" — package keys also have `courseId=0`, so **always check `key.packageId` first** before treating as LexAI
- Guard locations: `activateLexaiKey()` in `db.ts`, `activateKey` and `redeemKey` in `routers.ts`
- `fulfillPackageEntitlements()` in `db.ts` falls back to enrolling in ALL published courses when `packageCourses` table is empty
- Do NOT create or reference `registrationKeys` (old course keys) for any new feature — use `packageKeys` table only

---

## Business Rules

### VAT (Jordan, 16% inclusive)
```ts
// CORRECT — VAT is included in the displayed price
vatAmount = Math.round(totalAmount * 16 / 116)
subtotal   = totalAmount - vatAmount

// WRONG — never do this (adds VAT on top)
vatAmount = totalAmount * 0.16
```

### Packages
- Only 2 types: Basic ($200, no LexAI) and Comprehensive ($500, includes LexAI)
- Both include Trading Course + Recommendations
- **All access is granted via package keys** — legacy per-course keys (`registrationKeys`) are retired and no longer issued
- LexAI, Recommendations, and legacy course key admin UIs are **hidden** but backend is intentionally kept

### Auth Sessions
- Users: JWT 24h expiry, idle timeout 30 min, cookie maxAge 24h
- Admins: JWT 2h expiry, idle timeout 15 min, cookie maxAge 2h
- Cookie name: `app_session_id`

---

## Dates & Locale

- **Always use `ar-EG`** locale for Arabic dates — NEVER `ar-SA` (shows Hijri calendar)
- Applied across all date formatting calls site-wide

---

## UI/UX Conventions

- **Bilingual**: All user-facing text must have both Arabic and English variants
- **Mobile-first**: Business owner tests on mobile frequently — always verify mobile layout
- **WhatsAppFloat**: Whitelist approach — only shows on known public paths (`/`, `/checkout`, `/articles`, `/events`, `/careers`, `/about`, `/refund-policy`, `/terms`, `/privacy`). Hidden everywhere else.
- **KeyActivationPrompt**: Dialog on `MyDashboard` when user has no enrollments — dismissed via `sessionStorage`
- **Admin sidebar sections**: Overview → Content → Careers → Users → Support → Reports → Moderation
- Student nav items: Dashboard, LexAI, Recommendations, Support, Quizzes, My Package, Notifications, Points, Calculators
- **Removed from nav**: Orders (page kept), Subscriptions (redirects to `/my-packages`), Profile (accessible via avatar click)
- **StudentPackages.tsx**: Merged "My Package" + "My Subscriptions" into one page — package status, subscription history, freeze, upgrade CTA, feature badges
- **Episode duration**: DB stores seconds (e.g., 182 = ~3 min). Display: `Math.floor(duration / 60)` min. Watch requirement: `duration * 0.7` seconds.
- **Notification system**: `user_notifications` table + `users.lastActiveAt` + `users.notificationPrefs` (JSON). Email suppression when user is online (active < 5 min). Notification prefs UI in Profile.tsx.

---

## Hidden Features (backend kept, UI disabled)

These can be re-enabled by uncommenting routes in `App.tsx` and sidebar entries in `DashboardLayout.tsx`:
- LexAI admin (Conversations, Subscriptions)
- Recommendations admin (Group Management)
- Legacy course keys (`/admin/keys`)

---

## Build & Deploy

```bash
# Frontend build (always use root vite.config.ts, NOT frontend/vite.config.ts)
npx vite build

# Frontend deploy
npx wrangler pages deploy dist/public --project-name xflexacademy --branch main

# Worker build + deploy
npm run build:worker
wrangler deploy dist/worker.js --config wrangler-worker.toml --env production

# Combined shortcut
npm run deploy:worker
```

> **Deploy discipline**: Batch ≥5 fixes before running build + deploy. Do NOT deploy after each individual fix.

---

## CodeGraph (Semantic Code Intelligence)

CodeGraph is set up for this project with a pre-built semantic graph of all symbols, call chains, imports, and dependencies. **Always prefer `codegraph_*` tools over file search/grep for code analysis tasks.**

### When to use CodeGraph tools
- **Understanding code**: `codegraph_get_ai_context` — returns source, callers, callees, imports, architecture context
- **Before editing**: `codegraph_get_edit_context` — source + callers + tests + memories + git history
- **Finding symbols**: `codegraph_symbol_search` — hybrid BM25 + semantic search by name or natural language
- **Call chains**: `codegraph_get_callers` / `codegraph_get_callees` — who calls what
- **Impact analysis**: `codegraph_analyze_impact` — blast radius before modifying/deleting
- **Finding tests**: `codegraph_find_related_tests` — tests that exercise a function
- **Project questions**: `codegraph_get_curated_context` — natural language queries ("how does auth work?")
- **Memory**: `codegraph_memory_context` — get stored memories relevant to a file/function

### CodeGraph Memory
31 memories are stored (26 from git history mining + 5 project context). These are automatically surfaced when relevant. Key stored memories:
- Project stack & key files
- Business rules (packages, keys, VAT)
- Critical conventions & pitfalls
- Auth & session configuration
- UI navigation & hidden features

### Configuration
- VS Code settings: `.vscode/settings.json` (indexOnStartup enabled)
- Auto-reindexes on file changes
- URI format for tools: `file:///c:/Users/islamt/website-xflexwithai/path/to/file.ts`

---

## Common Pitfalls

1. **Wrong vite config**: Use root `vite.config.ts`, never `frontend/vite.config.ts`
2. **ar-SA dates**: Will render Hijri calendar — always use `ar-EG`
3. **VAT formula**: Inclusive (not additive) — see formula above
4. **Package keys**: Always check `packageId` before assuming `courseId=0` means LexAI
5. **D1 SQLite quirks**: Some PostgreSQL features don't exist — always validate SQL syntax for SQLite
6. **Large files**: `backend/db.ts` and `backend/routers.ts` are very large — use `codegraph_symbol_search` or `codegraph_get_ai_context` instead of reading whole files
7. **Video URLs**: Always use `https://videos.xflexacademy.com` domain (NOT xflexwithai.com). `normalizeVideoUrl()` in db.ts is a safety net
8. **Video `<video>` tags**: Always include `controlsList="nodownload"` and `onContextMenu={e => e.preventDefault()}` on all video elements
9. **Episode deletion**: Must archive video in R2 before DB delete — see `storageArchiveR2()` in `storage-r2.ts`
10. **Episode duration**: DB stores **seconds**, not minutes. Display: `Math.floor(duration / 60)`. Watch threshold: `duration * 0.7`. Never multiply by 60.

---

## Git Remote
`https://github.com/IslamThwabeh/xflexwithai.git` (main branch)

---

## Self-Maintenance (Important!)

After any significant progress — new feature added, major bug fixed, architecture changed, new pattern established, new page/route created — **always update**:

1. `.github/copilot-instructions.md` — if the change affects architecture, conventions, key files, business rules, or common pitfalls
2. `/memories/repo/project-overview.md` — if new pages, routes, or structural changes were made
3. `/memories/repo/lessons-learned.md` — if a new pitfall, workaround, or important pattern was discovered
4. `/memories/repo/deploy-practice.md` — if deploy steps or migration history changed

This keeps future sessions token-efficient and avoids re-discovering the same things.
