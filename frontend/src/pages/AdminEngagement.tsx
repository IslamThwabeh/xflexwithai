import { ReactNode, useEffect, useMemo, useState } from 'react';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDateTime } from '@/lib/dateLocale';
import { trpc } from '@/lib/trpc';
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MousePointerClick,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

type EngagementSummaryItem = {
  eventType: string;
  count: number;
  uniqueUsers: number;
};

type RecentEngagementEvent = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  eventType: string;
  entityType: string | null;
  entityId: number | null;
  entityLabelEn: string | null;
  entityLabelAr: string | null;
  metadata: string | null;
  createdAt: string;
};

type EventSelection = {
  eventType: string;
  days: 7 | 30;
};

const RECENT_EVENTS_PAGE_SIZE = 10;

const ROUTE_LABELS: Record<string, { en: string; ar: string }> = {
  '/dashboard': { en: 'Student Dashboard', ar: 'لوحة الطالب' },
  '/courses': { en: 'Courses', ar: 'الدورات' },
  '/lexai': { en: 'LexAI', ar: 'LexAI' },
  '/recommendations': { en: 'Recommendations', ar: 'التوصيات' },
  '/quizzes': { en: 'Quizzes', ar: 'الاختبارات' },
  '/support': { en: 'Support Chat', ar: 'الدعم الفني' },
  '/my-packages': { en: 'My Package', ar: 'باقتي' },
  '/broker-onboarding': { en: 'Broker Onboarding', ar: 'تسجيل الوسيط' },
};

const EVENT_COPY: Record<string, {
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: (className?: string) => ReactNode;
}> = {
  page_view: {
    labelEn: 'Page View',
    labelAr: 'عرض صفحة',
    descriptionEn: 'Student page visits inside the platform',
    descriptionAr: 'زيارات الطلاب لصفحات المنصة',
    icon: (className = 'w-4 h-4') => <Eye className={className} />,
  },
  course_start: {
    labelEn: 'Course Start',
    labelAr: 'بدء دورة',
    descriptionEn: 'Students starting course learning sessions',
    descriptionAr: 'بدء الطلاب جلسات التعلم داخل الدورات',
    icon: (className = 'w-4 h-4') => <BookOpen className={className} />,
  },
  lesson_complete: {
    labelEn: 'Lesson Completed',
    labelAr: 'إكمال درس',
    descriptionEn: 'Students completing lesson milestones',
    descriptionAr: 'إكمال الطلاب دروساً داخل المنصة',
    icon: (className = 'w-4 h-4') => <BookOpen className={className} />,
  },
  quiz_attempt: {
    labelEn: 'Quiz Attempt',
    labelAr: 'محاولة اختبار',
    descriptionEn: 'Students submitting quiz attempts',
    descriptionAr: 'محاولات الطلاب في الاختبارات',
    icon: (className = 'w-4 h-4') => <MousePointerClick className={className} />,
  },
  lexai_chat: {
    labelEn: 'LexAI Usage',
    labelAr: 'استخدام LexAI',
    descriptionEn: 'Students using LexAI analysis flows',
    descriptionAr: 'استخدام الطلاب لمسارات LexAI التحليلية',
    icon: (className = 'w-4 h-4') => <Sparkles className={className} />,
  },
  recommendation_view: {
    labelEn: 'Recommendations View',
    labelAr: 'عرض التوصيات',
    descriptionEn: 'Students opening the recommendations experience',
    descriptionAr: 'دخول الطلاب إلى تجربة التوصيات',
    icon: (className = 'w-4 h-4') => <TrendingUp className={className} />,
  },
  course_complete: {
    labelEn: 'Course Completed',
    labelAr: 'إكمال دورة',
    descriptionEn: 'Students finishing full courses',
    descriptionAr: 'إكمال الطلاب دورة كاملة',
    icon: (className = 'w-4 h-4') => <BookOpen className={className} />,
  },
  feature_use: {
    labelEn: 'Feature Usage',
    labelAr: 'استخدام ميزة',
    descriptionEn: 'Students using tracked platform features',
    descriptionAr: 'استخدام الطلاب لميزة داخل المنصة',
    icon: (className = 'w-4 h-4') => <Activity className={className} />,
  },
};

