import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { BookOpen, Clock, Award, Settings, LogOut, Zap, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Fetch user enrollments
  const { data: enrollments = [], isLoading: enrollmentsLoading } = trpc.users.getUserEnrollments.useQuery();

  // Fetch user statistics
  const { data: stats } = trpc.users.getUserStats.useQuery();

  // Deferred activation status
  const { data: activationStatus } = trpc.subscriptions.activationStatus.useQuery();

  const activateNowMutation = trpc.subscriptions.activateNow.useMutation({
    onSuccess: () => {
      toast.success(t('activation.activated'));
      utils.subscriptions.activationStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const displayName = user?.name || user?.email || "Student";
  const welcomeTitle = t("dashboard.title").replace("{name}", displayName);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {welcomeTitle}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/profile">
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  {t("dashboard.settings")}
                </Button>
              </Link>
              <Button variant="destructive" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                {t("dashboard.logout")}
              </Button>
            </div>
          </div>

          {/* Deferred Activation Banner */}
          {activationStatus?.hasPending && (
            <Card className={`mb-8 border-2 ${activationStatus.canActivate ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : 'border-blue-300 bg-blue-50 dark:bg-blue-950/20'}`}>
              <CardContent className="py-4 px-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Zap className={`h-8 w-8 shrink-0 ${activationStatus.canActivate ? 'text-yellow-500' : 'text-blue-500'}`} />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t('activation.bannerTitle')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {activationStatus.canActivate
                        ? t('activation.bannerDescReady').replace('{progress}', String(activationStatus.progressPercent ?? 0))
                        : t('activation.bannerDescPending').replace('{progress}', String(activationStatus.progressPercent ?? 0))}
                    </p>
                    {activationStatus.canActivate && activationStatus.maxActivationDate && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t('activation.maxDateWarning').replace(
                          '{date}',
                          new Date(activationStatus.maxActivationDate).toLocaleDateString()
                        )}
                      </p>
                    )}
                    {!activationStatus.canActivate && (
                      <Progress value={activationStatus.progressPercent ?? 0} className="h-2 mt-2" />
                    )}
                  </div>
                  {activationStatus.canActivate && (
                    <Button
                      className="shrink-0 gap-2"
                      onClick={() => activateNowMutation.mutate()}
                      disabled={activateNowMutation.isPending}
                    >
                      <Zap className="h-4 w-4" />
                      {activateNowMutation.isPending ? t('activation.activating') : t('activation.startNow')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {t("dashboard.stats.enrolledCourses")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.enrolledCoursesCount ?? 0}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("dashboard.stats.courses")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {t("dashboard.stats.completedCourses")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats?.completedCoursesCount ?? 0}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("dashboard.stats.finished")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {t("dashboard.stats.quizzesPassed")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats?.quizzesPassed ?? 0}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("dashboard.stats.levels")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Enrolled Courses Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {t("dashboard.enrolledCourses.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.enrolledCourses.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enrollmentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-muted-foreground">{t("dashboard.loading")}</p>
                </div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {t("dashboard.noCoursesEnrolled")}
                  </p>
                  <Link href="/courses">
                    <Button className="gap-2">
                      <BookOpen className="w-4 h-4" />
                      {t("dashboard.browseCourses")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {enrollment.courseName}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {enrollment.progressPercentage}% {t("dashboard.completed")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            {enrollment.completedEpisodes}/{enrollment.totalEpisodes} {t("dashboard.episodes")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/course/${enrollment.courseId}`}>
                          <Button size="sm" variant="outline">
                            {enrollment.progressPercentage === 100
                              ? t("dashboard.review")
                              : t("dashboard.continue")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.quickActions.browseMore")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {t("dashboard.quickActions.discoverNewCourses")}
                </p>
                <Link href="/courses">
                  <Button className="w-full">{t("dashboard.quickActions.browseCourses")}</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.quickActions.aiAssistant")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {t("dashboard.quickActions.getAIHelp")}
                </p>
                <Link href="/lexai">
                  <Button className="w-full variant-outline">{t("dashboard.quickActions.openChat")}</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
