export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ── Session / Idle timeouts ──────────────────────────────────────────
// JWT hard expiry (server-enforced – even if user keeps tab open)
export const JWT_EXPIRY_USER  = "24h";   // users & support
export const JWT_EXPIRY_ADMIN = "2h";    // admins

// Cookie maxAge (seconds) – mirrors JWT expiry
export const COOKIE_MAX_AGE_USER  = 24 * 60 * 60;   // 24 h
export const COOKIE_MAX_AGE_ADMIN = 2 * 60 * 60;     // 2 h

// Client-side idle timeout (ms) – auto-logout on inactivity
export const IDLE_TIMEOUT_USER_MS  = 30 * 60 * 1000;  // 30 min
export const IDLE_TIMEOUT_ADMIN_MS = 15 * 60 * 1000;  // 15 min

// ── Staff Role → Admin Page Access Mapping ───────────────────────────
// Maps each role to the admin pages it grants access to.
// Used by the "Staff Review" feature to preview what each employee sees.
export const ROLE_PAGE_ACCESS: Record<string, string[]> = {
  // Core roles
  support: ["/admin/support", "/admin/students"],
  key_manager: ["/admin/package-keys", "/admin/students", "/admin/orders"],
  analyst: ["/admin/support"], // can publish recommendations via support-level access

  // Support permissions (view-only, grant read access to specific data)
  client_lookup: ["/admin/students"],
  view_progress: ["/admin/students"],
  view_recommendations: ["/admin/students"],
  view_subscriptions: ["/admin/students"],
  view_quizzes: ["/admin/quizzes", "/admin/students"],
};

// All available staff roles
export const ALL_STAFF_ROLES = [
  "analyst", "support", "key_manager",
  "client_lookup", "view_progress", "view_recommendations", "view_subscriptions", "view_quizzes",
] as const;
export type StaffRole = typeof ALL_STAFF_ROLES[number];
