import StudentDashboardOverview from '@/components/dashboard/StudentDashboardOverview';
import { localizePublicHref } from '@/lib/publicLocaleHref';
import { ACADEMY_TIME_ZONE } from '@shared/academyLocale';
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, GraduationCap, Calendar, FileText, MessageSquareQuote, Newspaper, Trophy, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import ClientLayout from "@/components/ClientLayout";
import KeyActivationPrompt from "@/components/KeyActivationPrompt";
import TestimonialProofCard from "@/components/TestimonialProofCard";
import FreeLibrarySection from "@/components/FreeLibrarySection";
import ArticlePreviewCard from "@/components/ArticlePreviewCard";
import { isArticleAvailableInLanguage } from "@shared/curatedArticles";
import { DEFAULT_TESTIMONIAL_PROOFS } from "@/lib/defaultTestimonialProofs";

export default function MyDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const [loadDashboardExtras, setLoadDashboardExtras] = useState(false);

  const { data: enrollments, isLoading: enrollmentsLoading, isError: enrollmentsError, refetch: refetchEnrollments } = trpc.enrollments.myEnrollments.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: serviceAccess, isLoading: serviceAccessLoading, isError: serviceAccessError } = trpc.subscriptions.serviceAccessSummary.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: documentAccess } = trpc.documents.myAccess.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: highlightedTestimonials } = trpc.testimonials.listWithContext.useQuery(
    { limit: 2 },
    { enabled: loadDashboardExtras, staleTime: 10 * 60_000 }
  );

  const { data: testimonialProofs } = trpc.testimonials.listProofs.useQuery(
    { surface: "dashboard", limit: 2 },
    { enabled: loadDashboardExtras, staleTime: 10 * 60_000 }
  );

  const { data: onboardingStatus } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: surveyAvailability } = trpc.studentSurveys.availability.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: articles } = trpc.articles.list.useQuery(undefined, {
    enabled: loadDashboardExtras,
    staleTime: 10 * 60_000,
  });
  const { data: freeLibrary } = trpc.freeLibrary.list.useQuery(undefined, {
    enabled: loadDashboardExtras,
    staleTime: 10 * 60_000,
  });
  const dashboardArticles = articles
    ?.filter((article) => isArticleAvailableInLanguage(article, isRTL ? "ar" : "en"))
    .slice(0, 2) ?? [];

  // Computed values (safe before early returns)
  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter(e => e.completedAt != null).length || 0;
  const allCoursesCompleted = totalCourses > 0 && completedCourses === totalCourses;

  // One-time congrats: show only once per user, dismiss forever
  const congratsKey = user?.id ? `course_completion_celebrated_${user.id}` : '';
  const [showCongrats, setShowCongrats] = useState(false);
  useEffect(() => {
    if (!congratsKey) return;
    if (localStorage.getItem(congratsKey)) return;
    setShowCongrats(true);
  }, [congratsKey]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const windowWithIdleCallback = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdleCallback.requestIdleCallback) {
      const idleHandle = windowWithIdleCallback.requestIdleCallback(
        () => setLoadDashboardExtras(true),
        { timeout: 1500 },
      );
      return () => windowWithIdleCallback.cancelIdleCallback?.(idleHandle);
    }

    const timer = window.setTimeout(() => setLoadDashboardExtras(true), 800);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);
  const dismissCongrats = () => {
    if (congratsKey) localStorage.setItem(congratsKey, '1');
    setShowCongrats(false);
  };

  const dashboardProofItems = testimonialProofs && testimonialProofs.length > 0
    ? testimonialProofs
    : DEFAULT_TESTIMONIAL_PROOFS.filter((item) => item.showProofOnDashboard).slice(0, 2);
  const hasDocumentLibraryAccess = !!documentAccess?.hasAccess;

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

  if (enrollmentsError) {
    return (
      <ClientLayout>
        <div className="mx-auto max-w-2xl px-4 py-12" dir={isRTL ? 'rtl' : 'ltr'}>
          <Card role="alert">
            <CardHeader>
              <CardTitle><h1>{isRTL ? 'تعذّر تحميل دوراتك' : 'Unable to load your courses'}</h1></CardTitle>
              <CardDescription>{isRTL ? 'أعد المحاولة لتحميل تقدمك التعليمي.' : 'Try again to load your learning progress.'}</CardDescription>
            </CardHeader>
            <CardContent><Button onClick={() => void refetchEnrollments()}>{isRTL ? 'أعد المحاولة' : 'Try again'}</Button></CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <KeyActivationPrompt
        hasEnrollments={totalCourses > 0}
        hasLexai={!!serviceAccess?.lexai.hasHistory}
        hasRecommendations={!!serviceAccess?.recommendation.hasHistory}
      />
      <div className="flex-1 min-w-0 bg-[var(--color-xf-cream)]">
        <main className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-8">
          <div className="space-y-8">
          {surveyAvailability?.enabled && surveyAvailability.access === "student" && surveyAvailability.outstandingCount > 0 && (
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-amber-100 p-2 text-amber-700"><ClipboardCheck className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold text-amber-950">
                      {isRTL
                        ? `${surveyAvailability.outstandingCount} استبيان بانتظار إجابتك`
                        : `${surveyAvailability.outstandingCount} survey${surveyAvailability.outstandingCount === 1 ? "" : "s"} awaiting your response`}
                    </h2>
                    {surveyAvailability.nearestDueAt && (
                      <p className="mt-1 text-sm text-amber-800">
                        {isRTL ? "أقرب موعد: " : "Nearest deadline: "}
                        {new Date(surveyAvailability.nearestDueAt).toLocaleString(isRTL ? "ar-PS" : "en-GB", { timeZone: ACADEMY_TIME_ZONE })}
                      </p>
                    )}
                  </div>
                </div>
                <Link href="/surveys"><Button>{isRTL ? "فتح الاستبيانات" : "Open surveys"}</Button></Link>
              </CardContent>
            </Card>
          )}

          <StudentDashboardOverview
            firstName={user?.name?.split(' ')[0] || ''}
            enrollments={enrollments ?? []}
            serviceAccess={serviceAccess}
            onboarding={onboardingStatus}
            hasDocuments={hasDocumentLibraryAccess}
            serviceAccessLoading={serviceAccessLoading}
            serviceAccessError={serviceAccessError}
          />

          {/* ONE-TIME CONGRATS BANNER — shown only once after completion */}
          {allCoursesCompleted && showCongrats && (
            <Card className="overflow-hidden border-0 shadow-lg bg-emerald-900 text-white">
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
                          ? "يمكنك مراجعة الدروس والملفات ومتابعة الخدمات المتاحة في حسابك."
                          : "Review your lessons and documents, and explore the services available in your account."}
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

          {freeLibrary ? (
            <Card className="border-emerald-100 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                      {isRTL ? "مواد إضافية مجانية" : "Free Learning Extras"}
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      {isRTL ? "فيديوهات تمهيدية + مقالات كاملة داخل حسابك" : "Starter videos + full articles inside your account"}
                    </h2>
                  </div>
                  <Link href={localizePublicHref("/free-content", language)}>
                    <Button variant="secondary" className="bg-white/95 text-emerald-700 hover:bg-white">
                      {isRTL ? "افتح المكتبة كاملة" : "Open Full Library"}
                    </Button>
                  </Link>
                </div>
              </div>
              <CardContent className="p-5 md:p-6">
                <p className="mb-5 text-sm leading-6 text-muted-foreground">
                  {isRTL
                    ? "إذا أردت مراجعة فكرة بسرعة أو مشاركة مصدر تمهيدي مع صديق، ستجد هنا الفيديوهات المجانية الجديدة مع مقالات منفصلة لكل موضوع بدلاً من جمعها داخل ملف واحد."
                    : "If you want a fast concept refresher or a starter resource to share with a friend, the new free videos now sit beside standalone articles for each topic instead of one bundled file."}
                </p>
                <FreeLibrarySection data={freeLibrary} isRtl={isRTL} mode="compact" />

                {dashboardArticles.length > 0 ? (
                  <div className="mt-6 border-t border-emerald-100 pt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          {isRTL ? "اقرأ أيضاً" : "Also Read"}
                        </p>
                        <h3 className="mt-1 text-base font-bold text-xf-dark">
                          {isRTL ? "مقالان مختاران من المكتبة المفتوحة" : "Two selected reads from the open library"}
                        </h3>
                      </div>
                      <Link href={localizePublicHref("/articles", language)}>
                        <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                          {isRTL ? "كل المقالات" : "All Articles"}
                        </Button>
                      </Link>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {dashboardArticles.map((article) => (
                        <ArticlePreviewCard key={article.id} article={article} isRtl={isRTL} variant="compact" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

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
                  <Link href={localizePublicHref("/events", language)}><Button variant="outline" className="w-full">{isRTL ? "عرض الفعاليات" : "View Events"}</Button></Link>
                </CardContent>
              </Card>

              <Card className="border-amber-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-amber-600" />{isRTL ? "المحتوى المجاني" : "Free Content"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "3 فيديوهات مجانية مع مقالات كاملة منفصلة لكل موضوع." : "3 free videos with standalone full articles for each topic."}</p>
                  <Link href={localizePublicHref("/free-content", language)}><Button variant="outline" className="w-full">{isRTL ? "شاهد المجاني" : "Open Free Library"}</Button></Link>
                </CardContent>
              </Card>

              <Card className="border-emerald-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Newspaper className="h-4 w-4 text-emerald-600" />{isRTL ? "مقالات السوق" : "Market Articles"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{isRTL ? "تحليلات ومقالات تعليمية من فريق XFlex." : "Analysis and educational reads from the XFlex team."}</p>
                  <Link href={localizePublicHref("/articles", language)}><Button variant="outline" className="w-full">{isRTL ? "اذهب للمقالات" : "Read Articles"}</Button></Link>
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
