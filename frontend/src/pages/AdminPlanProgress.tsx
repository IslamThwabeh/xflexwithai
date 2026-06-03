import { useMemo, useState } from 'react';
import { Download, GraduationCap, Loader2, Search, UserRound } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import AdminClientProfileSheet from '@/components/admin/AdminClientProfileSheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTablePagination, useDataTable } from '@/components/DataTable';

function formatDateValue(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getLearningStatus(row: any) {
  if (!row.hasEnrollment) return 'not_enrolled';
  if ((row.progressPercentage || 0) >= 100) return 'completed';
  if ((row.progressPercentage || 0) > 0) return 'in_progress';
  return 'not_started';
}

function getStatusLabel(status: string, isRtl: boolean) {
  switch (status) {
    case 'completed':
      return isRtl ? 'مكتمل' : 'Completed';
    case 'in_progress':
      return isRtl ? 'قيد التقدم' : 'In Progress';
    case 'not_started':
      return isRtl ? 'لم يبدأ' : 'Not Started';
    default:
      return isRtl ? 'بدون تسجيل' : 'No Enrollment';
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'in_progress':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'not_started':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function AdminPlanProgress() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const locale = isRtl ? 'ar-EG' : 'en-US';
  const { data: rows, isLoading } = trpc.reports.learningProgress.useQuery();
  const [search, setSearch] = useState('');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const list = (rows as any[] | undefined) ?? [];
    const query = search.trim().toLowerCase();

    return list
      .filter((row) => {
        if (!query) return true;
        return [row.userName, row.userEmail, row.userPhone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const rank = (row: any) => {
          switch (getLearningStatus(row)) {
            case 'in_progress':
              return 0;
            case 'not_started':
              return 1;
            case 'completed':
              return 2;
            default:
              return 3;
          }
        };

        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;

        const progressDiff = (b.progressPercentage || 0) - (a.progressPercentage || 0);
        if (progressDiff !== 0) return progressDiff;

        return (a.userName || '').localeCompare(b.userName || '');
      });
  }, [rows, search]);

  const stats = useMemo(() => {
    const list = (rows as any[] | undefined) ?? [];
    return {
      totalClients: list.length,
      enrolled: list.filter((row) => row.hasEnrollment).length,
      inProgress: list.filter((row) => getLearningStatus(row) === 'in_progress').length,
      completed: list.filter((row) => getLearningStatus(row) === 'completed').length,
    };
  }, [rows]);

  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    changePageSize,
  } = useDataTable(filtered, undefined, 12);

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Client', 'Email', 'Phone', 'Status', 'Course', 'Progress %', 'Completed Lessons', 'Total Lessons', 'Enrolled At', 'Completed At', 'Last Sign In'];
    const csv = [
      headers.join(','),
      ...filtered.map((row) => [
        row.userName || '',
        row.userEmail || '',
        row.userPhone || '',
        getStatusLabel(getLearningStatus(row), false),
        row.courseTitleEn || 'No Enrollment',
        row.progressPercentage || 0,
        row.completedEpisodes || 0,
        row.totalEpisodes || 0,
        row.enrolledAt || '',
        row.completedAt || '',
        row.lastSignedIn || '',
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learning-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
              {isRtl ? 'متابعة التعلم' : 'Learning Progress'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRtl
                ? 'تقدم الطلاب في الدورة التعليمية الفعلية داخل المنصة'
                : 'Real student progress across the academy learning course'}
            </p>
          </div>

          <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filtered.length}>
            <Download className="me-2 h-4 w-4" />
            {isRtl ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border bg-white px-3 py-3 text-center">
            <p className="text-lg font-bold text-slate-900">{stats.totalClients}</p>
            <p className="text-xs text-muted-foreground">{isRtl ? 'إجمالي العملاء' : 'Total Clients'}</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-center">
            <p className="text-lg font-bold text-teal-700">{stats.enrolled}</p>
            <p className="text-xs text-teal-700">{isRtl ? 'مسجلون في الدورة' : 'Enrolled'}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center">
            <p className="text-lg font-bold text-amber-700">{stats.inProgress}</p>
            <p className="text-xs text-amber-700">{isRtl ? 'قيد التقدم' : 'In Progress'}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
            <p className="text-lg font-bold text-emerald-700">{stats.completed}</p>
            <p className="text-xs text-emerald-700">{isRtl ? 'مكتملون' : 'Completed'}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isRtl ? 'ابحث بالاسم أو الإيميل أو الهاتف' : 'Search by name, email, or phone'}
            className="ps-9"
          />
        </div>

        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white px-4 py-16 text-center text-muted-foreground">
            {search
              ? (isRtl ? 'لا يوجد عملاء يطابقون البحث' : 'No clients match this search')
              : (isRtl ? 'لا توجد بيانات تعلم بعد' : 'No learning data yet')}
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((row: any) => {
              const status = getLearningStatus(row);
              const progress = Math.max(0, Math.min(100, Number(row.progressPercentage) || 0));
              const courseLabel = isRtl
                ? (row.courseTitleAr || row.courseTitleEn || 'لا يوجد تسجيل في الدورة بعد')
                : (row.courseTitleEn || row.courseTitleAr || 'No course enrollment yet');

              return (
                <div key={row.userId} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900">{row.userName}</h2>
                        <Badge variant="outline" className={getStatusClasses(status)}>
                          {getStatusLabel(status, isRtl)}
                        </Badge>
                        {row.courseCount > 1 && (
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                            {isRtl ? `${row.courseCount} دورات` : `${row.courseCount} courses`}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span dir="ltr">{row.userEmail}</span>
                        {row.userPhone && <span dir="ltr">{row.userPhone}</span>}
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{isRtl ? 'الدورة:' : 'Course:'}</span>{' '}
                        {courseLabel}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>{isRtl ? 'نسبة التقدم' : 'Progress'}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>
                            {isRtl ? 'الدروس المكتملة:' : 'Completed lessons:'}{' '}
                            <span className="font-semibold text-slate-900">{row.completedEpisodes || 0}</span>
                          </span>
                          <span>
                            {isRtl ? 'إجمالي الدروس:' : 'Total lessons:'}{' '}
                            <span className="font-semibold text-slate-900">{row.totalEpisodes || 0}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>{isRtl ? 'تاريخ التسجيل:' : 'Enrolled:'} {formatDateValue(row.enrolledAt, locale)}</span>
                        <span>{isRtl ? 'تاريخ الإكمال:' : 'Completed:'} {formatDateValue(row.completedAt, locale)}</span>
                        <span>{isRtl ? 'آخر دخول:' : 'Last sign in:'} {formatDateValue(row.lastSignedIn, locale)}</span>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => setProfileUserId(row.userId)}>
                      <UserRound className="me-2 h-4 w-4" />
                      {isRtl ? 'فتح الملف' : 'Open Profile'}
                    </Button>
                  </div>
                </div>
              );
            })}

            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalItems={totalItems}
              setPage={setPage}
              changePageSize={changePageSize}
              isRtl={isRtl}
            />
          </div>
        )}

        <AdminClientProfileSheet
          userId={profileUserId}
          open={profileUserId != null}
          onOpenChange={(open) => {
            if (!open) {
              setProfileUserId(null);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
