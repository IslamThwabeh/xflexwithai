import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { type RouterOutputs, trpc } from "@/lib/trpc";
import {
  ADMIN_FEATURE_CATALOG,
  type AdminFeatureDefinition,
  type AdminFeatureId,
  type LocalizedAdminText,
} from "@shared/adminFeatureCatalog";
import type { AdminFeatureFlagKey } from "@shared/featureFlags";
import { LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS } from "@shared/livePackageOwnerReview";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  Eye,
  FileQuestion,
  Gauge,
  Loader2,
  MailCheck,
  MessageSquareText,
  Power,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type FeatureOverview = RouterOutputs["adminSettings"]["featureOverview"];
type FeatureStatus = "disabled" | "setup" | "pilot" | "live";

interface FeatureViewModel {
  enabled: boolean;
  status: FeatureStatus;
  metrics: Array<{ label: string; value: number | string }>;
  readiness: Array<{
    label: string;
    complete: boolean;
    href?: string;
    actionLabel?: string;
  }>;
  managerCount: number;
}

interface PendingChange {
  key: AdminFeatureFlagKey;
  enabled: boolean;
  label: string;
  highImpact?: boolean;
  impactCount?: number;
}

interface PendingLivePackageChange {
  control: "visibility" | "purchasing";
  enabled: boolean;
}

function formatLivePackageDate(value: string, isRtl: boolean) {
  return new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(new Date(value));
}

const featureVisuals: Record<
  AdminFeatureId,
  {
    icon: typeof ClipboardCheck;
    iconClass: string;
    accentClass: string;
  }
> = {
  "staff-performance": {
    icon: ClipboardCheck,
    iconClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    accentClass: "from-violet-500/10 via-violet-500/[0.03]",
  },
  "student-surveys": {
    icon: FileQuestion,
    iconClass:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    accentClass: "from-indigo-500/10 via-indigo-500/[0.03]",
  },
  "points-rewards": {
    icon: Award,
    iconClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    accentClass: "from-amber-500/10 via-amber-500/[0.03]",
  },
  "student-community": {
    icon: MessageSquareText,
    iconClass:
      "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    accentClass: "from-fuchsia-500/10 via-fuchsia-500/[0.03]",
  },
  "job-eligibility": {
    icon: BriefcaseBusiness,
    iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    accentClass: "from-sky-500/10 via-sky-500/[0.03]",
  },
};

function localized(text: LocalizedAdminText, isRtl: boolean) {
  return isRtl ? text.ar : text.en;
}

function arabicRemainingRequirements(count: number) {
  if (count === 1) return "متطلب واحد متبقٍ";
  if (count === 2) return "متطلبان متبقيان";
  return `${count} متطلبات متبقية`;
}

