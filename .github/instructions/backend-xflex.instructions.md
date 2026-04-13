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
- Renewal package keys should reject only when the user already has in-system active `packageSubscriptions` and none match the renewal package. Imported/outside-system users with no package row yet should be allowed through the renewal flow so entitlements can be repaired.
- `fulfillPackageEntitlements()` falls back to all published courses when `packageCourses` is empty.
- Pending LexAI/Recommendations windows must anchor to the original package-key `activatedAt`, not to a later login-time entitlement sync or repair run.
- Use `getUserEntitlementDays(userId)` for durations. Do not hardcode 30 or 44 days.
- Pending subscriptions are not accessible. Active getters must filter `isPendingActivation=false`.
- When a pending timed service is already past `maxActivationDate`, repair or access flows should auto-activate it instead of leaving it blocked until a dedicated status route happens to run.
- Recommendation channel publishing is silence-based: create a `recommendationAlerts` row, wait 60 seconds, then allow analyst `recommendation`, `update`, and `result` messages. Every analyst message refreshes the 15-minute inactivity timer; only after 15 minutes of silence is a new alert required.
- Recommendation alert emails should key off `users.lastInteractiveAt`, not `lastActiveAt`, because authenticated polling traffic should not suppress inactive-user email delivery.
- Recommendation alert emails should be localized per student when possible. Use the saved student language preference if present; otherwise default to Arabic. Keep OTP/login codes as plain-text emails.
- Recommendation thread unfollow is stored per user on the root thread. Keep the thread visible in feeds and suppress only future child `update` / `result` deliveries for muted users; do not suppress the original root recommendation send.
- Thread unfollow email links should stay auth-required and bounce through `/recommendations?threadAction=unfollow&threadId=...`; do not introduce anonymous one-click unsubscribe tokens for recommendation threads.
- For create-or-update entitlement flows, use `getAnyRecommendationSubscription()` / `getAnyLexaiSubscription()` rather than the active-only getters, or you can create duplicates.
- `skipCourseForUser()` is flag-only: it sets `isAdminSkipped=1`, does not mark episodes watched, and should preserve student progress.
- Cloudflare Workers do not keep detached promises alive after the response. Always `await` async work or use `ctx.waitUntil()`.
- Use `storagePutR2()` from `backend/storage-r2.ts` for worker-side uploads; the old `storagePut()` path is not valid in Workers.
- Video URLs should use `https://videos.xflexacademy.com`; `normalizeVideoUrl()` is the safety net.
- AI onboarding thresholds: `saveOnboardingAiResult()` auto-approves at >=90%, auto-rejects at <50%, and queues 50-89% for admin review.
