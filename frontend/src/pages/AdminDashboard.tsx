import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, BookOpen, GraduationCap, TrendingUp, Key, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

function formatSafeDistanceToNow(value: string | number | Date | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentEnrollments, isLoading: enrollmentsLoading } = trpc.dashboard.recentEnrollments.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
          <p className="text-muted-foreground">{t('admin.dashboard.welcome')}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/admin/keys")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{t('admin.dashboard.keys')}</CardTitle>
              <Key className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.dashboard.keysDesc')}
              </p>
              <Button className="w-full" variant="default">
                {t('admin.dashboard.manageKeys')}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/admin/courses")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{t('admin.dashboard.courses')}</CardTitle>
              <Library className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.dashboard.coursesDesc')}
              </p>
              <Button className="w-full" variant="default">
                {t('admin.dashboard.viewCourses')}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation("/admin/users")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{t('admin.dashboard.users')}</CardTitle>
              <Users className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.dashboard.usersDesc')}
              </p>
              <Button className="w-full" variant="default">
                {t('admin.dashboard.viewUsers')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
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
              <BookOpen className="h-4 w-4 text-muted-foreground" />
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
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.totalEnrollments || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.dashboard.activeSubs')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.activeEnrollments || 0}
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
                        {item.course?.titleEn || "Unknown Course"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.enrollment.paymentStatus}</p>
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
