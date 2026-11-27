export type StaffReviewCapability = {
  endpoint: string;
  en: string;
  ar: string;
  roles: readonly string[];
  immutable?: boolean;
};

// Mirrors the supportStaffProcedure gate. These summaries never authorize requests.
export const SUPPORT_REVIEW_ROLES = [
  "support",
  "analyst",
  "analyst_duplicate_guard",
  "key_manager",
  "plan_manager",
  "client_lookup",
  "view_progress",
  "view_recommendations",
  "view_subscriptions",
  "view_quizzes",
  "staff_performance_employee",
  "staff_performance_manager",
  "student_surveys_manager",
  "loyalty_rewards_manager",
  "student_community_moderator",
  "student_job_eligibility_manager",
];

export const STAFF_REVIEW_CAPABILITIES: readonly StaffReviewCapability[] = [
  {
    endpoint: "supportChat.listAll",
    en: "View support conversations",
    ar: "عرض محادثات الدعم",
    roles: SUPPORT_REVIEW_ROLES,
  },
  {
    endpoint: "supportChat.getMessages",
    en: "Read support messages",
    ar: "قراءة رسائل الدعم",
    roles: SUPPORT_REVIEW_ROLES,
  },
  {
    endpoint: "supportChat.reply",
    en: "Reply to support messages",
    ar: "الرد على رسائل الدعم",
    roles: SUPPORT_REVIEW_ROLES,
  },
  {
    endpoint: "supportChat.suggestReply",
    en: "Suggest a support reply with AI",
    ar: "اقتراح رد للدعم بالذكاء الاصطناعي",
    roles: SUPPORT_REVIEW_ROLES,
  },
  {
    endpoint: "supportChat.clearEscalation",
    en: "Clear a support escalation",
    ar: "إلغاء تصعيد محادثة الدعم",
    roles: SUPPORT_REVIEW_ROLES,
  },
  {
    endpoint: "lexaiSupport.listCases",
    en: "Review LexAI support cases",
    ar: "مراجعة حالات دعم LexAI",
    roles: ["lexai_support"],
  },
  {
    endpoint: "recommendations.postMessage",
    en: "Publish recommendations after publishing checks",
    ar: "نشر التوصيات بعد اجتياز فحوص النشر",
    roles: ["analyst"],
  },
  {
    endpoint: "recommendations.deleteMessage",
    en: "Delete published recommendations",
    ar: "حذف التوصيات المنشورة",
    roles: [],
    immutable: true,
  },
  {
    endpoint: "enrollments.skipCourse",
    en: "Skip a student's course",
    ar: "تخطي دورة الطالب",
    roles: ["key_manager", "support"],
  },
  {
    endpoint: "enrollments.rollbackSkip",
    en: "Undo a course skip",
    ar: "التراجع عن تخطي الدورة",
    roles: ["key_manager", "support"],
  },
  {
    endpoint: "supportDashboard.searchClients",
    en: "Search clients",
    ar: "البحث عن العملاء",
    roles: ["client_lookup", "support"],
  },
  {
    endpoint: "supportDashboard.clientProgress",
    en: "View course progress",
    ar: "عرض تقدم الطالب",
    roles: ["view_progress"],
  },
  {
    endpoint: "supportDashboard.clientSubscriptions",
    en: "View subscriptions",
    ar: "عرض الاشتراكات",
    roles: ["view_subscriptions"],
  },
  {
    endpoint: "supportDashboard.clientQuizProgress",
    en: "View quiz results",
    ar: "عرض نتائج الاختبارات",
    roles: ["view_quizzes"],
  },
  {
    endpoint: "clientProfiles.setRecommendationNotifications",
    en: "Manage client recommendation notifications",
    ar: "إدارة إشعارات توصيات العملاء",
    roles: ["manage_client_notifications"],
  },
  {
    endpoint: "adminEmail.deliveryLogs",
    en: "View email delivery logs",
    ar: "عرض سجلات تسليم البريد",
    roles: ["email_logs_viewer"],
  },
  {
    endpoint: "adminEmail.deliveryLogSummary",
    en: "View email delivery summary",
    ar: "عرض ملخص تسليم البريد",
    roles: ["email_logs_viewer"],
  },
  {
    endpoint: "roles.setRoles",
    en: "Change employee roles (full admin only)",
    ar: "تعديل أدوار الموظفين (المدير الكامل فقط)",
    roles: [],
  },
];

export function canReviewCapability(
  roles: readonly string[],
  capability: StaffReviewCapability,
  active = true
) {
  return (
    active &&
    !capability.immutable &&
    capability.roles.some(role => roles.includes(role))
  );
}
