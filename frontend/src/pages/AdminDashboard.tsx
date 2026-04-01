import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, BookOpen, GraduationCap, TrendingUp, Key, Library, ShoppingCart, DollarSign, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { getStaffLandingPage } from "@shared/const";
import { useEffect } from "react";

function formatSafeDistanceToNow(value: string | number | Date | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return formatDistanceToNow(date, { addSuffix: true });
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

        {/* Statistics — flat grid, no sub-headers */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">{t('admin.totalRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 shrink-0 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                ${statsLoading ? "..." : (stats?.totalRevenue || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isRtl ? 'مفاتيح مُفعّلة' : 'Keys Sold'}</CardTitle>
              <Key className="h-4 w-4 shrink-0 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.totalKeySales || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isRtl ? 'طلبات معلقة' : 'Pending Orders'}</CardTitle>
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {statsLoading ? "..." : stats?.pendingOrders || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.totalUsers || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalCourses')}</CardTitle>
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.totalCourses || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalEnrollments')}</CardTitle>
              <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.totalEnrollments || 0}
              </div>
            </CardContent>
          </Card>
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
                      <p className="font-medium">{item.user?.name || "Unknown User"}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRtl ? (item.course?.titleAr || item.course?.titleEn) : item.course?.titleEn || "Unknown Course"}
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
                        {formatSafeDistanceToNow(item.enrollment.enrolledAt)}
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
