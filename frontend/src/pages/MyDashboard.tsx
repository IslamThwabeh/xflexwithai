import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, Play, CheckCircle2, Clock, Calendar, Gift, MessageSquareQuote, Newspaper } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import ClientLayout from "@/components/ClientLayout";

function formatSafeDate(
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "N/A"
) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, pattern);
}

export default function MyDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { t, isRTL } = useLanguage();
  const utils = trpc.useUtils();
  const didSyncRef = useRef(false);

  const syncEntitlements = trpc.users.syncEntitlements.useMutation();

  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollments.myEnrollments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: lexaiSubscription } = trpc.lexai.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: recommendationsAccess } = trpc.recommendations.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: highlightedTestimonials } = trpc.testimonials.listWithContext.useQuery(
    { limit: 2 },
    { enabled: true }
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.email) return;
    if (didSyncRef.current) return;

    didSyncRef.current = true;
    syncEntitlements
      .mutateAsync()
      .then(async () => {
        await utils.enrollments.myEnrollments.invalidate();
        await utils.lexai.getSubscription.invalidate();
        await utils.recommendations.me.invalidate();
      })
      .catch(() => {
        // best-effort
      });
  }, [isAuthenticated, syncEntitlements, user?.email, utils.enrollments.myEnrollments, utils.lexai.getSubscription, utils.recommendations.me]);

  if (loading || enrollmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-blue-600 mb-4" />
            <CardTitle className="text-2xl">{t('dashboard.signInTitle')}</CardTitle>
            <CardDescription>{t('dashboard.signInDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full" size="lg">{t('dashboard.signInBtn')}</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter(e => e.completedAt !== null).length || 0;
  const inProgressCourses = totalCourses - completedCourses;
  const averageProgress = totalCourses > 0
    ? enrollments!.reduce((sum, e) => sum + (e.progressPercentage || 0), 0) / totalCourses
    : 0;

  return (
    <ClientLayout>
      <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-[calc(100vh-64px)]">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {t('dashboard.title').replace('{name}', user?.name?.split(' ')[0] || '')} 👋
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.stats.totalCourses')}</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCourses}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.stats.enrolledLabel')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.stats.inProgress')}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressCourses}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.stats.activeLearning')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.stats.completedCourses')}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedCourses}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.stats.finished')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.stats.avgProgress')}</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(averageProgress)}%</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.stats.overallCompletion')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Access Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.myAccess')}</CardTitle>
              <CardDescription>{t('dashboard.myAccessDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {t('dashboard.courseAccess')}: {totalCourses > 0 ? t('dashboard.active') : t('dashboard.notActive')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('dashboard.lexaiAccess')}: {lexaiSubscription ? t('dashboard.active') : t('dashboard.notActive')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('dashboard.recAccess')}: {recommendationsAccess?.hasSubscription ? t('dashboard.active') : t('dashboard.notActive')}
              </div>
              <div className="flex flex-wrap gap-2">
                {totalCourses > 0 && (
                  <Link href="/courses">
                    <Button variant="outline">{t('dashboard.openCourses')}</Button>
                  </Link>
                )}
                {lexaiSubscription && (
                  <Link href="/lexai">
                    <Button variant="outline">{t('dashboard.openLexai')}</Button>
                  </Link>
                )}
                {recommendationsAccess?.hasSubscription && (
                  <Link href="/recommendations">
                    <Button variant="outline">{t('dashboard.openRec')}</Button>
                  </Link>
                )}
                {!recommendationsAccess?.hasSubscription && (
                  <Link href="/recommendations">
                    <Button variant="outline">{t('dashboard.activateRec')}</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Discovery Shortcuts */}
          <div>
            <h2 className="text-2xl font-bold mb-4">{isRTL ? "استكشف أكثر" : "Discover More"}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-blue-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" />{isRTL ? "الفعاليات" : "Events"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "جلسات مباشرة، عروض خاصة، ومنافسات." : "Live sessions, special offers, and competitions."}</p>
                  <Link href="/events"><Button variant="outline" className="w-full">{isRTL ? "عرض الفعاليات" : "View Events"}</Button></Link>
                </CardContent>
              </Card>

              <Card className="border-amber-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-amber-600" />{isRTL ? "المحتوى المجاني" : "Free Content"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "دروس تمهيدية قبل الترقية للباقات الكاملة." : "Starter lessons before upgrading to full packages."}</p>
                  <Link href="/free-content"><Button variant="outline" className="w-full">{isRTL ? "شاهد المجاني" : "Open Free Library"}</Button></Link>
                </CardContent>
              </Card>

              <Card className="border-emerald-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Newspaper className="h-4 w-4 text-emerald-600" />{isRTL ? "مقالات السوق" : "Market Articles"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "تحليلات ومقالات تعليمية من فريق XFlex." : "Analysis and educational reads from the XFlex team."}</p>
                  <Link href="/articles"><Button variant="outline" className="w-full">{isRTL ? "اذهب للمقالات" : "Read Articles"}</Button></Link>
                </CardContent>
              </Card>

              <Card className="border-pink-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4 text-pink-600" />{isRTL ? "هدايا الطلاب" : "Student Gifts"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "أدوات وقوالب وروابط مفيدة لمشتركينا." : "Tools, templates, and useful links for learners."}</p>
                  <Link href="/gifts"><Button variant="outline" className="w-full">{isRTL ? "عرض الهدايا" : "See Gifts"}</Button></Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Social Proof */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-blue-600" />{isRTL ? "آراء الطلاب" : "Student Testimonials"}</CardTitle>
              <CardDescription>{isRTL ? "آراء حقيقية من متداولين يتعلمون معنا." : "Real feedback from traders learning with us."}</CardDescription>
            </CardHeader>
            <CardContent>
              {!highlightedTestimonials || highlightedTestimonials.length === 0 ? (
                <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد شهادات متاحة حالياً." : "No testimonials available yet."}</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {highlightedTestimonials.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4 bg-white">
                      <p className="text-sm text-gray-700 mb-3">"{isRTL ? item.textAr : item.textEn}"</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? item.nameAr : item.nameEn}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrolled Courses */}
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('dashboard.enrolledCourses.title')}</h2>
            
            {!enrollments || enrollments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('dashboard.noCoursesTitle')}</h3>
                  <p className="text-muted-foreground mb-4">{t('dashboard.noCoursesDesc')}</p>
                  <Link href="/">
                    <Button>{t('dashboard.browseCourses')}</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {enrollments.map((enrollment) => {
                  const progress = enrollment.progressPercentage || 0;
                  const isCompleted = enrollment.completedAt !== null;

                  return (
                    <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                      <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center relative">
                        <BookOpen className="h-16 w-16 text-white opacity-50" />
                        {isCompleted && (
                          <div className="absolute top-2 end-2">
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 me-1" />
                              {t('dashboard.completed')}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {formatSafeDate(enrollment.enrolledAt, "MMM d, yyyy")}
                          </span>
                        </div>
                        <CardTitle className="line-clamp-2">{enrollment.courseName}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{t('dashboard.progress')}</span>
                              <span className="font-semibold">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {/* Episode Count */}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                              {enrollment.completedEpisodes} {t('dashboard.episodesCompleted')}
                            </span>
                          </div>

                          {/* Continue Button */}
                          <Link href={`/course/${enrollment.courseId}`}>
                            <Button className="w-full" variant={isCompleted ? "outline" : "default"}>
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  {t('dashboard.review')}
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  {t('dashboard.continue')}
                                </>
                              )}
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </ClientLayout>
  );
}
