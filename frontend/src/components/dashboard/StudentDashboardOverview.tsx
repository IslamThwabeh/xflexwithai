import { ACADEMY_TIME_ZONE } from "@shared/academyLocale";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Headphones,
  Play,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RouterOutputs } from "@/lib/trpc";
import SpotlightCard from "./SpotlightCard";
import "./student-dashboard.css";

type DashboardProps = {
  firstName: string;
  enrollments: RouterOutputs["enrollments"]["myEnrollments"];
  serviceAccess:
    | RouterOutputs["subscriptions"]["serviceAccessSummary"]
    | undefined;
  onboarding: RouterOutputs["onboarding"]["getStatus"] | undefined;
  hasDocuments: boolean;
  serviceAccessLoading: boolean;
  serviceAccessError: boolean;
};

export default function StudentDashboardOverview({
  firstName,
  enrollments,
  serviceAccess,
  onboarding,
  hasDocuments,
  serviceAccessLoading,
  serviceAccessError,
}: DashboardProps) {
  const { isRTL } = useLanguage();
  const reducedMotion = useReducedMotion();
  const nextCourse =
    enrollments.find(course => course.completedAt == null) ?? enrollments[0];
  const completedCourses = enrollments.filter(
    course => course.completedAt != null
  ).length;
  const completedLessons = enrollments.reduce(
    (sum, course) => sum + (course.completedEpisodes ?? 0),
    0
  );
  const progress = Math.min(
    100,
    Math.max(0, nextCourse?.progressPercentage ?? 0)
  );
  const nextCompleted = nextCourse?.completedAt != null;
  const services = [
    {
      name: "LexAI",
      icon: Bot,
      href: "/lexai",
      summary: serviceAccess?.lexai,
      description: isRTL
        ? "مساحة التحليل بالذكاء الاصطناعي"
        : "Your AI-assisted analysis workspace",
    },
    {
      name: isRTL ? "التوصيات" : "Recommendations",
      icon: TrendingUp,
      href: "/recommendations",
      summary: serviceAccess?.recommendation,
      description: isRTL
        ? "تابع تحديثات فريق التحليل"
        : "Follow updates from the analysis team",
    },
  ];

  const statusLabels = {
    active: isRTL ? "نشط" : "Active",
    expiring: isRTL ? "ينتهي قريبًا" : "Expiring soon",
    frozen: isRTL ? "مجمّد" : "Frozen",
    pending: isRTL ? "بانتظار التفعيل" : "Awaiting activation",
    expired: isRTL ? "منتهي" : "Expired",
    none: isRTL ? "غير مشترك" : "No subscription",
  };

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className="student-dashboard space-y-7"
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-800">
              {isRTL ? "مساحتك التعليمية" : "Your learning space"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {isRTL
                ? `أهلاً${firstName ? ` ${firstName}` : ""}`
                : `Welcome back${firstName ? `, ${firstName}` : ""}`}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/guides" className="dashboard-text-link">
              <Play size={16} aria-hidden="true" />
              {isRTL ? "شروحات الاستخدام" : "How-to guides"}
            </Link>
            <Link href="/support" className="dashboard-text-link">
              <Headphones size={16} aria-hidden="true" />
              {isRTL ? "الدعم" : "Get support"}
            </Link>
          </div>
        </div>

        <SpotlightCard className="dashboard-resume">
          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="min-w-0">
              <div className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-200">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/10">
                  <BookOpen size={18} aria-hidden="true" />
                </span>
                {nextCourse
                  ? nextCompleted
                    ? isRTL
                      ? "مراجعة الدورة"
                      : "Keep learning"
                    : isRTL
                      ? "خطوتك التالية"
                      : "Your next step"
                  : isRTL
                    ? "ابدأ التعلم"
                    : "Start learning"}
              </div>
              <h2 className="max-w-2xl break-words text-2xl font-bold leading-snug text-white md:text-3xl">
                {nextCourse?.courseName ??
                  (isRTL
                    ? "مسارك التعليمي يبدأ هنا"
                    : "Your learning journey starts here")}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-7 text-slate-300">
                {nextCourse
                  ? isRTL
                    ? `${nextCourse.completedEpisodes ?? 0} درس مكتمل. تابع الدورة بالوتيرة المناسبة لك.`
                    : `${nextCourse.completedEpisodes ?? 0} lessons completed. Continue at your own pace.`
                  : isRTL
                    ? "استعرض باقاتك أو استخدم مفتاح التفعيل لفتح محتواك التعليمي."
                    : "View your packages or use an activation key to access your learning content."}
              </p>
              {nextCourse && (
                <div className="mt-4 flex max-w-sm items-center gap-3 lg:hidden">
                  <progress
                    className="dashboard-course-progress"
                    value={progress}
                    max={100}
                    aria-label={isRTL ? "التقدم في الدورة" : "Course progress"}
                  />
                  <span className="text-xs font-medium text-slate-200">
                    {Math.round(progress)}%
                  </span>
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={
                    nextCourse
                      ? `/course/${nextCourse.courseId}`
                      : "/my-packages"
                  }
                  className="dashboard-primary-action"
                >
                  <Play size={17} aria-hidden="true" />
                  {nextCourse
                    ? nextCompleted
                      ? isRTL
                        ? "راجع الدورة"
                        : "Review course"
                      : isRTL
                        ? "تابع التعلم"
                        : "Continue learning"
                    : isRTL
                      ? "استعرض باقاتي"
                      : "View my packages"}
                  <ChevronRight
                    size={17}
                    className="rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href={hasDocuments ? "/documents" : "/activate-key"}
                  className="dashboard-hero-link"
                >
                  {hasDocuments ? (
                    <FileText size={17} aria-hidden="true" />
                  ) : (
                    <ArrowUpRight size={17} aria-hidden="true" />
                  )}
                  {hasDocuments
                    ? isRTL
                      ? "ملفات الدورة"
                      : "Course documents"
                    : isRTL
                      ? "تفعيل مفتاح"
                      : "Activate a key"}
                </Link>
              </div>
            </div>
            {nextCourse && (
              <div className="dashboard-progress-summary hidden lg:block">
                <div
                  className="dashboard-progress-ring"
                  style={{
                    background: `conic-gradient(#55e4ad ${progress}%, #263e4a 0)`,
                  }}
                  aria-hidden="true"
                >
                  <div>
                    <span>
                      {Math.round(progress)}
                      <small>%</small>
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-200">
                  {isRTL ? "التقدم في الدورة" : "Course progress"}
                </p>
                <progress
                  className="sr-only"
                  value={progress}
                  max={100}
                  aria-label={isRTL ? "التقدم في الدورة" : "Course progress"}
                >
                  {progress}%
                </progress>
              </div>
            )}
          </div>
        </SpotlightCard>

        <dl className="dashboard-stats">
          <div>
            <dt>
              <BookOpen size={18} aria-hidden="true" />
              {isRTL ? "دوراتك" : "Enrolled courses"}
            </dt>
            <dd>{enrollments.length}</dd>
          </div>
          <div>
            <dt>
              <Check size={18} aria-hidden="true" />
              {isRTL ? "دروس مكتملة" : "Lessons completed"}
            </dt>
            <dd>{completedLessons}</dd>
          </div>
          <div>
            <dt>
              <CheckCircle2 size={18} aria-hidden="true" />
              {isRTL ? "دورات مكتملة" : "Courses completed"}
            </dt>
            <dd>{completedCourses}</dd>
          </div>
        </dl>

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
          <section
            aria-labelledby="dashboard-courses-title"
            className="min-w-0"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="dashboard-courses-title"
                className="text-xl font-bold text-slate-900"
              >
                {isRTL ? "دوراتي" : "My courses"}
              </h2>
              <Link href="/my-packages" className="dashboard-text-link">
                {isRTL ? "باقاتي" : "My packages"}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="space-y-3">
              {enrollments.map(course => {
                const courseProgress = Math.min(
                  100,
                  Math.max(0, course.progressPercentage ?? 0)
                );
                const completed = course.completedAt != null;
                return (
                  <article key={course.id} className="dashboard-course-card">
                    <div className="flex items-start gap-3">
                      <span className="dashboard-course-icon">
                        {completed ? (
                          <CheckCircle2 size={22} aria-hidden="true" />
                        ) : (
                          <BookOpen size={22} aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-bold text-slate-900">
                          {course.courseName}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {course.completedEpisodes ?? 0}{" "}
                          {isRTL ? "درس مكتمل" : "lessons completed"}
                          {completed && (
                            <span className="ms-2 font-medium text-emerald-800">
                              {isRTL ? "مكتملة" : "Completed"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="my-4 flex items-center gap-3">
                      <progress
                        className="dashboard-course-progress"
                        value={courseProgress}
                        max={100}
                        aria-label={`${course.courseName} ${isRTL ? "التقدم" : "progress"}`}
                      />
                      <span className="text-xs font-semibold tabular-nums text-slate-600">
                        {Math.round(courseProgress)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/course/${course.courseId}`}
                        className="dashboard-text-link"
                      >
                        {completed
                          ? isRTL
                            ? "راجع الدورة"
                            : "Review course"
                          : isRTL
                            ? "افتح الدورة"
                            : "Open course"}
                        <ChevronRight
                          size={16}
                          className="rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </Link>
                      <Link
                        href={hasDocuments ? "/documents" : "/activate-key"}
                        className="dashboard-text-link text-slate-600"
                      >
                        <FileText size={15} aria-hidden="true" />
                        {hasDocuments
                          ? isRTL
                            ? "الملفات"
                            : "Documents"
                          : isRTL
                            ? "فعّل لفتح الملفات"
                            : "Activate for documents"}
                      </Link>
                    </div>
                  </article>
                );
              })}
              {enrollments.length === 0 && (
                <div className="dashboard-course-card py-8 text-center">
                  <BookOpen
                    className="mx-auto mb-3 text-emerald-800"
                    size={28}
                    aria-hidden="true"
                  />
                  <h3 className="font-bold text-slate-900">
                    {isRTL
                      ? "لا توجد دورات مسجّلة بعد"
                      : "No courses enrolled yet"}
                  </h3>
                  <Link
                    href="/my-packages"
                    className="dashboard-text-link mt-4"
                  >
                    {isRTL ? "استعرض باقاتي" : "View my packages"}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section
            aria-labelledby="dashboard-services-title"
            className="min-w-0"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="dashboard-services-title"
                className="text-xl font-bold text-slate-900"
              >
                {isRTL ? "خدماتي" : "My services"}
              </h2>
              <Link href="/subscriptions" className="dashboard-text-link">
                {isRTL ? "الاشتراكات" : "Subscriptions"}
              </Link>
            </div>
            <div className="space-y-3">
              {services.map(service => {
                const state = service.summary?.status ?? "none";
                const available =
                  !serviceAccessError &&
                  !serviceAccessLoading &&
                  (state === "active" || state === "expiring");
                const pending = state === "pending";
                const status = serviceAccessError
                  ? isRTL
                    ? "تعذّر تحميل الحالة"
                    : "Status unavailable"
                  : serviceAccessLoading
                    ? isRTL
                      ? "جارٍ التحميل"
                      : "Loading status"
                    : statusLabels[state];
                const endDate = service.summary?.endDate
                  ? new Date(service.summary.endDate)
                  : null;
                const displayEndDate =
                  endDate &&
                  Number.isFinite(endDate.getTime()) &&
                  (available || state === "expired");
                const Icon = service.icon;
                return (
                  <article
                    key={service.href}
                    className="dashboard-service-card"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-bold text-slate-900">
                        <Icon size={18} aria-hidden="true" />
                        {service.name}
                      </h3>
                      <span
                        className={`dashboard-service-status ${!serviceAccessError && (state === "frozen" || state === "pending" || state === "expiring") ? "dashboard-status-frozen" : available ? "dashboard-status-active" : ""}`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mb-3 mt-2 text-sm leading-6 text-slate-600">
                      {service.description}
                    </p>
                    {displayEndDate && (
                      <p className="mb-3 text-xs text-slate-600">
                        {isRTL ? "حتى " : "Through "}
                        {endDate.toLocaleDateString(isRTL ? "ar-PS" : "en-GB", {
                          timeZone: ACADEMY_TIME_ZONE,
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    <Link
                      href={
                        available
                          ? service.href
                          : pending
                            ? "/my-packages"
                            : "/subscriptions"
                      }
                      className="dashboard-text-link"
                    >
                      {available
                        ? isRTL
                          ? "افتح الخدمة"
                          : "Open workspace"
                        : pending
                          ? isRTL
                            ? "خطوات التفعيل"
                            : "View activation steps"
                          : isRTL
                            ? "راجع الاشتراك"
                            : "Review subscription"}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
            <Link
              href="/broker-onboarding"
              className="dashboard-broker-link mt-4"
            >
              <Building2 size={21} className="shrink-0" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-semibold">
                  {isRTL ? "إعداد حساب الوسيط" : "Broker account setup"}
                </span>
                <span className="mt-1 block text-xs text-slate-600">
                  {onboarding?.isComplete
                    ? isRTL
                      ? "مكتمل"
                      : "Completed"
                    : isRTL
                      ? "عرض خطوات الإعداد"
                      : "View your setup steps"}
                </span>
              </span>
              <ChevronRight
                size={17}
                className="rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
            <p className="mt-4 text-xs leading-6 text-slate-600">
              {isRTL
                ? "راجع تواريخ خدماتك وخيارات التجديد من صفحة الاشتراكات."
                : "View your service dates and renewal options on the subscriptions page."}
            </p>
          </section>
        </div>
      </m.div>
    </LazyMotion>
  );
}
