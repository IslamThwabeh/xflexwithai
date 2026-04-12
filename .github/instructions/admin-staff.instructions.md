---
description: "Use when editing XFlex admin pages, staff roles, permission guards, AdminRecommendations, DashboardLayout role filtering, or staff login and access control flows."
name: "XFlex Admin Staff Rules"
applyTo: "frontend/src/pages/Admin*.tsx,frontend/src/components/DashboardLayout.tsx,backend/routers.ts,backend/db.ts,shared/const.ts"
---

# XFlex Admin Staff Rules

- `users.isStaff` separates staff from students. Staff are excluded from student reports and stats.
- Staff accounts log in through `/auth` with OTP, not `/admin/login`.
- `auth.isAdmin` returns `{ isAdmin, isStaff, staffRoles }`; frontend role routing should rely on that shape.
- `DashboardLayout.tsx` filters pages through `ROLE_PAGE_ACCESS`; sidebar visibility and backend route guards must stay aligned.
- Role assignment is the single source of truth for permissions. Do not reintroduce `canPublishRecommendations` or other legacy permission columns.
- `lexai_support` is a dedicated staff role for `/admin/lexai`. Do not add it to `supportStaffProcedure` unless the business explicitly wants LexAI staff to inherit support chat access.
- `lexai_expiry_soon` is emitted by the daily worker for active, non-paused LexAI subscriptions at 7, 3, and 0 days remaining. It should keep `/admin/lexai` badge counts flowing and should ensure a LexAI support case exists before notifying staff.
- In staff-facing admin copy, call paused subscription access `Frozen` / `Freeze` / `Unfreeze` to match support-team terminology; internal API and DB names may still use `pause` / `resume` / `isPaused`.
- Analyst access is isolated to `/admin/recommendations`; analysts should not get support chat access through `supportStaffProcedure`.
- `AdminRecommendations.tsx` is dual-mode: admin sees `Management` + `Channel`; analyst sees `Channel` only.
- Recommendations are now silence-gated: after 15 minutes without an analyst message, the analyst must trigger `recommendations.notifyClients`, wait 60 seconds, then the chat reopens. Each new analyst message refreshes that 15-minute timer. Do not restore the old optional email checkbox flow.
- Same-trade follow-ups should stay child messages under the parent recommendation. Use `update` / `result` with `parentId`; they keep the chat alive and do not need a second symbol-specific alert while the analyst is still actively sending.
- On `AdminRecommendations.tsx`, optimize for the analyst fast path on mobile: main recommendation first, then card-driven `Reply` / `Add Result` actions. Do not force analysts through a large type-selection wizard before they can send a quick follow-up.
- Recommendation trade levels (`entryPrice`, `stopLoss`, `takeProfit1`, `takeProfit2`, `riskPercent`) are optional helpers, not mandatory posting fields. Keep them available but visually secondary.
- Recommendation deletion rule: admins can delete any message/result; analysts can only delete their own.
- On `AdminStudents.tsx`, route access to `/admin/students` is broader than some detail actions. Student timeline and progress detail calls should require `view_progress` for non-admin staff and must show a friendly permission message instead of failing silently.
- Shared client service context can be broader than progress access: the reusable client profile may be opened from Students, Support, and LexAI for allowed staff roles, but its timeline section must stay limited to admin or `view_progress`.
- `AdminLexai.tsx` default daily view is conversation-first. Queue workflow controls (`status`, `priority`, `ownership`, `notes`) should stay hidden behind the admin-only Ops area rather than returning to the main support-facing layout.
- On `AdminPackageKeys.tsx`, package selection must respect the current renewal/upgrade toggle when suggesting a price. Do not silently reset a renewal key back to the full package price when the package is chosen after the toggle is enabled.
- Prefer the bulk role path: `roles.setRoles` + `setUserRoles()` when editing multiple permissions.
- Guard selection matters:
  - `adminProcedure` -> admin only
  - `supportStaffProcedure` -> admin or supported staff roles
  - `lexaiSupportProcedure` -> admin or `lexai_support` only
  - `adminOrRoleProcedure([...])` -> admin or specific roles only
- `ctx.admin` is populated only on `adminProcedure`. On `protectedProcedure`, resolve admin status explicitly, for example with `db.getAdminByEmail(ctx.user.email)`.
- Current guard mapping: LexAI queue uses `lexaiSupportProcedure` while destructive LexAI actions stay admin-only; order flows use `key_manager`; `reports.subscribers` uses `supportStaffProcedure`; quiz read routes use `view_quizzes`; quiz write routes stay admin-only.