function statusCopy(status: FeatureStatus, isRtl: boolean) {
  const copy: Record<
    FeatureStatus,
    { en: string; ar: string; className: string }
  > = {
    disabled: {
      en: "Disabled",
      ar: "غير مفعّلة",
      className:
        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    },
    setup: {
      en: "Setup required",
      ar: "تحتاج إعداداً",
      className:
        "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    },
    pilot: {
      en: "Ready for pilot",
      ar: "جاهزة للتجربة",
      className:
        "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
    },
    live: {
      en: "Live",
      ar: "مفعّلة",
      className:
        "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    },
  };
  const item = copy[status];
  return { label: isRtl ? item.ar : item.en, className: item.className };
}

function deriveStatus(
  enabled: boolean,
  readiness: FeatureViewModel["readiness"],
  activity: number
): FeatureStatus {
  if (!enabled) return "disabled";
  if (readiness.some(item => !item.complete)) return "setup";
  return activity > 0 ? "live" : "pilot";
}

function buildFeatureViewModel(
  feature: AdminFeatureDefinition,
  overview: FeatureOverview,
  isRtl: boolean
): FeatureViewModel {
  switch (feature.id) {
    case "staff-performance": {
      const module = overview.modules.staffPerformance;
      const readiness = [
        {
          label: isRtl ? "تعيين مدير أداء" : "Assign a performance manager",
          complete: module.managers > 0,
          href: "/admin/roles?feature=staff-performance",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl
            ? "تعيين موظف واحد على الأقل"
            : "Assign at least one employee",
          complete: module.employees > 0,
          href: "/admin/roles?feature=staff-performance",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl
            ? "إنشاء أول خطة شهرية"
            : "Create the first monthly plan",
          complete: module.plans > 0,
          href: "/admin/staff-performance",
          actionLabel: isRtl ? "فتح التخطيط" : "Open planner",
        },
      ];
      return {
        enabled: module.enabled,
        status: deriveStatus(
          module.enabled,
          readiness,
          module.dailyLogs + module.weeklyReports
        ),
        metrics: [
          { label: isRtl ? "خطط" : "Plans", value: module.plans },
          {
            label: isRtl ? "سجلات يومية" : "Daily logs",
            value: module.dailyLogs,
          },
          {
            label: isRtl ? "تقارير أسبوعية" : "Weekly reports",
            value: module.weeklyReports,
          },
          { label: isRtl ? "موظفون" : "Employees", value: module.employees },
        ],
        readiness,
        managerCount: module.managers,
      };
    }
    case "student-surveys": {
      const module = overview.modules.studentSurveys;
      const readiness = [
        {
          label: isRtl ? "تعيين مسؤول استبيانات" : "Assign a survey manager",
          complete: module.managers > 0,
          href: "/admin/roles?feature=student-surveys",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl ? "إنشاء أول استبيان" : "Create the first survey",
          complete: module.surveys > 0,
          href: "/admin/student-surveys?tab=builder",
          actionLabel: isRtl ? "فتح المنشئ" : "Open builder",
        },
        {
          label: isRtl ? "إضافة أسئلة للاستبيان" : "Add survey questions",
          complete: module.questions > 0,
          href: "/admin/student-surveys?tab=builder",
          actionLabel: isRtl ? "فتح المنشئ" : "Open builder",
        },
      ];
      return {
        enabled: module.enabled,
        status: deriveStatus(
          module.enabled,
          readiness,
          module.assignments + module.answers
        ),
        metrics: [
          { label: isRtl ? "استبيانات" : "Surveys", value: module.surveys },
          { label: isRtl ? "أسئلة" : "Questions", value: module.questions },
          {
            label: isRtl ? "تكليفات" : "Assignments",
            value: module.assignments,
          },
          { label: isRtl ? "إجابات" : "Answers", value: module.answers },
        ],
        readiness,
        managerCount: module.managers,
      };
    }
    case "points-rewards": {
      const module = overview.modules.loyaltyRewards;
      const readiness = [
        {
          label: isRtl
            ? "نظام النقاط الأساسي متاح"
            : "Core points system is available",
          complete: true,
        },
        {
          label: isRtl ? "تعيين مسؤول مكافآت" : "Assign a rewards manager",
          complete: module.managers > 0,
          href: "/admin/roles?feature=points-rewards",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl ? "إضافة أول مكافأة" : "Add the first reward",
          complete: module.rewardItems > 0,
          href: "/admin/points?tab=rewards",
          actionLabel: isRtl ? "فتح المكافآت" : "Open rewards",
        },
      ];
      return {
        enabled: module.enabled,
        status: deriveStatus(module.enabled, readiness, module.redemptions),
        metrics: [
          {
            label: isRtl ? "النقاط الأساسية" : "Core points",
            value: isRtl ? "متاحة" : "Available",
          },
          { label: isRtl ? "مكافآت" : "Rewards", value: module.rewardItems },
          {
            label: isRtl ? "طلبات استبدال" : "Redemptions",
            value: module.redemptions,
          },
          {
            label: isRtl ? "مسؤولو المكافآت" : "Managers",
            value: module.managers,
          },
        ],
        readiness,
        managerCount: module.managers,
      };
    }
    case "student-community": {
      const module = overview.modules.studentCommunity;
      const readiness = [
        {
          label: isRtl ? "تعيين مشرف مجتمع" : "Assign a community moderator",
          complete: module.moderators > 0,
          href: "/admin/roles?feature=student-community",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl
            ? "إعداد قواعد المحتوى والحماية"
            : "Configure content safety terms",
          complete:
            module.activeCompetitorTerms > 0 &&
            module.activeProhibitedLanguageTerms > 0,
          href: "/admin/community?setup=policy",
          actionLabel: isRtl ? "فتح محرر القواعد" : "Open rule editor",
        },
        {
          label: isRtl
            ? "تشغيل فحص المحتوى الذكي"
            : "Connect automated content checks",
          complete: module.openAiConfigured,
          href: "/admin/community?setup=automated-checks",
          actionLabel: isRtl ? "فتح دليل الإعداد" : "Open setup guide",
        },
      ];
      return {
        enabled: module.enabled,
        status: deriveStatus(
          module.enabled,
          readiness,
          module.posts + module.moderationDecisions
        ),
        metrics: [
          { label: isRtl ? "منشورات" : "Posts", value: module.posts },
          {
            label: isRtl ? "بلاغات مفتوحة" : "Open reports",
            value: module.openReports,
          },
          {
            label: isRtl ? "قرارات إشراف" : "Decisions",
            value: module.moderationDecisions,
          },
          { label: isRtl ? "مشرفون" : "Moderators", value: module.moderators },
        ],
        readiness,
        managerCount: module.moderators,
      };
    }
    case "job-eligibility": {
      const module = overview.modules.studentJobEligibility;
      const readiness = [
        {
          label: isRtl ? "تعيين مسؤول أهلية" : "Assign an eligibility manager",
          complete: module.managers > 0,
          href: "/admin/roles?feature=job-eligibility",
          actionLabel: isRtl ? "فتح الصلاحيات" : "Open roles",
        },
        {
          label: isRtl
            ? "إضافة قاعدة مفعّلة لكل وظيفة منشورة"
            : "Add an enabled rule for every active job",
          complete:
            module.activeJobs > 0 &&
            module.coveredActiveJobs === module.activeJobs,
          href: "/admin/job-eligibility",
          actionLabel: isRtl ? "فتح القواعد" : "Open rules",
        },
        {
          label: isRtl
            ? "الملفات المهنية جاهزة للمراجعة"
            : "Career profiles ready for review",
          complete: module.profiles > 0,
          href: "/admin/job-eligibility?preview=student",
          actionLabel: isRtl ? "معاينة الطالب" : "Student preview",
        },
      ];
      return {
        enabled: module.enabled,
        status: deriveStatus(module.enabled, readiness, module.reviews),
        metrics: [
          { label: isRtl ? "ملفات مهنية" : "Profiles", value: module.profiles },
          {
            label: isRtl ? "وظائف بقواعد" : "Jobs with rules",
            value: `${module.coveredActiveJobs}/${module.activeJobs}`,
          },
          { label: isRtl ? "مراجعات" : "Reviews", value: module.reviews },
          {
            label: isRtl ? "مسؤولو الأهلية" : "Managers",
            value: module.managers,
          },
        ],
        readiness,
        managerCount: module.managers,
      };
    }
  }
}

function FeatureCenterSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminFeatureCenter() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    null
  );
  const [pendingLivePackageChange, setPendingLivePackageChange] =
    useState<PendingLivePackageChange | null>(null);

  const overviewQuery = trpc.adminSettings.featureOverview.useQuery(undefined, {
    retry: false,
  });
  const overview = overviewQuery.data;
  const livePackageQuery = trpc.packages.liveAdminPreview.useQuery(undefined, {
    retry: false,
  });
  const liveOwnerReviewQuery = trpc.livePackageOwnerReview.get.useQuery(
    undefined,
    { retry: false }
  );

  const updateFeatureFlag = trpc.adminSettings.updateFeatureFlag.useMutation({
    onSuccess: async () => {
      toast.success(
        isRtl
          ? "تم تحديث حالة الميزة وتسجيل التغيير"
          : "Feature status updated and recorded"
      );
      setPendingChange(null);
      await Promise.all([
        utils.adminSettings.featureOverview.invalidate(),
        utils.adminSettings.getAll.invalidate(),
        utils.staffPerformance.availability.invalidate(),
        utils.studentSurveys.availability.invalidate(),
        utils.community.availability.invalidate(),
        utils.points.rewardsAvailability.invalidate(),
        utils.studentJobEligibility.availability.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const updateLivePackage = trpc.packages.updateLiveConfig.useMutation({
    onSuccess: async () => {
      const changedVisibility =
        pendingLivePackageChange?.control === "visibility";
      toast.success(
        changedVisibility
          ? pendingLivePackageChange?.enabled
            ? isRtl
              ? "تم إظهار بكج لايف على الموقع وتسجيل القرار"
              : "Live Package is now visible and the decision was recorded"
            : isRtl
              ? "تم إخفاء بكج لايف وإغلاق الشراء وتسجيل القرار"
              : "Live Package was hidden, purchasing was closed, and the decision was recorded"
          : pendingLivePackageChange?.enabled
            ? isRtl
              ? "تم فتح شراء بكج لايف وتسجيل القرار"
              : "Live Package purchasing was opened and the decision was recorded"
            : isRtl
              ? "تم إغلاق شراء بكج لايف وتسجيل القرار"
              : "Live Package purchasing was closed and the decision was recorded"
      );
      setPendingLivePackageChange(null);
      await Promise.all([
        utils.packages.liveAdminPreview.invalidate(),
        utils.packages.livePublicState.invalidate(),
        utils.livePackage.adminWorkspace.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const viewModels = useMemo(() => {
    if (!overview) return [];
    return ADMIN_FEATURE_CATALOG.map(feature => ({
      feature,
      view: buildFeatureViewModel(feature, overview, isRtl),
    }));
  }, [isRtl, overview]);

  const enabledCount = viewModels.filter(({ view }) => view.enabled).length;
  const liveCount = viewModels.filter(
    ({ view }) => view.status === "live"
  ).length;
  const setupCount = viewModels.filter(({ view }) =>
    view.readiness.some(item => !item.complete)
  ).length;
  const surveys = overview?.modules.studentSurveys;
  const blockingAffectedStudents = surveys?.blockingAffectedStudents ?? 0;
  const livePackage = livePackageQuery.data;
  const liveOwnerAnswerCount = Object.values(
    liveOwnerReviewQuery.data?.answers ?? {}
  ).filter(answer => answer.trim().length > 0).length;
  const livePackageVisible = Boolean(livePackage?.config.adminVisible);
  const livePackagePurchasable = Boolean(
    livePackageVisible &&
      livePackage?.config.purchaseApproved &&
      livePackage.config.lifecycle === "active"
  );
  // The Feature Center counts a package once it appears publicly, even when its
  // independently controlled checkout remains in the Coming Soon state.
  const trackedFeatureCount = ADMIN_FEATURE_CATALOG.length + 1;
  const trackedEnabledCount = enabledCount + Number(livePackageVisible);
  const livePackageActivationBlocked = Boolean(
    !livePackage?.availability.deploymentEnabled ||
    !livePackage?.availability.readiness ||
    liveOwnerAnswerCount < LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length
  );

  const requestFeatureChange = (
    feature: AdminFeatureDefinition,
    enabled: boolean
  ) => {
    setPendingChange({
      key: feature.flagKey,
      enabled,
      label: localized(feature.title, isRtl),
    });
  };

  return (
    <DashboardLayout>
      <main
        className="container mx-auto space-y-6 p-4 sm:p-6"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="max-w-3xl">
              <Badge className="mb-4 border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
                <Sparkles className="h-3.5 w-3.5" />
                {isRtl ? "مركز الإدارة والعرض" : "Manage, preview, and launch"}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {isRtl ? "مركز الميزات" : "Admin Feature Center"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">
                {isRtl
                  ? "شاهدي حالة كل تجربة جديدة، أكملي إعدادها، وعاينيها كما يراها الطالب أو الموظف — من حساب الإدارة نفسه."
                  : "See every new experience, complete its setup, and preview exactly what students or staff will see—all from your admin account."}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  value: overview
                    ? `${trackedEnabledCount}/${trackedFeatureCount}`
                    : "—",
                  label: isRtl ? "مفعّلة" : "Enabled",
                },
                {
                  value: overview ? liveCount : "—",
                  label: isRtl ? "مستخدمة" : "In use",
                },
                {
                  value: overview ? setupCount : "—",
                  label: isRtl ? "تحتاج إعداداً" : "Need setup",
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="min-w-20 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-3 text-center backdrop-blur-sm sm:min-w-24"
                >
                  <p className="text-xl font-bold text-white">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-emerald-100/70">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Alert className="border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <Eye className="h-4 w-4" />
          <AlertTitle>
            {isRtl
              ? "العرض آمن ولا يحتاج حساب طالب"
              : "Safe preview—no student login required"}
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            {isRtl
              ? "أزرار المعاينة تفتح تجربة توضيحية لا تنشر محتوى، ولا ترسل إشعارات، ولا تسجل إجابات أو طلبات حقيقية."
              : "Preview buttons open a clearly labelled demonstration that does not publish content, send notifications, or create real submissions."}
          </AlertDescription>
        </Alert>

        <Card
          data-feature-id="live-package"
          className="overflow-hidden border-emerald-300 bg-gradient-to-br from-emerald-50 via-background to-sky-50 shadow-sm dark:border-emerald-900 dark:from-emerald-950/30 dark:to-sky-950/20"
        >
          <CardHeader className="border-b border-emerald-100 pb-5 dark:border-emerald-900/60">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Radio className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">
                      {isRtl ? "بكج لايف" : "Live Package"}
                    </h2>
                    <Badge
                      variant="outline"
                      className={
                        livePackageVisible
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }
                    >
                      {livePackagePurchasable
                        ? isRtl
                          ? "ظاهر والشراء مفتوح"
                          : "Visible · sales open"
                        : livePackageVisible
                          ? isRtl
                            ? "ظاهر · قريباً"
                            : "Visible · coming soon"
                          : isRtl
                            ? "مخفي"
                            : "Hidden"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {isRtl
                      ? "تحكّمي في ظهور البكج والشراء بشكل مستقل: يمكن عرضه بحالة قريباً قبل فتح التسجيل."
                      : "Control visibility and purchasing separately: the package can appear as Coming Soon before registration opens."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  variant={livePackageVisible ? "destructive" : "default"}
                  disabled={
                    livePackageQuery.isLoading ||
                    updateLivePackage.isPending ||
                    (!livePackageVisible &&
                      !livePackage?.availability.deploymentEnabled)
                  }
                  onClick={() =>
                    setPendingLivePackageChange({
                      control: "visibility",
                      enabled: !livePackageVisible,
                    })
                  }
                >
                  <Eye className="h-4 w-4" />
                  {livePackageVisible
                    ? isRtl
                      ? "إخفاء من الموقع"
                      : "Hide from website"
                    : isRtl
                      ? "إظهار على الموقع"
                      : "Show on website"}
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  variant={livePackagePurchasable ? "destructive" : "outline"}
                  disabled={
                    livePackageQuery.isLoading ||
                    updateLivePackage.isPending ||
                    (!livePackagePurchasable && livePackageActivationBlocked)
                  }
                  onClick={() =>
                    setPendingLivePackageChange({
                      control: "purchasing",
                      enabled: !livePackagePurchasable,
                    })
                  }
                >
                  <ShoppingCart className="h-4 w-4" />
                  {livePackagePurchasable
                    ? isRtl
                      ? "إغلاق الشراء"
                      : "Close purchasing"
                    : isRtl
                      ? "فتح الشراء"
                      : "Open purchasing"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            {livePackageQuery.isLoading && (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            )}
            {livePackageQuery.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {isRtl
                    ? "تعذر تحميل بكج لايف"
                    : "Live Package could not be loaded"}
                </AlertTitle>
                <AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => livePackageQuery.refetch()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {isRtl ? "إعادة المحاولة" : "Try again"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {livePackage?.package && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: isRtl ? "الظهور العام" : "Public visibility",
                      value: livePackage.config.adminVisible
                        ? isRtl
                          ? "مفعّل"
                          : "On"
                        : isRtl
                          ? "متوقف"
                          : "Off",
                    },
                    {
                      label: isRtl ? "اعتماد الشراء" : "Purchase approval",
                      value: livePackage.config.purchaseApproved
                        ? isRtl
                          ? "مفعّل"
                          : "On"
                        : isRtl
                          ? "متوقف"
                          : "Off",
                    },
                    {
                      label: isRtl ? "إجابات صاحبة العمل" : "Owner answers",
                      value: `${liveOwnerAnswerCount}/${LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length}`,
                    },
                    {
                      label: isRtl ? "الدورات الأساسية" : "Base courses",
                      value: livePackage.courses.length,
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-xl border bg-background/80 p-3 text-center"
                    >
                      <p className="text-lg font-bold">{item.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <section className="overflow-hidden rounded-2xl border-2 border-dashed border-violet-300 bg-background shadow-sm">
                  <div className="flex items-center gap-2 bg-violet-100 px-4 py-2.5 text-xs font-bold text-violet-950 dark:bg-violet-950 dark:text-violet-100">
                    <Eye className="h-4 w-4" />
                    {isRtl
                      ? "معاينة إدارية — هذا العرض لا ينشر البكج"
                      : "Admin preview—this view does not publish the package"}
                  </div>
                  <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_1fr]">
                    <div>
                      <Badge className="mb-3 bg-emerald-700">
                        {isRtl ? "بكج مؤقت ومحدود" : "Limited Live Package"}
                      </Badge>
                      <h3 className="text-2xl font-black">
                        {isRtl
                          ? livePackage.package.nameAr
                          : livePackage.package.nameEn}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {isRtl
                          ? livePackage.package.descriptionAr
                          : livePackage.package.descriptionEn}
                      </p>
                      <p className="mt-4 text-2xl font-black text-emerald-700">
                        ₪
                        {(livePackage.package.price / 100).toLocaleString(
                          isRtl ? "ar-JO" : "en-GB"
                        )}
                        <span className="ms-2 text-xs font-medium text-muted-foreground">
                          {isRtl ? "شامل الضريبة" : "VAT inclusive"}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-3 rounded-xl bg-muted/60 p-4 text-sm">
                      <p className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>
                          <strong>{isRtl ? "المبيعات: " : "Sales: "}</strong>
                          {formatLivePackageDate(
                            livePackage.config.salesStartsAt,
                            isRtl
                          )}{" "}
                          —{" "}
                          {formatLivePackageDate(
                            livePackage.config.salesEndsAt,
                            isRtl
                          )}
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <Radio className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>
                          <strong>
                            {isRtl ? "اللقاءات: " : "Live period: "}
                          </strong>
                          {formatLivePackageDate(
                            livePackage.config.sessionStartsAt,
                            isRtl
                          )}{" "}
                          —{" "}
                          {formatLivePackageDate(
                            livePackage.config.sessionEndsAt,
                            isRtl
                          )}
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>
                          {livePackage.availability.withinSalesWindow
                            ? isRtl
                              ? "الشراء يفتح فور التفعيل."
                              : "Purchasing opens immediately when enabled."
                            : isRtl
                              ? "حتى بعد التفعيل، يبدأ الشراء تلقائياً عند بداية فترة المبيعات."
                              : "After enabling, purchasing still waits for the configured sales window."}
                        </span>
                      </p>
                    </div>
                  </div>
                </section>

                {livePackageActivationBlocked && !livePackagePurchasable && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {isRtl
                        ? "التفعيل متوقف حتى اكتمال الجاهزية"
                        : "Activation is blocked until setup is ready"}
                    </AlertTitle>
                    <AlertDescription>
                      {!livePackage.availability.deploymentEnabled
                        ? isRtl
                          ? "مفتاح النشر الآمن في الخادم متوقف."
                          : "The server-side deployment safety switch is off."
                        : liveOwnerAnswerCount <
                            LIVE_PACKAGE_OWNER_REVIEW_QUESTIONS.length
                          ? isRtl
                            ? "راجعي وأكملي إجابات صاحبة العمل أولاً."
                            : "Review and complete the owner decisions first."
                          : livePackage.availability.errors.join(" ")}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-2 sm:grid-cols-3 [&>button]:min-h-11">
                  <Button
                    type="button"
                    onClick={() => setLocation("/admin/live-package")}
                  >
                    <Settings2 className="h-4 w-4" />
                    {isRtl
                      ? "الإعداد والمعاينة الكاملة"
                      : "Full setup & preview"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/admin/live-package-review")}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {isRtl ? "مراجعة إجابات المالكة" : "Review owner answers"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => livePackageQuery.refetch()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {isRtl ? "تحديث الحالة" : "Refresh status"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {overviewQuery.isLoading && <FeatureCenterSkeleton />}

        {overviewQuery.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {isRtl
                ? "تعذر تحميل حالة الميزات"
                : "Feature status could not be loaded"}
            </AlertTitle>
            <AlertDescription>
              <span>
                {isRtl
                  ? "لم يتم تغيير أي إعداد. حاولي التحديث مرة أخرى."
                  : "No settings were changed. Try loading the overview again."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => overviewQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                {isRtl ? "إعادة المحاولة" : "Try again"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {overview && (
          <section
            className="grid gap-5 lg:grid-cols-2"
            aria-label={isRtl ? "الميزات المتاحة" : "Available features"}
          >
            {viewModels.map(({ feature, view }) => {
              const visual = featureVisuals[feature.id];
              const FeatureIcon = visual.icon;
              const status = statusCopy(view.status, isRtl);
              const missingItems = view.readiness.filter(
                item => !item.complete
              ).length;
              const communitySafetyReady =
                feature.id !== "student-community" ||
                (overview.modules.studentCommunity.activeCompetitorTerms > 0 &&
                  overview.modules.studentCommunity
                    .activeProhibitedLanguageTerms > 0 &&
                  overview.modules.studentCommunity.openAiConfigured);
              const activationBlocked = !view.enabled && !communitySafetyReady;

              return (
                <Card
                  key={feature.id}
                  data-feature-id={feature.id}
                  className={`relative overflow-hidden border-slate-200 bg-gradient-to-br ${visual.accentClass} to-transparent shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 ${feature.id === "job-eligibility" ? "lg:col-span-2" : ""}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}
                        >
                          <FeatureIcon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-xl font-bold">
                            {localized(feature.title, isRtl)}
                          </h2>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={status.className}
                            >
                              {status.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-background/80 text-muted-foreground"
                            >
                              {feature.audience.includes("staff")
                                ? isRtl
                                  ? "للموظفين"
                                  : "Staff experience"
                                : isRtl
                                  ? "للطلاب"
                                  : "Student experience"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 sm:min-h-8"
                        variant={view.enabled ? "outline" : "default"}
                        disabled={
                          updateFeatureFlag.isPending || activationBlocked
                        }
                        onClick={() =>
                          requestFeatureChange(feature, !view.enabled)
                        }
                        aria-label={
                          activationBlocked
                            ? isRtl
                              ? "أكملي إعداد سلامة المجتمع قبل التفعيل"
                              : "Complete community safety setup before enabling"
                            : `${view.enabled ? (isRtl ? "إيقاف" : "Disable") : isRtl ? "تفعيل" : "Enable"} ${localized(feature.title, isRtl)}`
                        }
                        aria-describedby={
                          activationBlocked
                            ? "community-activation-requirement"
                            : undefined
                        }
                      >
                        <Power className="h-4 w-4" />
                        {activationBlocked
                          ? isRtl
                            ? "أكملي إعداد السلامة"
                            : "Complete safety setup"
                          : view.enabled
                            ? isRtl
                              ? "إيقاف"
                              : "Disable"
                            : isRtl
                              ? "تفعيل"
                              : "Enable"}
                      </Button>
                    </div>
                    <p className="pt-3 text-sm leading-6 text-muted-foreground">
                      {localized(feature.description, isRtl)}
                    </p>
                    {view.enabled && missingItems > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-bold">
                            {isRtl
                              ? "الميزة مفعّلة قبل اكتمال الإعداد"
                              : "Enabled before setup is complete"}
                          </p>
                          <p className="mt-0.5">
                            {isRtl
                              ? `${arabicRemainingRequirements(missingItems)} أدناه. أكملي الإعداد قبل تقديم الميزة كتجربة جاهزة.`
                              : `Complete the ${missingItems} remaining setup ${missingItems === 1 ? "step" : "steps"} below before presenting this feature as ready.`}
                          </p>
                        </div>
                      </div>
                    )}
                    {activationBlocked && (
                      <div
                        id="community-activation-requirement"
                        className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p>
                            {isRtl
                              ? "أكملي إعداد سلامة المجتمع أولاً: قواعد المحتوى وفحص المحتوى التلقائي. يمكنك تعيين المشرف بشكل منفصل."
                              : "Complete community safety setup first: content rules and automated content checks. Moderator assignment can be completed separately."}
                          </p>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="-ms-2 mt-1 min-h-11 px-2 py-2 text-xs font-bold text-amber-900 underline underline-offset-4 sm:min-h-8 dark:text-amber-200"
                            onClick={() =>
                              setLocation("/admin/community?setup=policy")
                            }
                          >
                            {isRtl
                              ? "فتح إعداد سلامة المجتمع"
                              : "Open community safety setup"}
                            <ArrowRight
                              className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`}
                            />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {view.metrics.map(metric => (
                        <div
                          key={metric.label}
                          className="rounded-lg border bg-background/75 px-2.5 py-2.5 text-center"
                        >
                          <p className="truncate text-lg font-bold">
                            {metric.value}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                            {metric.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border bg-background/70 p-3.5">
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Gauge className="h-4 w-4 text-emerald-600" />
                          {isRtl ? "جاهزية الإطلاق" : "Launch readiness"}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {missingItems === 0
                            ? isRtl
                              ? "مكتملة"
                              : "Complete"
                            : isRtl
                              ? arabicRemainingRequirements(missingItems)
                              : `${missingItems} remaining`}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {view.readiness.map(item => {
                          const itemContent = (
                            <>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}
                              >
                                {item.complete ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </span>
                              <span
                                className={`min-w-0 flex-1 text-start ${item.complete ? "text-muted-foreground" : "font-medium"}`}
                              >
                                {item.label}
                              </span>
                              {item.href && (
                                <span className="flex shrink-0 items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                  {item.actionLabel}
                                  <ArrowRight
                                    className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`}
                                  />
                                </span>
                              )}
                            </>
                          );

                          return (
                            <li key={item.label} className="text-xs">
                              {item.href ? (
                                <button
                                  type="button"
                                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:min-h-9"
                                  onClick={() => setLocation(item.href!)}
                                >
                                  {itemContent}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 px-1.5 py-1">
                                  {itemContent}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {feature.id === "student-surveys" && surveys && (
                      <div
                        className={`rounded-xl border p-3.5 ${surveys.blockingEnabled ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle
                                className={`h-4 w-4 ${surveys.blockingEnabled ? "text-red-600" : "text-amber-600"}`}
                              />
                              <p className="text-sm font-semibold">
                                {isRtl
                                  ? "حجب الوصول بسبب الاستبيان"
                                  : "Survey access blocking"}
                              </p>
                              <Badge
                                variant="outline"
                                className={
                                  surveys.blockingEnabled
                                    ? "border-red-200 bg-red-100 text-red-700"
                                    : "border-slate-200 bg-white text-slate-600"
                                }
                              >
                                {surveys.blockingEnabled
                                  ? isRtl
                                    ? "مفعّل"
                                    : "On"
                                  : isRtl
                                    ? "متوقف"
                                    : "Off"}
                              </Badge>
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                              {isRtl
                                ? "تحكم عالي التأثير. فعّليه فقط بعد نجاح تجربة محدودة ومراجعة الطلاب المتأثرين."
                                : "High-impact control. Turn it on only after a successful pilot and a review of affected students."}
                            </p>
                            <p
                              className={`mt-2 text-xs font-semibold ${blockingAffectedStudents > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
                            >
                              {isRtl
                                ? blockingAffectedStudents > 0
                                  ? `${blockingAffectedStudents} طالب سيتأثرون فوراً عند تفعيل هذا التحكم.`
                                  : "0 طلاب سيتأثرون فوراً — لا يوجد حجب فوري حالياً."
                                : blockingAffectedStudents > 0
                                  ? `${blockingAffectedStudents} student${blockingAffectedStudents === 1 ? "" : "s"} would be affected immediately if this control is enabled.`
                                  : "0 students would be affected immediately—there is no immediate gate."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11 sm:min-h-8"
                            variant="outline"
                            disabled={
                              updateFeatureFlag.isPending || !surveys.enabled
                            }
                            onClick={() =>
                              setPendingChange({
                                key: "student_surveys_blocking_enabled",
                                enabled: !surveys.blockingEnabled,
                                label: isRtl
                                  ? "حجب الوصول بسبب الاستبيان"
                                  : "Survey access blocking",
                                highImpact: true,
                                impactCount: blockingAffectedStudents,
                              })
                            }
                          >
                            {surveys.blockingEnabled
                              ? isRtl
                                ? "إيقاف الحجب"
                                : "Turn off"
                              : isRtl
                                ? "تفعيل الحجب"
                                : "Turn on"}
                          </Button>
                        </div>
                        {!surveys.enabled && (
                          <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                            {isRtl
                              ? "يجب تفعيل استبيانات الطلاب أولاً."
                              : "Enable Student Surveys first."}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid gap-2 [&>button]:min-h-11 sm:grid-cols-2 sm:[&>button]:min-h-9">
                      <Button
                        type="button"
                        onClick={() => setLocation(feature.adminPath)}
                      >
                        <Settings2 className="h-4 w-4" />
                        {isRtl ? "فتح الإدارة" : "Open admin"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLocation(feature.previewPath)}
                      >
                        <Eye className="h-4 w-4" />
                        {isRtl
                          ? feature.audience.includes("staff")
                            ? "معاينة الموظف"
                            : "معاينة الطالب"
                          : feature.audience.includes("staff")
                            ? "Staff preview"
                            : "Student preview"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLocation(`/admin/roles?feature=${feature.id}`)
                        }
                      >
                        <Users className="h-4 w-4" />
                        {isRtl ? "إدارة الوصول" : "Manage access"}
                        {view.managerCount === 0 && (
                          <span
                            className="h-2 w-2 rounded-full bg-amber-500"
                            aria-hidden="true"
                          />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLocation(`/admin/email-logs?feature=${feature.id}`)
                        }
                      >
                        <MailCheck className="h-4 w-4" />
                        {isRtl ? "سجل التسليم" : "Delivery logs"}
                      </Button>
                      {feature.audience.includes("students") && (
                        <Button
                          type="button"
                          variant="outline"
                          className="sm:col-span-2"
                          onClick={() =>
                            setLocation(
                              `/admin/notifications?feature=${feature.id}`
                            )
                          }
                        >
                          <BellRing className="h-4 w-4" />
                          {isRtl
                            ? "تجهيز رسالة للطلاب ومعاينتها"
                            : "Prepare and preview student message"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {overview && (
          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <MailCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {isRtl ? "الوصول إلى سجل البريد" : "Email log access"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRtl
                      ? `${overview.operations.emailLogViewers} موظفين لديهم صلاحية مراجعة السجل`
                      : `${overview.operations.emailLogViewers} staff member${overview.operations.emailLogViewers === 1 ? "" : "s"} can review delivery logs`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
                  onClick={() => setLocation("/admin/roles?feature=email-logs")}
                  aria-label={
                    isRtl
                      ? "إدارة صلاحية سجل البريد"
                      : "Manage email log access"
                  }
                >
                  <ArrowRight
                    className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                  />
                </Button>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <BellRing className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {isRtl
                      ? "مستلمو إشعارات الإدارة"
                      : "Admin notification recipients"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRtl
                      ? `${overview.operations.notificationRecipients} عناوين بريد مضبوطة`
                      : `${overview.operations.notificationRecipients} email recipient${overview.operations.notificationRecipients === 1 ? "" : "s"} configured`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
                  onClick={() => setLocation("/admin/settings")}
                  aria-label={
                    isRtl
                      ? "فتح إعدادات مستلمي الإشعارات"
                      : "Open notification recipient settings"
                  }
                >
                  <ArrowRight
                    className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
                  />
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {isRtl
            ? "تغيير حالة أي ميزة يتطلب تأكيداً ويُسجّل في سجل تدقيق الإدارة. إيقاف الميزة لا يحذف بياناتها."
            : "Every feature-state change requires confirmation and is recorded in the admin audit trail. Disabling a feature never deletes its data."}
        </p>

        <AlertDialog
          open={Boolean(pendingChange)}
          onOpenChange={open =>
            !open && !updateFeatureFlag.isPending && setPendingChange(null)
          }
        >
          <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingChange?.highImpact && pendingChange.enabled
                  ? isRtl
                    ? "تأكيد تشغيل الحجب عالي التأثير"
                    : "Confirm high-impact blocking"
                  : pendingChange?.enabled
                    ? isRtl
                      ? "تأكيد تفعيل الميزة"
                      : "Confirm feature activation"
                    : isRtl
                      ? "تأكيد إيقاف الميزة"
                      : "Confirm feature deactivation"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  {pendingChange?.highImpact && pendingChange.enabled
                    ? isRtl
                      ? `سيتم تشغيل «${pendingChange.label}». قد يتعذر على الطلاب المتأثرين متابعة استخدام المنصة حتى يجيبوا عن الاستبيان.`
                      : `“${pendingChange.label}” will be turned on. Affected students may be unable to continue until they answer their survey.`
                    : pendingChange?.enabled
                      ? isRtl
                        ? `ستصبح «${pendingChange.label ?? ""}» متاحة للمستخدمين المخولين. ابدئي بعينة تجريبية صغيرة.`
                        : `“${pendingChange.label ?? ""}” will become available to authorized users. Start with a small pilot.`
                      : isRtl
                        ? `سيتم إخفاء «${pendingChange?.label ?? ""}» عن المستخدمين. البيانات الحالية لن تُحذف.`
                        : `“${pendingChange?.label ?? ""}” will be hidden from users. Existing data will not be deleted.`}
                </span>
                {pendingChange?.highImpact && (
                  <span
                    className={`block rounded-md px-3 py-2 text-xs font-semibold ${pendingChange.enabled && (pendingChange.impactCount ?? 0) > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}
                  >
                    {pendingChange.enabled
                      ? isRtl
                        ? (pendingChange.impactCount ?? 0) > 0
                          ? `${pendingChange.impactCount ?? 0} طالب سيتأثرون فوراً عند تأكيد التفعيل.`
                          : "0 طلاب سيتأثرون فوراً — لا يوجد حجب فوري حالياً."
                        : (pendingChange.impactCount ?? 0) > 0
                          ? `${pendingChange.impactCount ?? 0} student${pendingChange.impactCount === 1 ? "" : "s"} would be affected immediately when you confirm.`
                          : "0 students would be affected immediately—there is no immediate gate."
                      : isRtl
                        ? `${pendingChange.impactCount ?? 0} طالب ضمن مجموعة التأثير الفوري حالياً؛ إيقاف التحكم يزيل الحجب العام.`
                        : `${pendingChange.impactCount ?? 0} student${pendingChange.impactCount === 1 ? "" : "s"} are currently in the immediate-impact group; turning this off removes the global gate.`}
                  </span>
                )}
                <span className="block text-xs">
                  {isRtl
                    ? "سيتم تسجيل هذا التغيير في سجل تدقيق الإدارة."
                    : "This change will be recorded in the admin audit trail."}
                </span>
                {pendingChange?.key === "student_surveys_enabled" &&
                  !pendingChange.enabled && (
                    <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
                      {isRtl
                        ? "سيتم أيضاً إيقاف حجب الوصول المرتبط بالاستبيانات."
                        : "Survey access blocking will also be turned off."}
                    </span>
                  )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updateFeatureFlag.isPending}>
                {isRtl ? "إلغاء" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!pendingChange || updateFeatureFlag.isPending}
                className={
                  pendingChange?.highImpact && pendingChange.enabled
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : ""
                }
                onClick={event => {
                  event.preventDefault();
                  if (pendingChange) {
                    updateFeatureFlag.mutate({
                      key: pendingChange.key,
                      enabled: pendingChange.enabled,
                    });
                  }
                }}
              >
                {updateFeatureFlag.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isRtl ? "تأكيد" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(pendingLivePackageChange)}
          onOpenChange={open =>
            !open &&
            !updateLivePackage.isPending &&
            setPendingLivePackageChange(null)
          }
        >
          <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingLivePackageChange?.control === "visibility"
                  ? pendingLivePackageChange.enabled
                    ? isRtl
                      ? "تأكيد إظهار بكج لايف"
                      : "Confirm website visibility"
                    : isRtl
                      ? "تأكيد إخفاء بكج لايف"
                      : "Confirm hiding Live Package"
                  : pendingLivePackageChange?.enabled
                    ? isRtl
                      ? "تأكيد فتح الشراء"
                      : "Confirm opening purchases"
                    : isRtl
                      ? "تأكيد إغلاق الشراء"
                      : "Confirm closing purchases"}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  {pendingLivePackageChange?.control === "visibility"
                    ? pendingLivePackageChange.enabled
                      ? isRtl
                        ? "سيظهر البكج على الموقع بحالة «قريباً». لن يُفتح الشراء إلا بقرار مستقل منك."
                        : "The package will appear on the website as Coming Soon. Purchasing stays closed until you open it separately."
                      : isRtl
                        ? "سيُخفى البكج من الموقع ويُغلق الشراء تلقائياً للحماية. لن تُحذف البيانات أو الاستحقاقات الحالية."
                        : "The package will be hidden and purchasing will automatically close for safety. Existing data and entitlements will not be deleted."
                    : pendingLivePackageChange?.enabled
                      ? isRtl
                        ? "سيظهر البكج ويُفتح الشراء خلال فترة المبيعات فقط، بعد اكتمال الجاهزية."
                        : "The package will be shown and checkout will open only within the configured sales window after readiness checks pass."
                      : isRtl
                        ? "سيبقى البكج ظاهراً بحالة «قريباً»، لكن لن يقبل طلبات شراء جديدة."
                        : "The package will remain visible as Coming Soon, but it will stop accepting new purchase requests."}
                </span>
                <span className="block text-xs">
                  {isRtl
                    ? "سيُسجّل هذا القرار في سجل تدقيق الإدارة."
                    : "This decision will be recorded in the admin audit trail."}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updateLivePackage.isPending}>
                {isRtl ? "إلغاء" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={
                  !pendingLivePackageChange || updateLivePackage.isPending
                }
                className={
                  pendingLivePackageChange?.enabled
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "bg-red-600 text-white hover:bg-red-700"
                }
                onClick={event => {
                  event.preventDefault();
                  if (!pendingLivePackageChange || !livePackage) return;
                  const changesVisibility =
                    pendingLivePackageChange.control === "visibility";
                  // Hiding is fail-closed: it also disables checkout. Closing
                  // checkout alone intentionally preserves Coming Soon visibility.
                  const adminVisible = changesVisibility
                    ? pendingLivePackageChange.enabled
                    : pendingLivePackageChange.enabled
                      ? true
                      : livePackage.config.adminVisible;
                  const purchaseApproved = changesVisibility
                    ? pendingLivePackageChange.enabled
                      ? livePackage.config.purchaseApproved
                      : false
                    : pendingLivePackageChange.enabled;
                  updateLivePackage.mutate({
                    adminVisible,
                    purchaseApproved,
                    lifecycle: purchaseApproved ? "active" : "coming_soon",
                    cohortKey: livePackage.config.cohortKey,
                    salesStartsAt: livePackage.config.salesStartsAt,
                    salesEndsAt: livePackage.config.salesEndsAt,
                    sessionStartsAt: livePackage.config.sessionStartsAt,
                    sessionEndsAt: livePackage.config.sessionEndsAt,
                    recordingPolicy: livePackage.config.recordingPolicy,
                    recordingAccessEndsAt:
                      livePackage.config.recordingAccessEndsAt,
                  });
                }}
              >
                {updateLivePackage.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isRtl ? "تأكيد" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </DashboardLayout>
  );
}
