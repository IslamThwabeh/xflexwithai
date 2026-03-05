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
