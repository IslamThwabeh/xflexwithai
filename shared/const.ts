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
  plan_manager: ["/admin/plan-progress", "/admin/plan-progress/legacy", "/admin/notifications"],
  staff_performance_employee: ["/admin/my-performance"],
  staff_performance_manager: ["/admin/staff-performance"],
  student_surveys_manager: ["/admin/student-surveys", "/admin/notifications"],
  loyalty_rewards_manager: ["/admin/points", "/admin/notifications"],
  student_community_moderator: ["/admin/community", "/admin/notifications"],
  student_job_eligibility_manager: ["/admin/job-eligibility", "/admin/notifications"],
};

// All available staff roles
export const ALL_STAFF_ROLES = [
  "analyst", "support", "lexai_support", "key_manager", "plan_manager",
  "client_lookup", "view_progress", "view_recommendations", "view_subscriptions", "view_quizzes",
  "staff_performance_employee", "staff_performance_manager",
  "student_surveys_manager", "loyalty_rewards_manager", "student_community_moderator",
  "student_job_eligibility_manager",
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
  package_key_blocked:  { labelEn: "Package Key Blocked",       labelAr: "تم منع تفعيل مفتاح",        roles: ["key_manager", "support"], actionUrl: "/admin/package-keys" },
  bug_report_submitted: { labelEn: "Bug Report Submitted",      labelAr: "تم إرسال بلاغ خطأ",         roles: ["support"],      actionUrl: "/admin/bug-reports" },
  offer_agreement:      { labelEn: "Offer Agreement Signed",    labelAr: "تم توقيع اتفاقية عرض",      roles: [],               actionUrl: "/admin/offer-agreements" },
  plan_progress_update: { labelEn: "Foundation Plan Update",   labelAr: "تحديث الخطة التأسيسية",      roles: ["plan_manager"], actionUrl: "/admin/plan-progress/legacy" },
  broker_proof_submitted:{ labelEn: "Broker Proof Submitted",   labelAr: "تم رفع إثبات الوسيط",       roles: ["support"],      actionUrl: "/admin/brokers" },
  subscription_expiring:{ labelEn: "Subscription Expiring",     labelAr: "اشتراك على وشك الانتهاء",    roles: [],               actionUrl: "/admin/expiry-report" },
  course_completion:    { labelEn: "Course Completed",          labelAr: "تم إكمال الكورس",           roles: [],               actionUrl: "/admin/students" },
  student_inactivity:   { labelEn: "Student Inactive",          labelAr: "طالب غير نشط",             roles: [],               actionUrl: "/admin/students" },
  recommendation_delivery_anomaly: { labelEn: "Recommendation Delivery Anomaly", labelAr: "خلل في توصيل التوصيات", roles: [], actionUrl: "/admin/recommendations" },
  email_delivery_anomaly: { labelEn: "Email Delivery Anomaly", labelAr: "خلل في توصيل البريد", roles: [], actionUrl: "/admin/email-logs" },
  timed_service_activation_failure: { labelEn: "Timed Service Activation Failure", labelAr: "فشل تفعيل خدمة زمنية", roles: ["support", "key_manager"], actionUrl: "/admin/expiry-report" },
  recommendation_published: { labelEn: "Recommendation Published", labelAr: "تم نشر توصية", roles: [], actionUrl: "/admin/recommendations" },
  student_survey_submitted: { labelEn: "Student Survey Submitted", labelAr: "تم إرسال استبيان طالب", roles: ["student_surveys_manager"], actionUrl: "/admin/student-surveys" },
  loyalty_reward_requested: { labelEn: "Reward Requested", labelAr: "تم طلب مكافأة", roles: ["loyalty_rewards_manager"], actionUrl: "/admin/points" },
  community_content_reported: { labelEn: "Community Report Submitted", labelAr: "تم إرسال بلاغ مجتمعي", roles: ["student_community_moderator"], actionUrl: "/admin/community" },
  job_eligibility_review_requested: { labelEn: "Job Eligibility Review Requested", labelAr: "تم طلب مراجعة أهلية وظيفية", roles: ["student_job_eligibility_manager"], actionUrl: "/admin/job-eligibility" },
  staff_performance_submitted: { labelEn: "Daily Work Submitted", labelAr: "تم إرسال العمل اليومي", roles: ["staff_performance_manager"], actionUrl: "/admin/staff-performance" },
} as const;

export type StaffNotificationEventType = keyof typeof STAFF_NOTIFICATION_EVENTS;
