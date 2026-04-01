# XFlex Trading Academy — Copilot Instructions

## Project Snapshot
- XFlex is a bilingual (Arabic/English) trading academy for Jordanian students.
- It sells only 2 package types: **Basic ($200, no LexAI)** and **Comprehensive ($500, includes LexAI)**.
- Stack: React + TypeScript + Wouter + Tailwind/shadcn on the frontend; tRPC + Drizzle + Cloudflare D1 on the backend; Cloudflare R2 for media; JWT auth.

## Work Efficiently
- Prefer `codegraph_*` tools for analysis before raw file reads, especially for large files.
- Search before reading whole files; `backend/db.ts` and `backend/routers.ts` are the largest hotspots.
- Key files: `backend/db.ts`, `backend/routers.ts`, `database/schema.ts`, `frontend/src/App.tsx`, `frontend/src/components/ClientLayout.tsx`, `frontend/src/components/DashboardLayout.tsx`, `shared/const.ts`.

## Global Non-Negotiables
- Cloudflare D1 is SQLite. Use SQLite-compatible SQL.
- Package access is package-key based. Do not introduce or use legacy `registrationKeys` for new work.
- If a key has `courseId=0`, always check `packageId` first before treating it as LexAI.
- VAT is inclusive in displayed prices: `vatAmount = Math.round(totalAmount * 16 / 116)`.
- Arabic dates must use `ar-EG`, never `ar-SA`.
- Episode duration is stored in seconds. Display with `Math.floor(duration / 60)` and use `duration * 0.7` for watch thresholds.
- Frontend builds must use the root `vite.config.ts`, not `frontend/vite.config.ts`.

## Scoped Instructions
- Backend, database, package keys, subscriptions, workers, and D1 rules: `.github/instructions/backend-xflex.instructions.md`
- Frontend UI, bilingual rules, layouts, and navigation: `.github/instructions/frontend-xflex.instructions.md`
- Admin/staff roles, route guards, and recommendation permissions: `.github/instructions/admin-staff.instructions.md`
- Build, deploy, and CodeGraph workflows: `.github/instructions/ops-codegraph.instructions.md`

## Self-Maintenance
After significant changes, update:
1. This file if the rule applies workspace-wide
2. The affected scoped instruction file in `.github/instructions/`
3. `/memories/repo/project-overview.md` for structure/page changes
4. `/memories/repo/lessons-learned.md` for pitfalls and patterns
5. `/memories/repo/deploy-practice.md` for deploy workflow changes
