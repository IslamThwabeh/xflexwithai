import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import AdminCashSummary from "@/components/admin/AdminCashSummary";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users,
  Key,
  Library,
  ShoppingCart,
  ListTodo,
  ClipboardCheck,
  Award,
  MessageSquare,
  Briefcase,
  RefreshCw,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { arEG } from "date-fns/locale";
import { getStaffLandingPage } from "@shared/const";
import { OUTSTANDING_ORDERS_PATH } from "@shared/orderReview";

function formatSafeDistanceToNow(
  value: string | number | Date | null | undefined,
  ar: boolean
) {
  if (!value) return ar ? "غير متاح" : "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ar ? "غير متاح" : "N/A";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: ar ? arEG : undefined,
  });
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const ar = language === "ar";
  const { data: adminCheck, isLoading: adminCheckLoading } =
    trpc.auth.isAdmin.useQuery();
  useEffect(() => {
    if (!adminCheckLoading && adminCheck?.isStaff && !adminCheck.isAdmin)
      setLocation(getStaffLandingPage(adminCheck.staffRoles ?? []));
  }, [adminCheck, adminCheckLoading, setLocation]);
  const enabled = adminCheck?.isAdmin === true;
  const statsQuery = trpc.dashboard.stats.useQuery(undefined, { enabled });
  const enrollmentsQuery = trpc.dashboard.recentEnrollments.useQuery(
    undefined,
    { enabled }
  );
  const tasksQuery = trpc.staffNotifications.countByRoute.useQuery(undefined, {
    enabled,
  });
  const featureQuery = trpc.adminSettings.featureOverview.useQuery(undefined, {
    enabled,
    retry: false,
  });
  const markTaskRouteRead = trpc.staffNotifications.markReadByRoute.useMutation(
    { onSuccess: () => tasksQuery.refetch() }
  );
  const stats = statsQuery.data;
  const modules = featureQuery.data?.modules;
  const featureUnavailable = featureQuery.isError;
  const tasks = [
    {
      path: OUTSTANDING_ORDERS_PATH,
      en: "Orders awaiting review",
      ar: "طلبات بانتظار المراجعة",
      count: stats?.pendingOrders,
      loading: statsQuery.isPending,
      error: statsQuery.isError,
      visible: true,
      icon: ShoppingCart,
      unread: false,
    },
    {
      path: "/admin/staff-performance",
      en: "Staff daily work submissions",
      ar: "تسليمات العمل اليومي للموظفين",
      count: tasksQuery.data?.["/admin/staff-performance"],
      visible: modules?.staffPerformance.enabled,
      icon: ClipboardCheck,
      unread: true,
    },
    {
      path: "/admin/student-surveys",
      en: "Student survey responses",
      ar: "ردود استبيانات الطلاب",
      count: tasksQuery.data?.["/admin/student-surveys"],
      visible: modules?.studentSurveys.enabled,
      icon: ListTodo,
      unread: true,
    },
    {
      path: "/admin/community",
      en: "Community moderation reports",
      ar: "بلاغات الإشراف على المجتمع",
      count: tasksQuery.data?.["/admin/community"],
      visible: modules?.studentCommunity.enabled,
      icon: MessageSquare,
      unread: true,
    },
    {
      path: "/admin/points",
      en: "Loyalty reward requests",
      ar: "طلبات مكافآت الولاء",
      count: tasksQuery.data?.["/admin/points"],
      visible: modules?.loyaltyRewards.enabled,
      icon: Award,
      unread: true,
    },
    {
      path: "/admin/job-eligibility",
      en: "Job eligibility reviews",
      ar: "مراجعات الأهلية للوظائف",
      count: tasksQuery.data?.["/admin/job-eligibility"],
      visible: modules?.studentJobEligibility.enabled,
      icon: Briefcase,
      unread: true,
    },
  ]
    .filter(
      task =>
        task.visible ||
        (task.unread && (featureUnavailable || featureQuery.isPending))
    )
    .map(task => ({
      ...task,
      loading: task.unread ? tasksQuery.isPending : task.loading,
      error: task.unread ? tasksQuery.isError : task.error,
      count: task.count ?? 0,
    }));
  const attention = tasks.filter(
    task => task.loading || task.error || task.count > 0
  );
  const quiet = tasks.filter(
    task => !task.loading && !task.error && task.count === 0
  );
  const taskButton = (task: (typeof tasks)[number]) => {
    const Icon = task.icon;
    return (
      <button
        key={task.path}
        type="button"
        onClick={() => {
          if (task.unread && task.count > 0)
            markTaskRouteRead.mutate({ actionUrl: task.path });
          setLocation(task.path);
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-white p-3 text-start hover:border-emerald-400 dark:bg-background"
      >
        <Icon className="h-5 w-5 shrink-0 text-emerald-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {ar ? task.ar : task.en}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {task.loading
              ? ar
                ? "جارٍ التحميل…"
                : "Loading…"
              : task.error
                ? ar
                  ? "العدد غير متاح؛ افتح الصفحة أو أعد المحاولة"
                  : "Count unavailable; open the page or retry"
                : task.unread
                  ? ar
                    ? `${task.count} إشعار غير مقروء`
                    : `${task.count} unread notification${task.count === 1 ? "" : "s"}`
                  : ar
                    ? "طلبات غير محسومة، وقد تشمل طلبات سابقة"
                    : "Unresolved requests, including older orders"}
          </span>
        </span>
        {!task.loading && !task.error && task.count > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900">
            {task.count}
          </span>
        )}
      </button>
    );
  };
  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("admin.dashboard")}</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/settings">
              <Settings className="me-2 h-4 w-4" />
              {ar ? "الإعدادات" : "Settings"}
            </Link>
          </Button>
        </div>
        <AdminCashSummary />
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {ar ? "بحاجة إلى متابعة" : "Needs attention"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={statsQuery.isFetching || tasksQuery.isFetching}
                onClick={() => {
                  void statsQuery.refetch();
                  void tasksQuery.refetch();
                  void featureQuery.refetch();
                }}
              >
                <RefreshCw className="me-2 h-4 w-4" />
                {ar ? "تحديث" : "Refresh"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "الطلبات غير المحسومة منفصلة عن الإشعارات غير المقروءة."
                : "Outstanding orders and unread notifications are counted separately."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {attention.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {attention.map(taskButton)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "لا توجد طلبات غير محسومة أو إشعارات غير مقروءة في الملخص الحالي."
                  : "No outstanding orders or unread notifications in this snapshot."}
              </p>
            )}
            {featureUnavailable && (
              <p role="status" className="text-sm text-amber-800">
                {ar
                  ? "تعذّر تحديث حالة مساحات العمل. الاختصارات متاحة للمراجعة."
                  : "Workspace availability could not be refreshed. Shortcuts remain available for review."}
              </p>
            )}
            {quiet.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm text-slate-600">
                  {ar ? "بقية مساحات العمل" : "Other workspaces"}
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {quiet.map(taskButton)}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
        <nav
          aria-label={ar ? "اختصارات الإدارة" : "Admin shortcuts"}
          className="flex flex-wrap gap-2"
        >
          {[
            {
              path: "/admin/orders",
              en: "All orders",
              ar: "كل الطلبات",
              icon: ShoppingCart,
            },
            {
              path: "/admin/package-keys",
              en: "Package keys",
              ar: "مفاتيح الباقات",
              icon: Key,
            },
            {
              path: "/admin/courses",
              en: "Courses",
              ar: "الدورات",
              icon: Library,
            },
            {
              path: "/admin/users",
              en: "Customer accounts",
              ar: "حسابات العملاء",
              icon: Users,
            },
          ].map(item => (
            <Button key={item.path} variant="outline" size="sm" asChild>
              <Link href={item.path}>
                <item.icon className="me-2 h-4 w-4" />
                {ar ? item.ar : item.en}
              </Link>
            </Button>
          ))}
        </nav>
        {statsQuery.isError ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 p-4 text-sm text-amber-900"
          >
            {ar
              ? "تعذّر تحميل الإحصائيات. استخدم تحديث للمحاولة مجدداً."
              : "Statistics could not be loaded. Use Refresh to retry."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                ar ? "مفاتيح الباقات — الإجمالي" : "Package keys — total",
                stats?.totalKeySales,
              ],
              [t("admin.totalUsers"), stats?.totalUsers],
              [t("admin.totalCourses"), stats?.totalCourses],
              [t("admin.totalEnrollments"), stats?.totalEnrollments],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border bg-white p-3 text-center dark:bg-background"
              >
                <p className="text-xl font-bold">
                  {statsQuery.isPending ? "…" : value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {t("admin.dashboard.recentEnrollments")}
            </h2>
          </CardHeader>
          <CardContent>
            {enrollmentsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.loading")}
              </p>
            ) : enrollmentsQuery.isError ? (
              <div role="alert" className="text-sm text-amber-900">
                {ar
                  ? "تعذّر تحميل التسجيلات."
                  : "Enrollments could not be loaded."}
                <Button
                  variant="link"
                  onClick={() => void enrollmentsQuery.refetch()}
                >
                  {ar ? "إعادة المحاولة" : "Retry"}
                </Button>
              </div>
            ) : !enrollmentsQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.dashboard.noEnrollments")}
              </p>
            ) : (
              <div className="divide-y">
                {enrollmentsQuery.data.map(item => (
                  <div
                    key={item.enrollment.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.user?.name ||
                          (ar ? "مستخدم غير معروف" : "Unknown user")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ar
                          ? item.course?.titleAr || item.course?.titleEn
                          : item.course?.titleEn || item.course?.titleAr}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.enrollment.progressPercentage || 0}% ·{" "}
                      {item.enrollment.isSubscriptionActive
                        ? ar
                          ? "نشط"
                          : "Active"
                        : ar
                          ? "غير نشط"
                          : "Inactive"}
                      <p className="mt-1">
                        {formatSafeDistanceToNow(
                          item.enrollment.enrolledAt,
                          ar
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
