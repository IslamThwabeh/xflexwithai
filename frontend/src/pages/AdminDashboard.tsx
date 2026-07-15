import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users,
  Key,
  Library,
  ShoppingCart,
  AlertCircle,
  ListTodo,
  ClipboardCheck,
  Award,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { arEG } from "date-fns/locale";
import { getStaffLandingPage } from "@shared/const";
import { useEffect } from "react";

function formatSafeDistanceToNow(value: string | number | Date | null | undefined, isRtl: boolean) {
  if (!value) return isRtl ? "غير متاح" : "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isRtl ? "غير متاح" : "N/A";
  return formatDistanceToNow(date, { addSuffix: true, locale: isRtl ? arEG : undefined });
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  // Staff users cannot view the admin dashboard — redirect to their landing page
  const { data: adminCheck, isLoading: adminCheckLoading } = trpc.auth.isAdmin.useQuery();
  useEffect(() => {
    if (adminCheckLoading || !adminCheck) return;
    if (adminCheck.isStaff && !adminCheck.isAdmin) {
      const landing = getStaffLandingPage(adminCheck.staffRoles ?? []);
      setLocation(landing);
    }
  }, [adminCheck, adminCheckLoading, setLocation]);

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentEnrollments, isLoading: enrollmentsLoading } = trpc.dashboard.recentEnrollments.useQuery();
  const { data: taskCounts, isLoading: taskCountsLoading, refetch: refetchTaskCounts } = trpc.staffNotifications.countByRoute.useQuery();
  const markTaskRouteRead = trpc.staffNotifications.markReadByRoute.useMutation({
    onSuccess: () => refetchTaskCounts(),
  });
  const { data: performanceAvailability } = trpc.staffPerformance.availability.useQuery(undefined, { retry: false });
  const { data: surveyAvailability } = trpc.studentSurveys.availability.useQuery(undefined, { retry: false });
  const { data: communityAvailability } = trpc.community.availability.useQuery(undefined, { retry: false });
  const { data: rewardsAvailability } = trpc.points.rewardsAvailability.useQuery(undefined, { retry: false });
  const { data: jobEligibilityAvailability } = trpc.studentJobEligibility.availability.useQuery(undefined, { retry: false });

  const adminTasks = [
    {
      path: "/admin/orders",
      labelEn: "Orders awaiting review",
      labelAr: "طلبات بانتظار المراجعة",
      count: stats?.pendingOrders ?? 0,
      enabled: true,
      icon: ShoppingCart,
      iconClass: "bg-amber-100 text-amber-700",
      notificationBacked: false,
    },
    {
      path: "/admin/staff-performance",
      labelEn: "Staff daily work submissions",
      labelAr: "تسليمات العمل اليومي للموظفين",
      count: taskCounts?.["/admin/staff-performance"] ?? 0,
      enabled: performanceAvailability?.enabled === true,
      icon: ClipboardCheck,
      iconClass: "bg-violet-100 text-violet-700",
      notificationBacked: true,
    },
    {
      path: "/admin/student-surveys",
      labelEn: "Student survey responses",
      labelAr: "ردود استبيانات الطلاب",
      count: taskCounts?.["/admin/student-surveys"] ?? 0,
      enabled: surveyAvailability?.enabled === true,
      icon: ListTodo,
      iconClass: "bg-indigo-100 text-indigo-700",
      notificationBacked: true,
    },
    {
      path: "/admin/community",
      labelEn: "Community moderation reports",
      labelAr: "بلاغات الإشراف على المجتمع",
      count: taskCounts?.["/admin/community"] ?? 0,
      enabled: communityAvailability?.enabled === true,
      icon: MessageSquare,
      iconClass: "bg-purple-100 text-purple-700",
      notificationBacked: true,
    },
    {
      path: "/admin/points",
      labelEn: "Loyalty reward requests",
      labelAr: "طلبات مكافآت الولاء",
      count: taskCounts?.["/admin/points"] ?? 0,
      enabled: rewardsAvailability?.enabled === true,
      icon: Award,
      iconClass: "bg-yellow-100 text-yellow-700",
      notificationBacked: true,
    },
    {
      path: "/admin/job-eligibility",
      labelEn: "Job eligibility reviews",
      labelAr: "مراجعات الأهلية للوظائف",
      count: taskCounts?.["/admin/job-eligibility"] ?? 0,
      enabled: jobEligibilityAvailability?.enabled === true,
      icon: Briefcase,
      iconClass: "bg-blue-100 text-blue-700",
      notificationBacked: true,
    },
  ];

  const openAdminTask = (task: typeof adminTasks[number]) => {
    if (!task.enabled) return;
    if (task.notificationBacked && task.count > 0) {
      markTaskRouteRead.mutate({ actionUrl: task.path });
    }
    setLocation(task.path);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
          <p className="text-muted-foreground">{t('admin.dashboard.welcome')}</p>
        </div>

        {/* Attention Banner — pending orders */}
        {!statsLoading && (stats?.pendingOrders ?? 0) > 0 && (
          <Card
            className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/admin/orders")}
          >
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  {isRtl
                    ? `${stats?.pendingOrders} طلبات بانتظار المراجعة`
                    : `${stats?.pendingOrders} order${(stats?.pendingOrders ?? 0) > 1 ? 's' : ''} pending review`}
                </p>
                <p className="text-xs text-amber-600">
                  {isRtl ? 'اضغط للمراجعة' : 'Click to review'}
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                {isRtl ? 'مراجعة' : 'Review'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Consolidated admin task list — always visible, including disabled features */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListTodo className="h-5 w-5 text-emerald-600" />
              {isRtl ? "المهام التي تتطلب إجراء" : "Tasks requiring action"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isRtl
                ? "قائمة موحدة بجميع الأعمال الجديدة والمعلقة في لوحة الإدارة"
                : "One place for new and pending work across the admin panel"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {adminTasks.map((task) => {
                const TaskIcon = task.icon;
                const isLoading = task.notificationBacked ? taskCountsLoading : statsLoading;
                return (
                  <button
                    key={task.path}
                    type="button"
                    onClick={() => openAdminTask(task)}
                    disabled={!task.enabled}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-start transition-all ${
                      task.enabled
                        ? "bg-white hover:border-emerald-300 hover:shadow-sm cursor-pointer"
                        : "bg-muted/40 opacity-65 cursor-not-allowed"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${task.iconClass}`}>
                      <TaskIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {isRtl ? task.labelAr : task.labelEn}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {!task.enabled
                          ? (isRtl ? "الميزة غير مفعلة" : "Feature disabled")
                          : isLoading
                            ? (isRtl ? "جارٍ التحميل..." : "Loading...")
                            : task.count > 0
                              ? (isRtl ? `${task.count} مهمة جديدة` : `${task.count} new task${task.count === 1 ? "" : "s"}`)
                              : (isRtl ? "لا توجد مهام جديدة" : "No new tasks")}
                      </span>
                    </span>
                    {task.enabled && !isLoading && (
                      task.count > 0
                        ? <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">{task.count > 99 ? "99+" : task.count}</span>
                        : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    )}
                    {!task.enabled && <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions — compact 4-column grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation("/admin/orders")}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{isRtl ? 'الطلبات' : 'Orders'}</p>
                <p className="text-xs text-muted-foreground truncate">{isRtl ? 'مراجعة وإدارة' : 'Review & manage'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation("/admin/package-keys")}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-teal-50 group-hover:bg-teal-100 transition-colors">
                <Key className="h-5 w-5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t('admin.dashboard.keys')}</p>
                <p className="text-xs text-muted-foreground truncate">{isRtl ? 'إنشاء وتتبع' : 'Generate & track'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation("/admin/courses")}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                <Library className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t('admin.dashboard.courses')}</p>
                <p className="text-xs text-muted-foreground truncate">{isRtl ? 'الدورات والحلقات' : 'Courses & episodes'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation("/admin/users")}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t('admin.dashboard.users')}</p>
                <p className="text-xs text-muted-foreground truncate">{isRtl ? 'إدارة المستخدمين' : 'Manage students'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics — compact grid */}
        <div className="grid gap-2 grid-cols-3 lg:grid-cols-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-green-700">
              {statsLoading
                ? "..."
                : formatAdminCurrencyFromIls(stats?.totalRevenueIls || 0, language, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
            </p>
            <p className="text-[11px] text-green-700 leading-tight">{t('admin.totalRevenue')}</p>
          </div>

          <div className="border rounded-lg px-3 py-2 text-center bg-white">
            <p className="text-lg font-bold">
              {statsLoading ? "..." : stats?.totalKeySales || 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{isRtl ? 'إجمالي مفاتيح الباقات' : 'Package Keys (Total)'}</p>
            {!statsLoading && (
              <p className="text-[10px] text-gray-400 leading-tight">
                {isRtl
                  ? `${stats?.activatedPackageKeys || 0} مفعّل`
                  : `${stats?.activatedPackageKeys || 0} activated`}
              </p>
            )}
          </div>

          <div className="border rounded-lg px-3 py-2 text-center bg-white">
            <p className="text-lg font-bold text-amber-600">
              {statsLoading ? "..." : stats?.pendingOrders || 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{isRtl ? 'طلبات معلقة' : 'Pending'}</p>
          </div>

          <div className="border rounded-lg px-3 py-2 text-center bg-white">
            <p className="text-lg font-bold">
              {statsLoading ? "..." : stats?.totalUsers || 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.totalUsers')}</p>
          </div>

          <div className="border rounded-lg px-3 py-2 text-center bg-white">
            <p className="text-lg font-bold">
              {statsLoading ? "..." : stats?.totalCourses || 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.totalCourses')}</p>
          </div>

          <div className="border rounded-lg px-3 py-2 text-center bg-white">
            <p className="text-lg font-bold">
              {statsLoading ? "..." : stats?.totalEnrollments || 0}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.totalEnrollments')}</p>
          </div>
        </div>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.dashboard.recentEnrollments')}</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollmentsLoading ? (
              <p className="text-muted-foreground">{t('admin.loading')}</p>
            ) : !recentEnrollments || recentEnrollments.length === 0 ? (
              <p className="text-muted-foreground">{t('admin.dashboard.noEnrollments')}</p>
            ) : (
              <div className="space-y-4">
                {recentEnrollments.map((item) => (
                  <div key={item.enrollment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="font-medium">{item.user?.name || (isRtl ? 'مستخدم غير معروف' : 'Unknown User')}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRtl ? (item.course?.titleAr || item.course?.titleEn || 'دورة غير معروفة') : (item.course?.titleEn || item.course?.titleAr || 'Unknown Course')}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">{item.enrollment.progressPercentage || 0}%</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.enrollment.isSubscriptionActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.enrollment.isSubscriptionActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                          {formatSafeDistanceToNow(item.enrollment.enrolledAt, isRtl)}
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
