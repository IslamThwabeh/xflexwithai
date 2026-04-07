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
export const IDLE_TIMEOUT_STAFF_MS = 15 * 60 * 1000;  // 15 min
export const IDLE_TIMEOUT_ADMIN_MS = 15 * 60 * 1000;  // 15 min

// ── Staff Role → Admin Page Access Mapping ───────────────────────────
// Maps each role to the admin pages it grants access to.
// Used by the "Staff Review" feature to preview what each employee sees.
export const ROLE_PAGE_ACCESS: Record<string, string[]> = {
  // Core roles
  support: ["/admin/support", "/admin/bug-reports", "/admin/students", "/admin/notifications"],
  lexai_support: ["/admin/lexai", "/admin/notifications"],
  key_manager: ["/admin/package-keys", "/admin/students", "/admin/orders", "/admin/notifications"],
  analyst: ["/admin/recommendations", "/admin/notifications"], // analyst only posts recommendations

  // Support permissions (view-only, grant read access to specific data)
  client_lookup: ["/admin/students", "/admin/notifications"],
  view_progress: ["/admin/students", "/admin/notifications"],
  view_recommendations: ["/admin/students", "/admin/notifications"],
  view_subscriptions: ["/admin/students", "/admin/notifications"],
  view_quizzes: ["/admin/quizzes", "/admin/students", "/admin/notifications"],
  plan_manager: ["/admin/plan-progress", "/admin/notifications"],
};

// All available staff roles
export const ALL_STAFF_ROLES = [
  "analyst", "support", "lexai_support", "key_manager", "plan_manager",
  "client_lookup", "view_progress", "view_recommendations", "view_subscriptions", "view_quizzes",
] as const;
export type StaffRole = typeof ALL_STAFF_ROLES[number];

export const BUG_REPORT_STATUSES = [
  "pending",
  "rewarded",
  "rejected",
] as const;

export type BugReportStatus = typeof BUG_REPORT_STATUSES[number];

export const BUG_REPORT_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type BugReportRiskLevel = typeof BUG_REPORT_RISK_LEVELS[number];

export const LEXAI_SUPPORT_CASE_STATUSES = [
  "open",
  "waiting_student",
  "escalated",
  "resolved",
] as const;

export const LEXAI_SUPPORT_CASE_PRIORITIES = [
  "normal",
  "high",
  "urgent",
] as const;

/** Given a list of staff roles, return the best admin page to land on. */
export function getStaffLandingPage(roles: string[]): string {
  for (const role of roles) {
    const pages = ROLE_PAGE_ACCESS[role];
    if (pages && pages.length > 0) return pages[0];
  }
  return "/admin/recommendations"; // fallback
}

// ── Staff Notification Events ────────────────────────────────────────
export const STAFF_NOTIFICATION_EVENTS = {
  new_support_message:  { labelEn: "New Support Message",       labelAr: "رسالة دعم جديدة",          roles: ["support"],      actionUrl: "/admin/support" },
  human_escalation:     { labelEn: "Human Escalation",          labelAr: "طلب تحويل لموظف",          roles: ["support"],      actionUrl: "/admin/support" },
  lexai_case_assigned:  { labelEn: "LexAI Case Assigned",       labelAr: "تم تعيين حالة LexAI",      roles: ["lexai_support"], actionUrl: "/admin/lexai" },
  lexai_followup_requested: { labelEn: "LexAI Follow-up Requested", labelAr: "تم طلب متابعة LexAI", roles: ["lexai_support"], actionUrl: "/admin/lexai" },
  lexai_expiry_soon:    { labelEn: "LexAI Expiry Soon",         labelAr: "LexAI على وشك الانتهاء",   roles: ["lexai_support"], actionUrl: "/admin/lexai" },
  new_order:            { labelEn: "New Order",                 labelAr: "طلب جديد",                 roles: ["key_manager"],  actionUrl: "/admin/orders" },
  key_activated:        { labelEn: "Package Key Activated",     labelAr: "تم تفعيل مفتاح",            roles: ["key_manager"],  actionUrl: "/admin/package-keys" },
  bug_report_submitted: { labelEn: "Bug Report Submitted",      labelAr: "تم إرسال بلاغ خطأ",         roles: ["support"],      actionUrl: "/admin/bug-reports" },
  offer_agreement:      { labelEn: "Offer Agreement Signed",    labelAr: "تم توقيع اتفاقية عرض",      roles: [],               actionUrl: "/admin/offer-agreements" },
  plan_progress_update: { labelEn: "Plan Progress Update",      labelAr: "تحديث خطة التقدم",          roles: ["plan_manager"], actionUrl: "/admin/plan-progress" },
  broker_proof_submitted:{ labelEn: "Broker Proof Submitted",   labelAr: "تم رفع إثبات الوسيط",       roles: ["support"],      actionUrl: "/admin/brokers" },
  subscription_expiring:{ labelEn: "Subscription Expiring",     labelAr: "اشتراك على وشك الانتهاء",    roles: [],               actionUrl: "/admin/expiry-report" },
  course_completion:    { labelEn: "Course Completed",          labelAr: "تم إكمال الكورس",           roles: [],               actionUrl: "/admin/students" },
  student_inactivity:   { labelEn: "Student Inactive",          labelAr: "طالب غير نشط",             roles: [],               actionUrl: "/admin/students" },
} as const;

export type StaffNotificationEventType = keyof typeof STAFF_NOTIFICATION_EVENTS;
