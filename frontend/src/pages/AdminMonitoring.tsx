import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { IDLE_TIMEOUT_STAFF_MS } from '../../../shared/const';
import { Activity, Clock3, Loader2, RefreshCw, ShieldCheck, TimerReset, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const ACTION_LABELS: Record<string, { en: string; ar: string }> = {
  'auth.login': { en: 'Signed in', ar: 'تسجيل دخول' },
  'auth.logout': { en: 'Signed out', ar: 'تسجيل خروج' },
  'supportDashboard.searchClients': { en: 'Searched clients', ar: 'بحث عن عميل' },
  'supportDashboard.clientProgress': { en: 'Opened client progress', ar: 'فتح تقدم العميل' },
  'supportDashboard.clientSubscriptions': { en: 'Opened client subscriptions', ar: 'فتح اشتراكات العميل' },
  'supportDashboard.clientQuizProgress': { en: 'Opened quiz progress', ar: 'فتح تقدم الاختبارات' },
  'supportDashboard.recommendationFeed': { en: 'Reviewed recommendation feed', ar: 'راجع قناة التوصيات' },
  'supportChat.getMessages': { en: 'Opened support thread', ar: 'فتح محادثة دعم' },
  'supportChat.reply': { en: 'Replied in support chat', ar: 'رد في الدعم الفني' },
  'supportChat.clearEscalation': { en: 'Cleared escalation', ar: 'أنهى التصعيد' },
  'lexaiSupport.getCase': { en: 'Opened LexAI case', ar: 'فتح حالة LexAI' },
  'lexaiSupport.addNote': { en: 'Added LexAI note', ar: 'أضاف ملاحظة LexAI' },
  'lexaiSupport.assignCase': { en: 'Assigned LexAI case', ar: 'عيّن حالة LexAI' },
  'lexaiSupport.updateStatus': { en: 'Updated LexAI status', ar: 'حدّث حالة LexAI' },
  'lexaiSupport.updatePriority': { en: 'Updated LexAI priority', ar: 'حدّث أولوية LexAI' },
  'lexaiSupport.requestFollowup': { en: 'Requested LexAI follow-up', ar: 'طلب متابعة LexAI' },
  'recommendations.postMessage': { en: 'Posted recommendation update', ar: 'نشر تحديث توصيات' },
  'recommendations.deleteMessage': { en: 'Deleted recommendation message', ar: 'حذف رسالة توصية' },
};

const ROLE_TRANSLATION_KEYS: Record<string, string> = {
  analyst: 'admin.roles.analyst',
  support: 'admin.roles.support',
  lexai_support: 'admin.roles.lexaiSupport',
  key_manager: 'admin.roles.keyManager',
  plan_manager: 'admin.roles.planManager',
  view_progress: 'admin.roles.viewProgress',
  view_recommendations: 'admin.roles.viewRec',
  view_subscriptions: 'admin.roles.viewSubs',
  view_quizzes: 'admin.roles.viewQuizzes',
  client_lookup: 'admin.roles.clientLookup',
};

const DAYS_OPTIONS = [7, 14, 30, 60];
const STAFF_IDLE_MINUTES = Math.floor(IDLE_TIMEOUT_STAFF_MS / 60000);

const toDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function AdminMonitoring() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const locale = isRtl ? 'ar-EG' : 'en-US';
  const [days, setDays] = useState(14);
  const [staffFilter, setStaffFilter] = useState('all');
  const [sessionStatus, setSessionStatus] = useState<'all' | 'active' | 'closed'>('all');

  const selectedStaffUserId = staffFilter === 'all' ? undefined : Number(staffFilter);

  const summaryQuery = trpc.monitoring.summary.useQuery({ days }, { refetchInterval: 60_000 });
  const actionsQuery = trpc.monitoring.actions.useQuery(
    { days, staffUserId: selectedStaffUserId, limit: 40 },
    { refetchInterval: 60_000 },
  );
  const sessionsQuery = trpc.monitoring.sessions.useQuery(
    { days, staffUserId: selectedStaffUserId, status: sessionStatus, limit: 40 },
    { refetchInterval: 60_000 },
  );
  const staffListQuery = trpc.roles.listStaff.useQuery();

  const summary = summaryQuery.data;
  const breakdown = (summary?.breakdown ?? []) as any[];
  const actions = (actionsQuery.data ?? []) as any[];
  const sessions = (sessionsQuery.data ?? []) as any[];
  const visibleBreakdown = selectedStaffUserId
    ? breakdown.filter((row) => row.staffUserId === selectedStaffUserId)
    : breakdown;
  const activeSessions = useMemo(() => {
    const rows = ((summary?.activeSessions ?? []) as any[]);
    return selectedStaffUserId ? rows.filter((row) => row.staffUserId === selectedStaffUserId) : rows;
  }, [selectedStaffUserId, summary?.activeSessions]);

  const isInitialLoading = summaryQuery.isLoading || actionsQuery.isLoading || sessionsQuery.isLoading || staffListQuery.isLoading;
  const isRefreshing = summaryQuery.isFetching || actionsQuery.isFetching || sessionsQuery.isFetching;

  const refreshAll = async () => {
    await Promise.allSettled([
      summaryQuery.refetch(),
      actionsQuery.refetch(),
      sessionsQuery.refetch(),
      staffListQuery.refetch(),
    ]);
  };

  const formatDateTime = (value: unknown) => {
    const date = toDate(value);
    if (!date) return isRtl ? 'غير متاح' : 'N/A';
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const formatDuration = (seconds: number | null | undefined) => {
    const safeSeconds = Math.max(0, Number(seconds ?? 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);

    if (hours > 0) {
      return isRtl ? `${hours} س ${minutes} د` : `${hours}h ${minutes}m`;
    }
    return isRtl ? `${minutes} د` : `${minutes}m`;
  };

  const formatHours = (seconds: number | null | undefined) => {
    return `${((Number(seconds ?? 0) || 0) / 3600).toFixed(1)}`;
  };

  const formatRoles = (roles: unknown) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      return isRtl ? 'بدون أدوار' : 'No roles';
    }

    return roles
      .map((role) => {
        if (typeof role !== 'string') return null;
        const translationKey = ROLE_TRANSLATION_KEYS[role];
        return translationKey ? t(translationKey) : role.replaceAll('_', ' ');
      })
      .filter((role): role is string => Boolean(role))
      .join(', ');
  };

  const getActionLabel = (actionType: string) => {
    const preset = ACTION_LABELS[actionType];
    if (preset) return isRtl ? preset.ar : preset.en;
    return actionType.replaceAll('.', ' / ');
  };

  const getSessionStatusLabel = (status: string) => {
    if (status === 'timed_out') {
      return isRtl ? 'انتهت تلقائياً' : 'Timed out';
    }
    if (status === 'closed') {
      return isRtl ? 'مغلقة' : 'Closed';
    }
    return isRtl ? 'نشطة' : 'Active';
  };

  const getSessionStatusClassName = (status: string) => {
    if (status === 'timed_out') {
      return 'bg-amber-100 text-amber-700';
    }
    if (status === 'closed') {
      return 'bg-slate-100 text-slate-600';
    }
    return 'bg-emerald-100 text-emerald-700';
  };

  const formatActionDetails = (details: any) => {
    const input = details?.input;
    if (!input || typeof input !== 'object') {
      return isRtl ? 'بدون تفاصيل إضافية' : 'No extra details';
    }

    const serialized = JSON.stringify(input);
    if (!serialized || serialized === '{}') {
      return isRtl ? 'بدون تفاصيل إضافية' : 'No extra details';
    }

    return serialized.length > 150 ? `${serialized.slice(0, 147)}...` : serialized;
  };

  if (isInitialLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              <Activity className="w-6 h-6 text-emerald-600" />
              {isRtl ? 'مراقبة الفريق' : 'Team Monitoring'}
            </h1>
            <p className="text-sm text-slate-500">
              {isRtl
                ? 'متابعة جلسات الموظفين وأهم الإجراءات التي تتم داخل لوحة العمل.'
                : 'Track staff sessions and the main actions they perform across the admin workspace.'}
            </p>
          </div>

          <Button variant="outline" onClick={refreshAll} className="w-full md:w-auto border-slate-200">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRtl ? 'تحديث' : 'Refresh'}
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm text-slate-600">
              <span>{isRtl ? 'الفترة' : 'Window'}</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                {DAYS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {isRtl ? `${value} يوم` : `${value} days`}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-600">
              <span>{isRtl ? 'الموظف' : 'Staff member'}</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={staffFilter}
                onChange={(event) => setStaffFilter(event.target.value)}
              >
                <option value="all">{isRtl ? 'كل الفريق' : 'Entire team'}</option>
                {(staffListQuery.data ?? []).map((staff: any) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name || staff.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-600">
              <span>{isRtl ? 'حالة الجلسة' : 'Session state'}</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={sessionStatus}
                onChange={(event) => setSessionStatus(event.target.value as 'all' | 'active' | 'closed')}
              >
                <option value="all">{isRtl ? 'الكل' : 'All sessions'}</option>
                <option value="active">{isRtl ? 'النشطة الآن' : 'Active now'}</option>
                <option value="closed">{isRtl ? 'المغلقة' : 'Closed'}</option>
              </select>
            </label>

            <div className="col-span-full rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <span className="block font-medium">{isRtl ? 'ملاحظة' : 'Note'}</span>
              <span>
                {isRtl
                  ? `يُعتبر الموظف غير متصل بعد ${STAFF_IDLE_MINUTES} دقيقة بدون نشاط، لذلك لن يبقى ضمن المتصلين الآن إذا ترك الصفحة.`
                  : `Staff are marked offline after ${STAFF_IDLE_MINUTES} minutes without activity, so they drop out of live availability even if they left the page open.`}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
            label={isRtl ? 'المتصلون الآن' : 'Currently online'}
            value={summary?.currentlyOnline ?? 0}
            hint={isRtl ? 'جلسات مفتوحة حالياً' : 'Open sessions right now'}
          />
          <MetricCard
            icon={<Activity className="w-4 h-4 text-teal-600" />}
            label={isRtl ? 'الإجراءات الملتقطة' : 'Tracked actions'}
            value={summary?.totalActions ?? 0}
            hint={isRtl ? `آخر ${days} يوم` : `Last ${days} days`}
          />
          <MetricCard
            icon={<Clock3 className="w-4 h-4 text-amber-600" />}
            label={isRtl ? 'ساعات الجلسات' : 'Session hours'}
            value={formatHours(summary?.totalSessionSeconds)}
            suffix={isRtl ? ' ساعة' : ' h'}
            hint={isRtl ? 'إجمالي الوقت المرصود' : 'Total monitored time'}
          />
          <MetricCard
            icon={<TimerReset className="w-4 h-4 text-orange-500" />}
            label={isRtl ? 'متوسط الجلسة' : 'Average session'}
            value={formatDuration(summary?.averageSessionSeconds)}
            hint={isRtl ? `${summary?.staffWithActivity ?? 0} موظف نشط` : `${summary?.staffWithActivity ?? 0} active staff`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <SectionCard
            title={isRtl ? 'ملخص الفريق' : 'Team breakdown'}
            subtitle={isRtl ? 'ترتيب حسب الوقت المقضي ثم عدد الإجراءات.' : 'Sorted by time spent, then by action count.'}
          >
            {!visibleBreakdown.length ? (
              <EmptyState message={isRtl ? 'لا توجد بيانات خلال هذه الفترة.' : 'No monitoring data in this window.'} />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {visibleBreakdown.map((row: any) => (
                    <div key={row.staffUserId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{row.staffName || row.staffEmail}</div>
                          <div className="break-all text-xs text-slate-500">{row.staffEmail}</div>
                        </div>
                        {row.isOnline && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {isRtl ? 'متصل الآن' : 'Online now'}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-slate-500">{isRtl ? 'الأدوار' : 'Roles'}</div>
                          <div className="mt-1 text-slate-900">{formatRoles(row.roles)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{isRtl ? 'الإجراءات' : 'Actions'}</div>
                          <div className="mt-1 text-slate-900">{Number(row.actionCount).toLocaleString(locale)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{isRtl ? 'الوقت' : 'Time'}</div>
                          <div className="mt-1 text-slate-900">{formatDuration(row.totalSessionSeconds)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{isRtl ? 'آخر نشاط' : 'Last activity'}</div>
                          <div className="mt-1 text-slate-900">{formatDateTime(row.lastActionAt || row.lastLoginAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 text-left font-medium">{isRtl ? 'الموظف' : 'Staff'}</th>
                      <th className="py-2 text-left font-medium">{isRtl ? 'الأدوار' : 'Roles'}</th>
                      <th className="py-2 text-left font-medium">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                      <th className="py-2 text-left font-medium">{isRtl ? 'الوقت' : 'Time'}</th>
                      <th className="py-2 text-left font-medium">{isRtl ? 'آخر نشاط' : 'Last activity'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBreakdown.map((row: any) => (
                      <tr key={row.staffUserId} className="border-b border-slate-100 align-top last:border-b-0">
                        <td className="py-3 pe-3">
                          <div className="font-medium text-slate-900">{row.staffName || row.staffEmail}</div>
                          <div className="text-xs text-slate-500">{row.staffEmail}</div>
                          {row.isOnline && (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {isRtl ? 'متصل الآن' : 'Online now'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pe-3 text-slate-600">{formatRoles(row.roles)}</td>
                        <td className="py-3 pe-3 text-slate-900">{Number(row.actionCount).toLocaleString(locale)}</td>
                        <td className="py-3 pe-3 text-slate-900">
                          <div>{formatDuration(row.totalSessionSeconds)}</div>
                          <div className="text-xs text-slate-500">{isRtl ? `متوسط ${formatDuration(row.averageSessionSeconds)}` : `Avg ${formatDuration(row.averageSessionSeconds)}`}</div>
                        </td>
                        <td className="py-3 text-slate-600">{formatDateTime(row.lastActionAt || row.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard
            title={isRtl ? 'الجلسات المفتوحة الآن' : 'Live sessions'}
            subtitle={isRtl ? 'من ما زال داخل النظام حالياً.' : 'Who is still inside the workspace right now.'}
          >
            {!activeSessions.length ? (
              <EmptyState message={isRtl ? 'لا توجد جلسات مفتوحة الآن.' : 'No live sessions right now.'} compact />
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session: any) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{session.staffName || session.staffEmail}</div>
                        <div className="text-xs text-slate-500">{session.staffEmail}</div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {formatDuration(session.currentDurationSeconds)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500">
                      <div>{isRtl ? 'بدأت:' : 'Started:'} {formatDateTime(session.loginAt)}</div>
                      <div>{isRtl ? 'تنتهي تلقائياً:' : 'Auto timeout:'} {formatDateTime(session.sessionExpiresAt)}</div>
                      {session.ipAddress && <div>{isRtl ? 'IP:' : 'IP:'} {session.ipAddress}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title={isRtl ? 'سجل الجلسات' : 'Session log'}
            subtitle={isRtl ? 'آخر الجلسات خلال الفترة المحددة.' : 'Most recent sessions in the selected window.'}
          >
            {!sessions.length ? (
              <EmptyState message={isRtl ? 'لا توجد جلسات مطابقة.' : 'No matching sessions.'} compact />
            ) : (
              <div className="space-y-3">
                {sessions.map((session: any) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{session.staffName || session.staffEmail}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(session.loginAt)}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getSessionStatusClassName(session.status)}`}>
                        {getSessionStatusLabel(session.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{isRtl ? 'المدة:' : 'Duration:'} {formatDuration(session.currentDurationSeconds)}</span>
                      <span>
                        {session.isActive
                          ? (isRtl ? 'تنتهي تلقائياً:' : 'Auto timeout:')
                          : (isRtl ? 'انتهت:' : 'Ended:')}
                        {' '}
                        {session.isActive
                          ? formatDateTime(session.sessionExpiresAt)
                          : formatDateTime(session.effectiveLogoutAt || session.logoutAt)}
                      </span>
                      {session.lastActiveAt && (
                        <span>{isRtl ? 'آخر نشاط:' : 'Last activity:'} {formatDateTime(session.lastActiveAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={isRtl ? 'آخر الإجراءات' : 'Recent actions'}
            subtitle={isRtl ? 'إجراءات ناجحة وتمت متابعتها للموظفين.' : 'Successful staff actions captured by the monitor.'}
          >
            {!actions.length ? (
              <EmptyState message={isRtl ? 'لا توجد إجراءات مطابقة.' : 'No matching actions.'} compact />
            ) : (
              <div className="space-y-3">
                {actions.map((action: any) => (
                  <div key={action.id} className="rounded-xl border border-slate-200 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{getActionLabel(action.actionType)}</div>
                        <div className="text-xs text-slate-500">{action.staffName || action.staffEmail}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${action.details?.operationType === 'query' ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {action.details?.operationType === 'query'
                            ? (isRtl ? 'استعراض' : 'Review')
                            : (isRtl ? 'تعديل' : 'Change')}
                        </span>
                        <span className="text-[11px] text-slate-500">{formatDateTime(action.createdAt)}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 break-all">{formatActionDetails(action.details)}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
        {value}
        {suffix ?? ''}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Users className="w-4 h-4 text-slate-300 shrink-0" />
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500 ${compact ? 'px-3 py-6' : 'px-4 py-10'}`}>
      {message}
    </div>
  );
}