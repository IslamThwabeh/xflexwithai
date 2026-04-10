import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, Play, CheckCircle2, Calendar, FileText, MessageSquareQuote, Newspaper, AlertCircle, Bot, TrendingUp, Trophy, Building2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import ClientLayout from "@/components/ClientLayout";
import KeyActivationPrompt from "@/components/KeyActivationPrompt";
import TestimonialProofCard from "@/components/TestimonialProofCard";
import { DEFAULT_TESTIMONIAL_PROOFS } from "@/lib/defaultTestimonialProofs";

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
  const { t, isRTL, language } = useLanguage();

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

  const { data: activePackage } = trpc.subscriptions.myActivePackage.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: highlightedTestimonials } = trpc.testimonials.listWithContext.useQuery(
    { limit: 2 },
    { enabled: true }
  );

  const { data: testimonialProofs } = trpc.testimonials.listProofs.useQuery(
    { surface: "dashboard", limit: 2 },
    { enabled: true }
  );

  const { data: onboardingStatus } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Computed values (safe before early returns)
  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter(e => e.completedAt !== null).length || 0;
  const allCoursesCompleted = totalCourses > 0 && completedCourses === totalCourses;

  // One-time congrats: show only once per user, dismiss forever
  const congratsKey = user?.id ? `course_completion_celebrated_${user.id}` : '';
  const [showCongrats, setShowCongrats] = useState(false);
  useEffect(() => {
    if (!congratsKey) return;
    if (localStorage.getItem(congratsKey)) return;
    setShowCongrats(true);
  }, [congratsKey]);
  const dismissCongrats = () => {
    if (congratsKey) localStorage.setItem(congratsKey, '1');
    setShowCongrats(false);
  };

  const dashboardProofItems = testimonialProofs && testimonialProofs.length > 0
    ? testimonialProofs
    : DEFAULT_TESTIMONIAL_PROOFS.filter((item) => item.showProofOnDashboard).slice(0, 2);
  const hasDocumentLibraryAccess = !!(activePackage as any)?.package;

  if (loading || enrollmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-xf-cream)]" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-emerald-600 mb-4" />
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

  // Motivational message based on course progress (professional academy style)
  const getMotivationalMessage = (progress: number) => {
    if (progress === 0) return {
      en: "Your journey starts now — let's make it count!",
      ar: "رحلتك تبدأ الآن — لنجعلها تستحق!",
      emoji: "🚀",
      color: "from-emerald-500 to-teal-600",
    };
    if (progress <= 20) return {
      en: "Great start! Every expert was once a beginner.",
      ar: "بداية رائعة! كل خبير كان مبتدئاً يوماً ما.",
      emoji: "💪",
      color: "from-teal-500 to-emerald-600",
    };
    if (progress <= 40) return {
      en: "You're building solid foundations — keep the momentum!",
      ar: "أنت تبني أسساً متينة — حافظ على الزخم!",
      emoji: "📈",
      color: "from-teal-500 to-emerald-600",
    };
    if (progress <= 60) return {
      en: "Halfway there! Your dedication is paying off.",
      ar: "وصلت للنصف! التزامك بدأ يؤتي ثماره.",
      emoji: "⭐",
      color: "from-amber-500 to-orange-600",
    };
    if (progress <= 80) return {
      en: "The finish line is in sight — you've got this!",
      ar: "خط النهاية أصبح قريباً — أنت قادر على ذلك!",
      emoji: "🏆",
      color: "from-orange-500 to-red-500",
    };
    if (progress < 100) return {
      en: "Almost done! A few more lessons to trading mastery.",
      ar: "أوشكت على الانتهاء! بضعة دروس تفصلك عن الاحتراف.",
      emoji: "🔥",
      color: "from-red-500 to-pink-600",
    };
    return {
      en: "Course completed! You're ready to conquer the markets.",
      ar: "أكملت الدورة! أنت جاهز لاحتراف الأسواق.",
      emoji: "🎓",
      color: "from-green-500 to-emerald-600",
    };
  };

  return (
    <ClientLayout>
      <KeyActivationPrompt
        hasEnrollments={totalCourses > 0}
        hasLexai={!!(lexaiSubscription && 'isActive' in lexaiSubscription)}
        hasRecommendations={!!recommendationsAccess?.hasSubscription}
      />
      <div className="bg-[var(--color-xf-cream)] min-h-[calc(100vh-64px)]">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div>
            <h1 className="text-3xl font-bold mb-1">
              {t('dashboard.title').replace('{name}', user?.name?.split(' ')[0] || '')} 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* JOURNEY PROGRESS — visual step tracker */}
          {totalCourses > 0 && (() => {
            const courseProgress = enrollments?.[0]?.progressPercentage || 0;
            const courseComplete = allCoursesCompleted;
            const onboardingComplete = onboardingStatus?.isComplete ?? false;
            const onboardingStarted = !!(onboardingStatus?.steps && onboardingStatus.steps.length > 0);
            const hasLexaiActive = lexaiSubscription && 'isActive' in lexaiSubscription;
            const hasRecActive = recommendationsAccess?.hasSubscription;
            const servicesUnlocked = !!(hasLexaiActive || hasRecActive);

            const steps = [
              {
                label: isRTL ? 'أكمل الكورس' : 'Complete Course',
                icon: BookOpen,
                status: courseComplete ? 'done' as const : 'active' as const,
                detail: courseComplete
                  ? (isRTL ? 'مكتمل ✓' : 'Completed ✓')
                  : `${courseProgress}%`,
                href: enrollments?.[0] ? `/course/${enrollments[0].courseId}` : '/courses',
              },
              {
                label: isRTL ? 'افتح حساب وسيط' : 'Open Broker Account',
                icon: Building2,
                status: onboardingComplete ? 'done' as const : 'active' as const,
                detail: onboardingComplete
                  ? (isRTL ? 'مكتمل ✓' : 'Completed ✓')
                  : onboardingStarted
                    ? (isRTL ? 'قيد التقدم' : 'In Progress')
                    : (isRTL ? 'لم يبدأ' : 'Not Started'),
                href: '/broker-onboarding',
              },
              {
                label: isRTL ? 'LexAI والتوصيات' : 'LexAI & Recommendations',
                icon: Bot,
                status: servicesUnlocked ? 'done' as const : onboardingComplete ? 'active' as const : 'locked' as const,
                detail: servicesUnlocked
                  ? (isRTL ? 'مفعّل ✓' : 'Active ✓')
                  : (isRTL ? 'مقفل' : 'Locked'),
                href: '/lexai',
              },
            ];

            return (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3">
                  <h2 className="text-white font-bold text-base flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    {isRTL ? 'رحلتك التعليمية' : 'Your Learning Journey'}
                  </h2>
                </div>
                <CardContent className="p-5">
                  {/* Progress connector line */}
                  <div className="relative">
                    {/* Connector line behind circles */}
                    <div className="absolute top-5 left-0 right-0 hidden sm:block" style={{ height: 2, zIndex: 0 }}>
                      <div className="mx-auto" style={{ width: '66%' }}>
                        <div className="h-0.5 bg-gray-200 w-full rounded" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                      {steps.map((step, i) => {
                        const StepIcon = step.icon;
                        const isDone = step.status === 'done';
                        const isActive = step.status === 'active';
                        const isLocked = step.status === 'locked';

                        return (
                          <Link key={i} href={isLocked ? '#' : step.href}>
                            <div className={`flex flex-col items-center text-center p-3 rounded-xl transition-colors ${
                              isDone ? 'bg-green-50' : isActive ? 'bg-emerald-50 hover:bg-emerald-100 cursor-pointer' : 'bg-gray-50 opacity-60'
                            }`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                                isDone ? 'bg-green-500 text-white' : isActive ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'
                              }`}>
                                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                              </div>
                              <span className={`text-sm font-semibold ${
                                isDone ? 'text-green-700' : isActive ? 'text-emerald-700' : 'text-gray-400'
                              }`}>{step.label}</span>
                              <span className={`text-xs mt-1 ${
                                isDone ? 'text-green-600' : isActive ? 'text-emerald-600' : 'text-gray-400'
                              }`}>{step.detail}</span>
                              {isActive && !isLocked && (
                                <span className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  {isRTL ? 'ابدأ الآن' : 'Start Now'}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ONE-TIME CONGRATS BANNER — shown only once after completion */}
          {allCoursesCompleted && showCongrats && (
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <Trophy className="h-10 w-10 shrink-0" />
                    <div>
                      <h2 className="text-xl font-bold">
                        {isRTL ? "مبروك! أكملت الدورة التعليمية 🎓" : "Congratulations! You completed the course 🎓"}
                      </h2>
                      <p className="text-sm text-green-100 mt-1">
                        {isRTL
                          ? "أنت الآن جاهز لاحتراف الأسواق. استفد من LexAI والتوصيات!"
                          : "You're now ready to conquer the markets. Use LexAI and Recommendations!"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={dismissCongrats}
                    className="text-green-800 bg-white/90 hover:bg-white shrink-0"
                  >
                    {isRTL ? "حسناً" : "Got it!"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* POST-COMPLETION: LexAI & Recommendations as Primary CTAs */}
          {allCoursesCompleted && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* LexAI CTA */}
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3">
                  <div className="flex items-center gap-2 text-white">
                    <Bot className="h-5 w-5" />
                    <h3 className="font-bold">LexAI</h3>
                  </div>
                </div>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-4">
                    {isRTL
                      ? "مساعدك الذكي للتداول — اسأل أي سؤال واحصل على إجابات فورية."
                      : "Your AI trading assistant — ask any question and get instant answers."}
                  </p>
                  <Link href="/lexai">
                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                      {lexaiSubscription && 'isActive' in lexaiSubscription
                        ? (isRTL ? "فتح LexAI" : "Open LexAI")
                        : (isRTL ? "تفعيل LexAI" : "Activate LexAI")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Recommendations CTA */}
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3">
                  <div className="flex items-center gap-2 text-white">
                    <TrendingUp className="h-5 w-5" />
                    <h3 className="font-bold">{isRTL ? "التوصيات" : "Recommendations"}</h3>
                  </div>
                </div>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-4">
                    {isRTL
                      ? "توصيات تداول يومية من فريق المحللين المحترفين."
                      : "Daily trading recommendations from our professional analyst team."}
                  </p>
                  <Link href="/recommendations">
                    <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                      {recommendationsAccess?.hasSubscription
                        ? (isRTL ? "فتح التوصيات" : "Open Recommendations")
                        : (isRTL ? "تفعيل التوصيات" : "Activate Recommendations")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ENROLLED COURSES — Full card when in-progress, compact when completed */}
          {enrollments && enrollments.length > 0 && (
            <div>
              {enrollments.map((enrollment) => {
                const progress = enrollment.progressPercentage || 0;
                const isCompleted = enrollment.completedAt !== null;
                const motivation = getMotivationalMessage(progress);

                {/* Compact card for completed courses when all courses are done */}
                if (allCoursesCompleted && isCompleted) {
                  return (
                    <Card key={enrollment.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{enrollment.courseName}</h3>
                              <p className="text-xs text-muted-foreground">
                                {enrollment.completedEpisodes} {t('dashboard.episodesCompleted')}
                                <Badge className="bg-green-100 text-green-700 ms-2 text-xs">
                                  {t('dashboard.completed')}
                                </Badge>
                              </p>
                            </div>
                          </div>
                          <Link href={`/course/${enrollment.courseId}`}>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Play className="h-3 w-3" />
                              {t('dashboard.review')}
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                {/* Full card for in-progress courses */}
                return (
                  <Card key={enrollment.id} className="overflow-hidden border-0 shadow-lg">
                    {/* Motivational Banner */}
                    <div className={`bg-gradient-to-r ${motivation.color} px-6 py-4 text-white`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{motivation.emoji}</span>
                          <p className="text-sm sm:text-base font-medium">
                            {isRTL ? motivation.ar : motivation.en}
                          </p>
                        </div>
                        <span className="text-2xl font-bold">{progress}%</span>
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Course Thumbnail */}
                        <div className="hidden sm:flex shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 items-center justify-center">
                          <BookOpen className="h-10 w-10 text-white opacity-70" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <h3 className="text-xl font-bold">{enrollment.courseName}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {enrollment.completedEpisodes} {t('dashboard.episodesCompleted')}
                              {isCompleted && (
                                <Badge className="bg-green-100 text-green-700 ms-2">
                                  <CheckCircle2 className="h-3 w-3 me-1" />
                                  {t('dashboard.completed')}
                                </Badge>
                              )}
                            </p>
                          </div>

                          {/* Large Progress Bar */}
                          <div className="space-y-1">
                            <Progress value={progress} className="h-3" />
                          </div>

                          {/* Action Button */}
                          <Link href={`/course/${enrollment.courseId}`}>
                            <Button size="lg" variant={isCompleted ? "outline" : "default"} className="w-full sm:w-auto">
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* No courses yet */}
          {(!enrollments || enrollments.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('dashboard.noCoursesTitle')}</h3>
                <p className="text-muted-foreground mb-4">{t('dashboard.noCoursesDesc')}</p>
                <Link href="/my-packages">
                  <Button>{t('dashboard.browseCourses')}</Button>
                </Link>
              </CardContent>
            </Card>
          )}

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
                {t('dashboard.lexaiAccess')}: {lexaiSubscription && 'isActive' in lexaiSubscription
                  ? t('dashboard.active')
                  : lexaiSubscription && 'isFrozen' in lexaiSubscription
                    ? <span className="text-amber-600 font-medium">{language === 'ar' ? 'مُجمّد' : 'Frozen'}</span>
                    : t('dashboard.notActive')}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('dashboard.recAccess')}: {recommendationsAccess?.hasSubscription
                  ? t('dashboard.active')
                  : recommendationsAccess?.isFrozen
                    ? <span className="text-amber-600 font-medium">{language === 'ar' ? 'مُجمّد' : 'Frozen'}</span>
                    : t('dashboard.notActive')}
              </div>
              <div className="flex flex-wrap gap-2">
                {totalCourses > 0 && (
                  <Link href="/courses">
                    <Button variant="outline">{t('dashboard.openCourses')}</Button>
                  </Link>
                )}
                {lexaiSubscription && 'isActive' in lexaiSubscription && (
                  <Link href="/lexai">
                    <Button variant="outline">{t('dashboard.openLexai')}</Button>
                  </Link>
                )}
                {recommendationsAccess?.hasSubscription && (
                  <Link href="/recommendations">
                    <Button variant="outline">{t('dashboard.openRec')}</Button>
                  </Link>
                )}
                {!recommendationsAccess?.hasSubscription && !recommendationsAccess?.isFrozen && (
                  <Link href="/recommendations">
                    <Button variant="outline">{t('dashboard.activateRec')}</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Key Validity Information */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-4 px-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-amber-900">
                    {isRTL ? "معلومات مهمة عن اشتراكك" : "Important Subscription Info"}
                  </p>
                  <ul className="text-amber-800 space-y-0.5 list-disc list-inside">
                    <li>{isRTL ? "الدورة التعليمية صالحة مدى الحياة" : "Trading course access is lifetime"}</li>
                    <li>{isRTL ? "خدمة LexAI والتوصيات صالحة لمدة شهر واحد من تاريخ التفعيل" : "LexAI & Recommendations are valid for 1 month from activation date"}</li>
                    <li>{isRTL ? "يمكنك تجديد اشتراكك في أي وقت من صفحة الاشتراكات" : "You can renew your subscription anytime from the Subscriptions page"}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discovery Shortcuts */}
          <div>
            <h2 className="text-2xl font-bold mb-4">{isRTL ? "استكشف أكثر" : "Discover More"}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-emerald-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-emerald-600" />{isRTL ? "الفعاليات" : "Events"}</CardTitle>
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

              <Card className="border-teal-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-teal-600" />{isRTL ? "ملفات الطلاب" : "Student Documents"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {hasDocumentLibraryAccess
                      ? (isRTL ? "حمّل ملفات الدورة أو افتحها مباشرة بصيغة PDF." : "Open the course files in PDF or download them to your device.")
                      : (isRTL ? "تظهر ملفات الدورة هنا بعد تفعيل أي باقة." : "Course documents appear here after you activate any package.")}
                  </p>
                  <Link href={hasDocumentLibraryAccess ? "/documents" : "/activate-key"}>
                    <Button variant="outline" className="w-full">
                      {hasDocumentLibraryAccess
                        ? (isRTL ? "افتح الملفات" : "Open Documents")
                        : (isRTL ? "فعّل باقتك" : "Activate Package")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Social Proof */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-emerald-600" />{isRTL ? "آراء الطلاب" : "Student Testimonials"}</CardTitle>
              <CardDescription>{isRTL ? "آراء حقيقية من متداولين يتعلمون معنا." : "Real feedback from traders learning with us."}</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardProofItems.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{isRTL ? "لقطات سريعة من تجارب الطلاب" : "Quick proof snapshots"}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? "يمكنك فتح أي لقطة لعرضها بوضوح أكبر." : "Open any snapshot for a closer look."}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {dashboardProofItems.map((item) => (
                      <TestimonialProofCard key={item.id} item={item} isRTL={isRTL} compact />
                    ))}
                  </div>
                </div>
              )}

              <div className={dashboardProofItems.length > 0 ? "border-t pt-5" : ""}>
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
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
      </div>
    </ClientLayout>
  );
}
