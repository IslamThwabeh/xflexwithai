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
- Analyst access is isolated to `/admin/recommendations`; analysts should not get support chat access through `supportStaffProcedure`.
- `AdminRecommendations.tsx` is dual-mode: admin sees `Management` + `Channel`; analyst sees `Channel` only.
- Recommendation deletion rule: admins can delete any message/result; analysts can only delete their own.
- Prefer the bulk role path: `roles.setRoles` + `setUserRoles()` when editing multiple permissions.
- Guard selection matters:
  - `adminProcedure` -> admin only
  - `supportStaffProcedure` -> admin or supported staff roles
  - `adminOrRoleProcedure([...])` -> admin or specific roles only
- `ctx.admin` is populated only on `adminProcedure`. On `protectedProcedure`, resolve admin status explicitly, for example with `db.getAdminByEmail(ctx.user.email)`.
- Current guard mapping: order flows use `key_manager`; `reports.subscribers` uses `supportStaffProcedure`; quiz read routes use `view_quizzes`; quiz write routes stay admin-only.
