---
description: "Use when editing XFlex backend routers, db logic, schema, package keys, subscriptions, D1 SQL, Cloudflare Worker code, or R2 storage integrations."
name: "XFlex Backend Rules"
applyTo: "backend/**,database/**"
---

# XFlex Backend Rules

- All tRPC procedures live in `backend/routers.ts`; auth middleware is `backend/middleware/unified-auth.ts`; frontend calls go through `frontend/src/lib/trpc.ts`.
- D1 is SQLite: avoid PostgreSQL-only syntax such as `RETURNING`; validate unfamiliar tables with `PRAGMA table_info(tableName)`; column names are camelCase.
- Production DB query pattern: `npx wrangler d1 execute xflexwithai-db --remote --command "SQL"`.
- Package keys are the only supported entitlement mechanism for new work. Do not create or reference legacy `registrationKeys`.
- If `courseId=0`, check `packageId` first before treating a key as LexAI.
- `fulfillPackageEntitlements()` falls back to all published courses when `packageCourses` is empty.
- Use `getUserEntitlementDays(userId)` for durations. Do not hardcode 30 or 44 days.
- Pending subscriptions are not accessible. Active getters must filter `isPendingActivation=false`.
- For create-or-update entitlement flows, use `getAnyRecommendationSubscription()` / `getAnyLexaiSubscription()` rather than the active-only getters, or you can create duplicates.
- `skipCourseForUser()` is flag-only: it sets `isAdminSkipped=1`, does not mark episodes watched, and should preserve student progress.
- Cloudflare Workers do not keep detached promises alive after the response. Always `await` async work or use `ctx.waitUntil()`.
- Use `storagePutR2()` from `backend/storage-r2.ts` for worker-side uploads; the old `storagePut()` path is not valid in Workers.
- Video URLs should use `https://videos.xflexacademy.com`; `normalizeVideoUrl()` is the safety net.
- AI onboarding thresholds: `saveOnboardingAiResult()` auto-approves at >=90%, auto-rejects at <50%, and queues 50-89% for admin review.
