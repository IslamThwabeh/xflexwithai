import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { printReport } from '@/lib/printReport';
import { Download, Clock, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  useDataTable,
  DataTablePagination,
  SortableHeader,
  zebraRow,
} from '@/components/DataTable';

const expirySortFns: Record<string, (a: any, b: any) => number> = {
  type: (a, b) => (a.type || '').localeCompare(b.type || ''),
  user: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
  email: (a, b) => (a.userEmail || '').localeCompare(b.userEmail || ''),
  subscription: (a, b) => (a.subscriptionName || '').localeCompare(b.subscriptionName || ''),
  start: (a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime(),
  end: (a, b) => {
    if (a.endDate === 'Lifetime') return 1;
    if (b.endDate === 'Lifetime') return -1;
    return new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime();
  },
};

export default function AdminExpiryReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: subscriptions, isLoading } = trpc.reports.expirations.useQuery();
  const [typeFilter, setTypeFilter] = useState('');

  const now = new Date().toISOString();

  const filtered = useMemo(() => {
    if (!subscriptions) return [];
    let list = subscriptions as any[];
    if (typeFilter) list = list.filter(s => s.type === typeFilter);
    return list;
  }, [subscriptions, typeFilter]);

  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    sortKey,
    sortDir,
    setPage,
    handleSort,
    changePageSize,
  } = useDataTable(filtered, expirySortFns);

  // Stats
  const stats = useMemo(() => {
    if (!subscriptions) return { total: 0, expiringSoon: 0, lifetime: 0, expired: 0 };
    const subs = subscriptions as any[];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
      total: subs.length,
      expiringSoon: subs.filter(s => s.endDate !== 'Lifetime' && s.endDate && s.endDate <= thirtyDaysFromNow && s.endDate > now).length,
      lifetime: subs.filter(s => s.endDate === 'Lifetime').length,
      expired: subs.filter(s => s.endDate !== 'Lifetime' && s.endDate && s.endDate < now).length,
    };
  }, [subscriptions, now]);

  const getExpiryStatus = (endDate: string) => {
    if (endDate === 'Lifetime') return 'lifetime';
    if (!endDate) return 'unknown';
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (endDate < now) return 'expired';
    if (endDate <= sevenDays) return 'critical';
    if (endDate <= thirtyDays) return 'warning';
    return 'active';
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Type', 'User Name', 'Email', 'Phone', 'Subscription', 'Start Date', 'End Date', 'Renewal Due', 'Status'];
    const rows = filtered.map((s: any) => [
      s.type, s.userName, s.userEmail, s.userPhone || '',
      s.subscriptionName, s.startDate || '', s.endDate || '',
      s.renewalDueDate || '', getExpiryStatus(s.endDate),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `subscription_expiry_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const typeLabel = (type: string) => {
    if (isRtl) {
      if (type === 'package') return 'باقة';
      if (type === 'lexai') return 'Lex AI';
      if (type === 'recommendations') return 'توصيات';
      return type;
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-amber-600" />
          {isRtl ? 'تقرير انتهاء الاشتراكات' : 'Subscription Expiry Report'}
        </h1>
        <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filtered?.length}>
          <Download className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير CSV' : 'Export CSV'}
        </Button>
        <Button onClick={() => printReport(isRtl ? 'تقرير انتهاء الاشتراكات' : 'Expiry Report')} variant="outline" size="sm" className="no-print">
          <FileText className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير PDF' : 'Export PDF'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-muted-foreground mt-1">{isRtl ? 'إجمالي الاشتراكات النشطة' : 'Total Active'}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{stats.expiringSoon}</div>
          <div className="text-xs text-amber-600 mt-1">{isRtl ? 'تنتهي خلال 30 يوم' : 'Expiring in 30 days'}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
          <div className="text-xs text-red-600 mt-1">{isRtl ? 'منتهية الصلاحية' : 'Expired'}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.lifetime}</div>
          <div className="text-xs text-green-600 mt-1">{isRtl ? 'مدى الحياة' : 'Lifetime'}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background min-w-[150px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">{isRtl ? 'جميع الأنواع' : 'All Types'}</option>
          <option value="package">{isRtl ? 'باقات' : 'Packages'}</option>
          <option value="lexai">Lex AI</option>
          <option value="recommendations">{isRtl ? 'توصيات' : 'Recommendations'}</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}
        </div>
      ) : (
        <>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'النوع' : 'Type'} sortKey="type" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'المستخدم' : 'User'} sortKey="user" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'الإيميل' : 'Email'} sortKey="email" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الهاتف' : 'Phone'}</th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'الاشتراك' : 'Subscription'} sortKey="subscription" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'تاريخ البدء' : 'Start'} sortKey="start" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
                <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'تاريخ الانتهاء' : 'End'} sortKey="end" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((s: any, i: number) => {
                const status = getExpiryStatus(s.endDate);
                return (
                  <tr key={i} className={zebraRow(i, `hover:bg-muted/30 ${status === 'expired' ? 'bg-red-50/50' : status === 'critical' ? 'bg-amber-50/50' : ''}`)}>
                    <td className="px-3 py-2.5">
                      {status === 'lifetime' && <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />{isRtl ? 'مدى الحياة' : 'Lifetime'}</span>}
                      {status === 'active' && <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{isRtl ? 'نشط' : 'Active'}</span>}
                      {status === 'warning' && <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{isRtl ? 'قريب الانتهاء' : 'Expiring Soon'}</span>}
                      {status === 'critical' && <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{isRtl ? 'حرج' : 'Critical'}</span>}
                      {status === 'expired' && <span className="inline-flex items-center gap-1 text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded-full">{isRtl ? 'منتهي' : 'Expired'}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{typeLabel(s.type)}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-sm">{s.userName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs" dir="ltr">{s.userEmail}</td>
                    <td className="px-3 py-2.5 text-xs" dir="ltr">{s.userPhone || '—'}</td>
                    <td className="px-3 py-2.5 text-sm">{s.subscriptionName}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium">
                      {s.endDate === 'Lifetime' ? (isRtl ? '∞ مدى الحياة' : '∞ Lifetime') :
                        s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد اشتراكات' : 'No subscriptions found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          setPage={setPage}
          changePageSize={changePageSize}
          isRtl={isRtl}
        />
        </>
      )}
    </div>
    </DashboardLayout>
  );
}
