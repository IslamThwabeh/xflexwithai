// Shared display metadata; assigning roles remains an admin-only server action.
export const ROLE_LABELS: Record<
  string,
  { labelKey: string; color: string; group: string }
> = {
  live_expert: {
    labelKey: "admin.roles.liveExpert",
    color: "bg-emerald-100 text-emerald-800",
    group: "Live Package Roles",
  },
  analyst: {
    labelKey: "admin.roles.analyst",
    color: "bg-amber-100 text-amber-800",
    group: "Core Roles",
  },
  analyst_duplicate_guard: {
    labelKey: "admin.roles.analystDuplicateGuard",
    color: "bg-orange-100 text-orange-800",
    group: "Core Roles",
  },
  support: {
    labelKey: "admin.roles.support",
    color: "bg-emerald-100 text-emerald-800",
    group: "Core Roles",
  },
  lexai_support: {
    labelKey: "admin.roles.lexaiSupport",
    color: "bg-teal-100 text-teal-800",
    group: "Core Roles",
  },
  key_manager: {
    labelKey: "admin.roles.keyManager",
    color: "bg-amber-100 text-amber-800",
    group: "Core Roles",
  },
  plan_manager: {
    labelKey: "admin.roles.planManager",
    color: "bg-teal-100 text-teal-800",
    group: "Core Roles",
  },
  view_progress: {
    labelKey: "admin.roles.viewProgress",
    color: "bg-green-100 text-green-800",
    group: "Support Permissions",
  },
  view_recommendations: {
    labelKey: "admin.roles.viewRec",
    color: "bg-pink-100 text-pink-800",
    group: "Support Permissions",
  },
  view_subscriptions: {
    labelKey: "admin.roles.viewSubs",
    color: "bg-cyan-100 text-cyan-800",
    group: "Support Permissions",
  },
  view_quizzes: {
    labelKey: "admin.roles.viewQuizzes",
    color: "bg-orange-100 text-orange-800",
    group: "Support Permissions",
  },
  client_lookup: {
    labelKey: "admin.roles.clientLookup",
    color: "bg-emerald-100 text-emerald-800",
    group: "Support Permissions",
  },
  manage_client_notifications: {
    labelKey: "admin.roles.manageClientNotifications",
    color: "bg-amber-100 text-amber-800",
    group: "Support Permissions",
  },
  staff_performance_employee: {
    labelKey: "admin.roles.performanceEmployee",
    color: "bg-sky-100 text-sky-800",
    group: "Performance Roles",
  },
  staff_performance_manager: {
    labelKey: "admin.roles.performanceManager",
    color: "bg-violet-100 text-violet-800",
    group: "Performance Roles",
  },
  student_surveys_manager: {
    labelKey: "admin.roles.studentSurveysManager",
    color: "bg-indigo-100 text-indigo-800",
    group: "Feature Roles",
  },
  loyalty_rewards_manager: {
    labelKey: "admin.roles.loyaltyRewardsManager",
    color: "bg-yellow-100 text-yellow-800",
    group: "Feature Roles",
  },
  student_community_moderator: {
    labelKey: "admin.roles.communityModerator",
    color: "bg-purple-100 text-purple-800",
    group: "Feature Roles",
  },
  student_job_eligibility_manager: {
    labelKey: "admin.roles.jobEligibilityManager",
    color: "bg-blue-100 text-blue-800",
    group: "Feature Roles",
  },
  email_logs_viewer: {
    labelKey: "admin.roles.emailLogsViewer",
    color: "bg-slate-100 text-slate-800",
    group: "Support Permissions",
  },
  finance_manager: {
    labelKey: "admin.roles.financeManager",
    color: "bg-emerald-100 text-emerald-800",
    group: "Finance Roles",
  },
  finance_clerk: {
    labelKey: "admin.roles.financeClerk",
    color: "bg-cyan-100 text-cyan-800",
    group: "Finance Roles",
  },
  finance_viewer: {
    labelKey: "admin.roles.financeViewer",
    color: "bg-slate-100 text-slate-800",
    group: "Finance Roles",
  },
  live_recording_uploader: {
    labelKey: "admin.roles.liveRecordingUploader",
    color: "bg-sky-100 text-sky-800",
    group: "Live Package Roles",
  },
  live_recording_publisher: {
    labelKey: "admin.roles.liveRecordingPublisher",
    color: "bg-violet-100 text-violet-800",
    group: "Live Package Roles",
  },
};
