import { useMemo, useState } from 'react';
import { Download, Key, Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTablePagination, SortableHeader, useDataTable, zebraRow } from '@/components/DataTable';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { trpc } from '@/lib/trpc';

const sortFns: Record<string, (a: any, b: any) => number> = {
  key: (a, b) => (a.keyCode || '').localeCompare(b.keyCode || ''),
  user: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
  package: (a, b) => (a.packageName || '').localeCompare(b.packageName || ''),
  date: (a, b) => new Date(a.activatedAt || 0).getTime() - new Date(b.activatedAt || 0).getTime(),
};

function activationType(activation: any) {
  if (activation.isUpgrade) return 'upgrade';
  if (activation.isRenewal) return 'renewal';
  return 'new';
}

export default function AdminRevenueReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data, isLoading } = trpc.reports.activationActivity.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [search, setSearch] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'new' | 'upgrade' | 'renewal'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const activations = useMemo(() => data?.activations ?? [], [data?.activations]);
  const packages = useMemo(() => Array.from(new Set(activations.map((item: any) => isRtl ? item.packageNameAr || item.packageName : item.packageName || item.packageNameAr).filter(Boolean))).sort() as string[], [activations, isRtl]);
  const months = useMemo(() => Array.from(new Set(activations.map((item: any) => String(item.activatedAt || '').slice(0, 7)).filter(Boolean))).sort().reverse() as string[], [activations]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activations.filter((item: any) => {
      const packageName = isRtl ? item.packageNameAr || item.packageName : item.packageName || item.packageNameAr;
      return (!term || [item.keyCode, item.packageName, item.packageNameAr].filter(Boolean).some(value => String(value).toLowerCase().includes(term)))
        && (!packageFilter || packageName === packageFilter)
        && (typeFilter === 'all' || activationType(item) === typeFilter)
        && (!monthFilter || String(item.activatedAt || '').startsWith(monthFilter));
    });
  }, [activations, isRtl, monthFilter, packageFilter, search, typeFilter]);
  const counts = useMemo(() => ({
    total: filtered.length,
    new: filtered.filter((item: any) => activationType(item) === 'new').length,
    renewal: filtered.filter((item: any) => activationType(item) === 'renewal').length,
    upgrade: filtered.filter((item: any) => activationType(item) === 'upgrade').length,
  }), [filtered]);
  const table = useDataTable(filtered, sortFns);

  const exportCsv = () => {
    const rows = [
      ['Key ID', 'Package', 'Type', 'Activated at'],
      ...filtered.map((item: any) => [item.id, item.packageName || item.packageNameAr || '', activationType(item), item.activatedAt || '']),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `activation-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <DashboardLayout><main className="space-y-6 p-4 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Key className="h-6 w-6 text-blue-700" />{isRtl ? 'نشاط تفعيل المفاتيح' : 'Key Activation Activity'}</h1><p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'تقرير تشغيلي للوصول إلى الخدمات، وليس تقرير إيرادات أو إثبات دفع.' : 'Operational access activity—not a revenue report or proof of payment.'}</p></div><Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="me-2 h-4 w-4" />{isRtl ? 'تصدير النشاط CSV' : 'Export activity CSV'}</Button></header>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">{isRtl ? 'لا تدخل أسعار المفاتيح أو تواريخ التفعيل في لوحة الإدارة المالية. مصدر الأرقام المالية هو دفتر الحركات المعتمد حسب تاريخ الدفع أو الاسترداد.' : 'Key prices and activation dates do not enter the Financial Dashboard. Financial figures come only from the approved ledger using payment or refund dates.'}</div>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['total', isRtl ? 'كل التفعيلات' : 'All activations'], ['new', isRtl ? 'جديد' : 'New'], ['renewal', isRtl ? 'تجديد' : 'Renewal'], ['upgrade', isRtl ? 'ترقية' : 'Upgrade']].map(([key, label]) => <div key={key} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{counts[key as keyof typeof counts]}</p></div>)}</section>
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_160px_160px]"><div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={search} onChange={event => setSearch(event.target.value)} placeholder={isRtl ? 'بحث بالمفتاح أو الباقة...' : 'Search key or package...'} /></div><select className="h-9 rounded-md border bg-background px-3 text-sm" value={packageFilter} onChange={event => setPackageFilter(event.target.value)}><option value="">{isRtl ? 'كل الباقات' : 'All packages'}</option>{packages.map(name => <option key={name}>{name}</option>)}</select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)}><option value="all">{isRtl ? 'كل الأنواع' : 'All types'}</option><option value="new">{isRtl ? 'جديد' : 'New'}</option><option value="renewal">{isRtl ? 'تجديد' : 'Renewal'}</option><option value="upgrade">{isRtl ? 'ترقية' : 'Upgrade'}</option></select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="">{isRtl ? 'كل الأشهر' : 'All months'}</option>{months.map(month => <option key={month}>{month}</option>)}</select></div>
      {data?.truncated && <p className="mb-3 text-xs text-amber-700">{isRtl ? 'يعرض آخر 500 تفعيل لحماية استهلاك قاعدة البيانات.' : 'Showing the latest 500 activations to protect database usage.'}</p>}
      {isLoading ? <p className="py-10 text-center text-muted-foreground">{isRtl ? 'جاري التحميل...' : 'Loading...'}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start"><SortableHeader label={isRtl ? 'المفتاح' : 'Key'} sortKey="key" currentSortKey={table.sortKey} currentSortDir={table.sortDir} onSort={table.handleSort} /></th><th className="px-3 py-2 text-start"><SortableHeader label={isRtl ? 'الباقة' : 'Package'} sortKey="package" currentSortKey={table.sortKey} currentSortDir={table.sortDir} onSort={table.handleSort} /></th><th className="px-3 py-2 text-center">{isRtl ? 'النوع' : 'Type'}</th><th className="px-3 py-2 text-start"><SortableHeader label={isRtl ? 'تاريخ التفعيل' : 'Activation date'} sortKey="date" currentSortKey={table.sortKey} currentSortDir={table.sortDir} onSort={table.handleSort} /></th></tr></thead><tbody className="divide-y">{table.paged.map((item: any, index) => <tr key={item.id} className={zebraRow(index)}><td className="px-3 py-2 font-mono text-xs">{item.keyCode}</td><td className="px-3 py-2">{isRtl ? item.packageNameAr || item.packageName : item.packageName || item.packageNameAr}</td><td className="px-3 py-2 text-center">{activationType(item) === 'upgrade' ? (isRtl ? 'ترقية' : 'Upgrade') : activationType(item) === 'renewal' ? (isRtl ? 'تجديد' : 'Renewal') : (isRtl ? 'جديد' : 'New')}</td><td className="px-3 py-2">{item.activatedAt ? formatLocalizedDate(item.activatedAt, language) : '—'}</td></tr>)}</tbody></table></div>}
      {!isLoading && table.paged.length === 0 && <p className="py-8 text-center text-muted-foreground">{isRtl ? 'لا توجد تفعيلات.' : 'No activations found.'}</p>}
      <DataTablePagination page={table.page} pageSize={table.pageSize} totalPages={table.totalPages} totalItems={table.totalItems} setPage={table.setPage} changePageSize={table.changePageSize} isRtl={isRtl} />
    </section>
  </main></DashboardLayout>;
}
