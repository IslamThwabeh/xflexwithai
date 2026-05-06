import { ReactNode, useMemo, useState } from 'react';

import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDateTime } from '@/lib/dateLocale';
import { trpc } from '@/lib/trpc';
import {
  Activity,
  BookOpen,
  Eye,
  Loader2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  Users,
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

function getStudentIdentity(event: RecentEngagementEvent, isRtl: boolean) {
  if (event.userName) return event.userName;
  if (event.userEmail) return event.userEmail;
  return isRtl ? `طالب #${event.userId}` : `Student #${event.userId}`;
}

export default function AdminEngagement() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [selectedAction, setSelectedAction] = useState<EventSelection | null>(null);

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

  const { data: recentEvents, isLoading: recentLoading } = trpc.engagement.recentEvents.useQuery(
    activeSelection
      ? { days: activeSelection.days, eventType: activeSelection.eventType, limit: 20 }
      : undefined,
    { enabled: !!activeSelection },
  );

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
                        ? `الإجراءات الفعلية: ${activeCopy.labelAr}`
                        : `Recent Actions: ${activeCopy.labelEn}`)
                      : (isRtl ? 'الإجراءات الفعلية للطلاب' : 'Recent Student Actions')}
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
                </div>
                {activeSelection ? (
                  <div className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium border border-emerald-100 self-start">
                    {isRtl
                      ? `آخر ${activeSelection.days === 7 ? '7 أيام' : '30 يوم'}`
                      : `Last ${activeSelection.days} days`}
                  </div>
                ) : null}
              </div>

              {!activeSelection ? (
                <p className="text-sm text-muted-foreground py-6">
                  {isRtl
                    ? 'لا توجد بيانات كافية لعرض تفاصيل الإجراءات بعد.'
                    : 'There is not enough data yet to show action details.'}
                </p>
              ) : recentLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                </div>
              ) : !recentEvents?.length ? (
                <p className="text-sm text-muted-foreground py-6">
                  {isRtl
                    ? 'لا توجد إجراءات مطابقة لهذا النوع في الفترة المحددة.'
                    : 'No matching student actions were found for this timeframe.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((event) => {
                    const highlights = buildEventHighlights(event, isRtl);

                    return (
                      <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{getStudentIdentity(event, isRtl)}</p>
                            {event.userEmail && event.userName ? (
                              <p className="text-xs text-muted-foreground truncate">{event.userEmail}</p>
                            ) : null}
                            <p className="text-sm text-slate-700 leading-6">{describeRecentEvent(event, isRtl)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0">
                            {formatLocalizedDateTime(event.createdAt, language, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>

                        {highlights.length ? (
                          <div className="flex flex-wrap gap-2">
                            {highlights.map((highlight) => (
                              <span
                                key={`${event.id}-${highlight}`}
                                className="inline-flex items-center rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs text-slate-700"
                              >
                                {highlight}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
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
