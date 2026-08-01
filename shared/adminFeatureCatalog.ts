import type { AdminFeatureFlagKey } from "./featureFlags";

export const ADMIN_FEATURE_IDS = [
  "staff-performance",
  "student-surveys",
  "points-rewards",
  "student-community",
  "job-eligibility",
] as const;

export type AdminFeatureId = (typeof ADMIN_FEATURE_IDS)[number];
export type AdminFeatureOverviewKey =
  | "staffPerformance"
  | "studentSurveys"
  | "loyaltyRewards"
  | "studentCommunity"
  | "studentJobEligibility";

export type AdminFeatureAudience = "staff" | "students" | "admins";
export type LocalizedAdminText = Readonly<{ en: string; ar: string }>;

export interface AdminFeatureDefinition {
  id: AdminFeatureId;
  overviewKey: AdminFeatureOverviewKey;
  flagKey: AdminFeatureFlagKey;
  adminPath: string;
  previewPath: string;
  managerRole: string;
  title: LocalizedAdminText;
  shortTitle: LocalizedAdminText;
  description: LocalizedAdminText;
  audience: readonly AdminFeatureAudience[];
  capabilities: readonly LocalizedAdminText[];
}

/**
 * One business-facing source of truth for the phased admin features. Internal
 * setting keys stay here so the UI never has to expose them to an administrator.
 */
export const ADMIN_FEATURE_CATALOG: readonly AdminFeatureDefinition[] = [
  {
    id: "staff-performance",
    overviewKey: "staffPerformance",
    flagKey: "staff_performance_enabled",
    adminPath: "/admin/staff-performance",
    previewPath: "/admin/staff-performance?preview=employee",
    managerRole: "staff_performance_manager",
    title: { en: "Staff Performance", ar: "أداء الموظفين" },
    shortTitle: { en: "Performance", ar: "الأداء" },
    description: {
      en: "Plan monthly goals, follow daily work, and review weekly staff reports.",
      ar: "خططي للأهداف الشهرية وتابعي العمل اليومي وراجعي تقارير الموظفين الأسبوعية.",
    },
    audience: ["staff", "admins"],
    capabilities: [
      { en: "Monthly plans and goals", ar: "الخطط والأهداف الشهرية" },
      { en: "Daily work submissions", ar: "تسليمات العمل اليومية" },
      { en: "Weekly reports and review", ar: "التقارير الأسبوعية والمراجعة" },
    ],
  },
  {
    id: "student-surveys",
    overviewKey: "studentSurveys",
    flagKey: "student_surveys_enabled",
    adminPath: "/admin/student-surveys",
    previewPath: "/admin/student-surveys?preview=student",
    managerRole: "student_surveys_manager",
    title: { en: "Student Surveys", ar: "استبيانات الطلاب" },
    shortTitle: { en: "Surveys", ar: "الاستبيانات" },
    description: {
      en: "Build surveys, assign a controlled student audience, and review responses.",
      ar: "أنشئي الاستبيانات وحددي جمهوراً تجريبياً مضبوطاً وراجعي الإجابات.",
    },
    audience: ["students", "admins"],
    capabilities: [
      { en: "Survey builder", ar: "منشئ الاستبيانات" },
      { en: "Audience assignment", ar: "تحديد جمهور الاستبيان" },
      { en: "Response review", ar: "مراجعة الإجابات" },
    ],
  },
  {
    id: "points-rewards",
    overviewKey: "loyaltyRewards",
    flagKey: "loyalty_rewards_enabled",
    adminPath: "/admin/points",
    previewPath: "/admin/points?preview=student",
    managerRole: "loyalty_rewards_manager",
    title: { en: "Points & Rewards", ar: "النقاط والمكافآت" },
    shortTitle: { en: "Points & Rewards", ar: "النقاط والمكافآت" },
    description: {
      en: "Keep the points ledger visible and manage the optional rewards catalog and redemptions.",
      ar: "تابعي سجل النقاط وأديري كتالوج المكافآت الاختياري وطلبات الاستبدال.",
    },
    audience: ["students", "admins"],
    capabilities: [
      { en: "Student points ledger", ar: "سجل نقاط الطالب" },
      { en: "Rewards catalog", ar: "كتالوج المكافآت" },
      { en: "Redemption workflow", ar: "مسار طلبات الاستبدال" },
    ],
  },
  {
    id: "student-community",
    overviewKey: "studentCommunity",
    flagKey: "student_community_enabled",
    adminPath: "/admin/community",
    previewPath: "/admin/community?preview=student",
    managerRole: "student_community_moderator",
    title: { en: "Student Community", ar: "مجتمع الطلاب" },
    shortTitle: { en: "Community", ar: "المجتمع" },
    description: {
      en: "Manage student discussions, reports, moderation, and safety controls.",
      ar: "أديري نقاشات الطلاب والبلاغات والإشراف وضوابط السلامة.",
    },
    audience: ["students", "admins"],
    capabilities: [
      { en: "Posts and comments", ar: "المنشورات والتعليقات" },
      { en: "Reports and moderation", ar: "البلاغات والإشراف" },
      { en: "Safety terminology", ar: "مصطلحات الحماية" },
    ],
  },
  {
    id: "job-eligibility",
    overviewKey: "studentJobEligibility",
    flagKey: "student_job_eligibility_enabled",
    adminPath: "/admin/job-eligibility",
    previewPath: "/admin/job-eligibility?preview=student",
    managerRole: "student_job_eligibility_manager",
    title: { en: "Job Eligibility", ar: "الأهلية للوظائف" },
    shortTitle: { en: "Job Eligibility", ar: "الأهلية للوظائف" },
    description: {
      en: "Define eligibility rules, review student profiles, and prepare qualified candidates.",
      ar: "حددي قواعد الأهلية وراجعي ملفات الطلاب وجهزي المرشحين المؤهلين.",
    },
    audience: ["students", "admins"],
    capabilities: [
      { en: "Eligibility rules", ar: "قواعد الأهلية" },
      { en: "Career profiles", ar: "الملفات المهنية" },
      { en: "Candidate review", ar: "مراجعة المرشحين" },
    ],
  },
] as const;

const ADMIN_FEATURE_BY_PATH = new Map(
  ADMIN_FEATURE_CATALOG.map(feature => [feature.adminPath, feature] as const)
);

export function getAdminFeatureByPath(
  path: string
): AdminFeatureDefinition | undefined {
  return ADMIN_FEATURE_BY_PATH.get(path);
}

export function getAdminFeatureById(
  id: AdminFeatureId
): AdminFeatureDefinition {
  const feature = ADMIN_FEATURE_CATALOG.find(item => item.id === id);
  if (!feature) throw new Error(`Unknown admin feature: ${id}`);
  return feature;
}

/** Admins and assigned feature managers can discover the admin workspace before launch. */
export function canViewAdminFeatureNavigation(input: {
  feature: AdminFeatureDefinition;
  isAdmin: boolean;
  staffRoles: readonly string[];
  enabled: boolean;
}): boolean {
  if (input.isAdmin) return true;
  return input.staffRoles.includes(input.feature.managerRole);
}