function prettifyEventType(eventType: string) {
  return eventType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getEventCopy(eventType: string) {
  return EVENT_COPY[eventType] ?? {
    labelEn: prettifyEventType(eventType),
    labelAr: 'نشاط طلابي',
    descriptionEn: 'Tracked student activity',
    descriptionAr: 'نشاط طلابي تم تتبعه',
    icon: (className = 'w-4 h-4') => <Activity className={className} />,
  };
}

function parseMetadata(metadata?: string | null) {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function getMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getMetadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : null;
}

function getMetadataBoolean(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'boolean' ? value : null;
}

function getRouteLabel(path: string, isRtl: boolean) {
  const label = ROUTE_LABELS[path];
  return label ? (isRtl ? label.ar : label.en) : path;
}

function describeRecentEvent(event: RecentEngagementEvent, isRtl: boolean) {
  const metadata = parseMetadata(event.metadata);
  const routePath = getMetadataString(metadata, 'path');
  const routeLabel = routePath ? getRouteLabel(routePath, isRtl) : null;
  const courseTitle = getMetadataString(metadata, 'courseTitle')
    ?? (isRtl ? event.entityLabelAr : event.entityLabelEn);
  const timeframe = getMetadataString(metadata, 'timeframe');
  const score = getMetadataNumber(metadata, 'score');
  const passed = getMetadataBoolean(metadata, 'passed');
  const fallback = isRtl ? getEventCopy(event.eventType).labelAr : getEventCopy(event.eventType).labelEn;

  switch (event.eventType) {
    case 'page_view':
      return isRtl
        ? `زار ${routeLabel ?? 'صفحة داخل المنصة'}`
        : `Visited ${routeLabel ?? 'a platform page'}`;
    case 'course_start':
      return isRtl
        ? `بدأ ${courseTitle ? `دورة ${courseTitle}` : 'دورة جديدة'}`
        : `Started ${courseTitle ?? 'a course'}`;
    case 'lesson_complete':
      return isRtl
        ? `أكمل ${courseTitle ? `درساً في ${courseTitle}` : 'درساً'}`
        : `Completed ${courseTitle ? `a lesson in ${courseTitle}` : 'a lesson'}`;
    case 'quiz_attempt':
      if (score !== null && passed !== null) {
        return isRtl
          ? `قدّم ${courseTitle ?? 'محاولة اختبار'} ${passed ? 'ونجح' : 'ولم ينجح'} بنتيجة ${score}%`
          : `Submitted ${courseTitle ?? 'a quiz attempt'} and ${passed ? 'passed' : 'did not pass'} with ${score}%`;
      }

      if (score !== null) {
        return isRtl
          ? `قدّم ${courseTitle ?? 'محاولة اختبار'} بنتيجة ${score}%`
          : `Submitted ${courseTitle ?? 'a quiz attempt'} with ${score}%`;
      }

      return isRtl
        ? `قدّم ${courseTitle ?? 'محاولة اختبار'}`
        : `Submitted ${courseTitle ?? 'a quiz attempt'}`;
    case 'lexai_chat':
      return isRtl
        ? `استخدم LexAI${timeframe ? ` لتحليل ${timeframe}` : ''}`
        : `Used LexAI${timeframe ? ` for ${timeframe}` : ''}`;
    case 'recommendation_view':
      return isRtl ? 'فتح صفحة التوصيات' : 'Opened Recommendations';
    default:
      return isRtl ? `نفّذ ${fallback}` : `Performed ${fallback}`;
  }
}

function buildEventHighlights(event: RecentEngagementEvent, isRtl: boolean) {
  const metadata = parseMetadata(event.metadata);
  const highlights: string[] = [];
  const routePath = getMetadataString(metadata, 'path');
  const courseTitle = getMetadataString(metadata, 'courseTitle');
  const timeframe = getMetadataString(metadata, 'timeframe');
  const score = getMetadataNumber(metadata, 'score');
  const passed = getMetadataBoolean(metadata, 'passed');
  const reachedHalfway = getMetadataBoolean(metadata, 'reachedHalfway');

  if (routePath) highlights.push(getRouteLabel(routePath, isRtl));
  if (courseTitle) highlights.push(courseTitle);
  if (!courseTitle) {
    const entityLabel = isRtl ? event.entityLabelAr : event.entityLabelEn;
    if (entityLabel) highlights.push(entityLabel);
  }
  if (timeframe) highlights.push(isRtl ? `الإطار ${timeframe}` : `Timeframe ${timeframe}`);
  if (score !== null) highlights.push(isRtl ? `النتيجة ${score}%` : `Score ${score}%`);
  if (passed !== null) highlights.push(isRtl ? (passed ? 'نجح' : 'لم ينجح') : (passed ? 'Passed' : 'Not passed'));
  if (reachedHalfway) highlights.push(isRtl ? 'بلغ عتبة المشاهدة' : 'Reached watch threshold');

  return highlights;
}

function getStudentIdentity(
  event: Pick<RecentEngagementEvent, 'userId' | 'userName' | 'userEmail'>,
  isRtl: boolean,
) {
  if (event.userName) return event.userName;
  if (event.userEmail) return event.userEmail;
  return isRtl ? `طالب #${event.userId}` : `Student #${event.userId}`;
}

export default function AdminEngagement() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [selectedAction, setSelectedAction] = useState<EventSelection | null>(null);
  const [recentEventsPage, setRecentEventsPage] = useState(0);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const { data: summary7, isLoading: l7 } = trpc.engagement.summary.useQuery({ days: 7 });
  const { data: summary30, isLoading: l30 } = trpc.engagement.summary.useQuery({ days: 30 });

  const loading = l7 || l30;

  const defaultSelection = useMemo<EventSelection | null>(() => {
    const first7DayType = summary7?.byType?.[0]?.eventType;
    if (first7DayType) return { eventType: first7DayType, days: 7 };

    const first30DayType = summary30?.byType?.[0]?.eventType;
    return first30DayType ? { eventType: first30DayType, days: 30 } : null;
  }, [summary7?.byType, summary30?.byType]);

  const activeSelection = selectedAction ?? defaultSelection;
  const activeCopy = activeSelection ? getEventCopy(activeSelection.eventType) : null;
  const activeSelectionKey = activeSelection
    ? `${activeSelection.days}:${activeSelection.eventType}`
    : 'none';

  const { data: eventUsers, isLoading: eventUsersLoading } = trpc.engagement.eventUsers.useQuery(
    activeSelection
      ? {
        days: activeSelection.days,
        eventType: activeSelection.eventType,
        search: studentSearch || undefined,
        limit: RECENT_EVENTS_PAGE_SIZE,
        offset: recentEventsPage * RECENT_EVENTS_PAGE_SIZE,
      }
      : undefined,
    { enabled: !!activeSelection },
  );
  const eventUserItems = eventUsers?.items ?? [];
  const eventUsersTotalStudents = eventUsers?.totalStudents ?? 0;
  const eventUsersTotalActions = eventUsers?.totalActions ?? 0;
  const recentTotalPages = Math.max(1, Math.ceil(eventUsersTotalStudents / RECENT_EVENTS_PAGE_SIZE));

  useEffect(() => {
    setRecentEventsPage(0);
  }, [activeSelectionKey, studentSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStudentSearch(studentSearchInput.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [studentSearchInput]);

  useEffect(() => {
    if (recentEventsPage > recentTotalPages - 1) {
      setRecentEventsPage(Math.max(0, recentTotalPages - 1));
    }
  }, [recentEventsPage, recentTotalPages]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            {isRtl ? 'تفاعل الطلاب' : 'Student Engagement'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRtl
              ? 'سلوك الطلاب داخل المنصة فقط، بشكل منفصل عن مراقبة أنشطة الفريق.'
              : 'Student actions inside the platform, kept separate from team activity monitoring.'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                icon={<Users className="w-4 h-4 text-amber-500" />}
                label={isRtl ? 'طلاب متفاعلون (30 يوم)' : 'Active Students (30d)'}
                value={summary30?.uniqueUsers ?? 0}
              />
              <SummaryCard
                icon={<Users className="w-4 h-4 text-amber-500" />}
                label={isRtl ? 'طلاب متفاعلون (7 أيام)' : 'Active Students (7d)'}
                value={summary7?.uniqueUsers ?? 0}
              />
              <SummaryCard
                icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
                label={isRtl ? 'إجمالي الإجراءات (30 يوم)' : 'Total Actions (30d)'}
                value={summary30?.totalEvents ?? 0}
              />
              <SummaryCard
                icon={<Activity className="w-4 h-4 text-emerald-500" />}
                label={isRtl ? 'إجمالي الإجراءات (7 أيام)' : 'Total Actions (7d)'}
                value={summary7?.totalEvents ?? 0}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <BreakdownPanel
                title={isRtl ? 'أهم إجراءات الطلاب خلال 30 يوم' : 'Top Student Actions in 30 Days'}
                emptyLabel={isRtl ? 'لا توجد إجراءات طلابية خلال آخر 30 يوم.' : 'No student actions in the last 30 days.'}
                days={30}
                data={summary30?.byType || []}
                activeSelection={activeSelection}
                isRtl={isRtl}
                onSelect={setSelectedAction}
              />
              <BreakdownPanel
                title={isRtl ? 'أهم إجراءات الطلاب خلال 7 أيام' : 'Top Student Actions in 7 Days'}
                emptyLabel={isRtl ? 'لا توجد إجراءات طلابية خلال آخر 7 أيام.' : 'No student actions in the last 7 days.'}
                days={7}
                data={summary7?.byType || []}
                activeSelection={activeSelection}
                isRtl={isRtl}
                onSelect={setSelectedAction}
              />
            </div>

            <div className="bg-white border rounded-xl p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {activeCopy
                      ? (isRtl
                        ? `الطلاب حسب الإجراء: ${activeCopy.labelAr}`
                        : `Students by Action: ${activeCopy.labelEn}`)
                      : (isRtl ? 'الطلاب حسب الإجراء' : 'Students by Action')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {activeCopy
                      ? (isRtl
                        ? `${activeCopy.descriptionAr} خلال آخر ${activeSelection?.days} ${activeSelection?.days === 7 ? 'أيام' : 'يوماً'}`
                        : `${activeCopy.descriptionEn} in the last ${activeSelection?.days} days`)
                      : (isRtl
                        ? 'اختر نوع إجراء من الأعلى لعرض ما قام به الطلاب فعلياً.'
                        : 'Choose an action type above to inspect what students actually did.')}
                  </p>
                  {activeSelection && !eventUsersLoading ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isRtl
                        ? `${eventUsersTotalActions.toLocaleString()} إجراء من ${eventUsersTotalStudents.toLocaleString()} طلاب`
                        : `${eventUsersTotalActions.toLocaleString()} actions from ${eventUsersTotalStudents.toLocaleString()} students`}
                    </p>
                  ) : null}
                </div>
                {activeSelection ? (
                  <div className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium border border-emerald-100 self-start">
                    {isRtl
                      ? `آخر ${activeSelection.days === 7 ? '7 أيام' : '30 يوم'}`
                      : `Last ${activeSelection.days} days`}
                  </div>
                ) : null}
              </div>

              {activeSelection ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={studentSearchInput}
                      onChange={(event) => setStudentSearchInput(event.target.value)}
                      placeholder={isRtl ? 'بحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email, or phone...'}
                      className="ps-9 pe-9"
                    />
                    {studentSearchInput ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2"
                        onClick={() => {
                          setStudentSearchInput('');
                          setStudentSearch('');
                        }}
                        aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {studentSearch
                      ? (isRtl
                        ? `${eventUsersTotalStudents.toLocaleString()} طلاب مطابقين`
                        : `${eventUsersTotalStudents.toLocaleString()} matching students`)
                      : null}
                  </span>
                </div>
              ) : null}

              {!activeSelection ? (
                <p className="text-sm text-muted-foreground py-6">
                  {isRtl
                    ? 'لا توجد بيانات كافية لعرض تفاصيل الإجراءات بعد.'
                    : 'There is not enough data yet to show action details.'}
                </p>
              ) : eventUsersLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                </div>
              ) : !eventUserItems.length ? (
                <p className="text-sm text-muted-foreground py-6">
                  {studentSearch
                    ? (isRtl
                      ? 'لا يوجد طلاب مطابقون لهذا البحث ضمن الإجراء والفترة المحددين.'
                      : 'No students match this search for the selected action and timeframe.')
                    : (isRtl
                      ? 'لا توجد إجراءات مطابقة لهذا النوع في الفترة المحددة.'
                      : 'No matching student actions were found for this timeframe.')}
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {eventUserItems.map((student) => (
                      <div key={student.userId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{getStudentIdentity(student, isRtl)}</p>
                            {student.userEmail && student.userName ? (
                              <p className="text-xs text-muted-foreground truncate">{student.userEmail}</p>
                            ) : null}
                            {student.userPhone ? (
                              <p className="text-xs text-muted-foreground truncate">{student.userPhone}</p>
                            ) : null}
                            <p className="text-sm text-slate-700 leading-6">
                              {isRtl
                                ? `${student.actionCount.toLocaleString()} إجراء: ${activeCopy?.labelAr ?? 'نشاط طلابي'}`
                                : `${student.actionCount.toLocaleString()} actions: ${activeCopy?.labelEn ?? 'Student activity'}`}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0 md:text-end">
                            <p>{isRtl ? 'آخر نشاط' : 'Last activity'}</p>
                            <p>
                              {formatLocalizedDateTime(student.lastEventAt, language, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <RecentEventsPagination
                    page={recentEventsPage}
                    pageSize={RECENT_EVENTS_PAGE_SIZE}
                    totalItems={eventUsersTotalStudents}
                    totalPages={recentTotalPages}
                    isRtl={isRtl}
                    onPageChange={setRecentEventsPage}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function RecentEventsPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  isRtl,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  isRtl: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);
  const isFirstPage = page <= 0;
  const isLastPage = page >= totalPages - 1;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {isRtl
          ? `عرض ${start.toLocaleString()}-${end.toLocaleString()} من ${totalItems.toLocaleString()}`
          : `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${totalItems.toLocaleString()}`}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page - 1)}
            disabled={isFirstPage}
            aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <span className="min-w-16 text-center text-sm text-muted-foreground tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page + 1)}
            disabled={isLastPage}
            aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
          >
            {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border rounded-xl px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-2">
        {icon}
        <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{label}</p>
    </div>
  );
}

function BreakdownPanel({
  title,
  emptyLabel,
  days,
  data,
  activeSelection,
  isRtl,
  onSelect,
}: {
  title: string;
  emptyLabel: string;
  days: 7 | 30;
  data: EngagementSummaryItem[];
  activeSelection: EventSelection | null;
  isRtl: boolean;
  onSelect: (selection: EventSelection) => void;
}) {
  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">{title}</h3>

      {!data.length ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {data.map((item) => {
            const copy = getEventCopy(item.eventType);
            const selected = activeSelection?.eventType === item.eventType && activeSelection.days === days;

            return (
              <button
                key={`${days}-${item.eventType}`}
                type="button"
                onClick={() => onSelect({ eventType: item.eventType, days })}
                className={[
                  'w-full rounded-xl border px-3 py-3 text-start transition-colors',
                  selected
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={selected ? 'text-emerald-600 mt-0.5' : 'text-slate-500 mt-0.5'}>
                      {copy.icon()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{isRtl ? copy.labelAr : copy.labelEn}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isRtl
                          ? `${Number(item.uniqueUsers).toLocaleString()} طلاب`
                          : `${Number(item.uniqueUsers).toLocaleString()} students`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">{Number(item.count).toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl ? 'إجراء' : 'actions'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
