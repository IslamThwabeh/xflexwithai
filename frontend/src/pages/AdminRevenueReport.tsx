import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { printReport } from '@/lib/printReport';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { formatAdminCurrencyFromUsd } from '@/lib/adminCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Wallet, TrendingUp, Key, FileText, Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { DataTablePagination, SortableHeader, useDataTable, zebraRow } from '@/components/DataTable';

const activationSortFns: Record<string, (a: any, b: any) => number> = {
  key: (a, b) => (a.keyCode || '').localeCompare(b.keyCode || ''),
  user: (a, b) => (a.userName || '').localeCompare(b.userName || ''),
  package: (a, b) => (a.packageName || '').localeCompare(b.packageName || ''),
  price: (a, b) => (a.price || 0) - (b.price || 0),
  date: (a, b) => new Date(a.activatedAt || 0).getTime() - new Date(b.activatedAt || 0).getTime(),
};

function getActivationType(activation: any) {
  if (activation.isUpgrade) return 'upgrade';
  if (activation.isRenewal) return 'renewal';
  return 'new';
}

export default function AdminRevenueReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data, isLoading } = trpc.reports.revenue.useQuery();
  const [search, setSearch] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'new' | 'upgrade' | 'renewal'>('all');
  const [monthFilter, setMonthFilter] = useState('');

  const fmt = (dollars: number) => formatAdminCurrencyFromUsd(dollars, language);

  const avgKeyValue = (data?.totalKeySales || 0) > 0
    ? (data?.totalRevenue || 0) / (data?.totalKeySales || 1)
    : 0;

  const activations = useMemo(() => data?.recentActivations ?? [], [data?.recentActivations]);
  const packages = useMemo(() => {
    const names = new Set<string>();
    for (const activation of activations) {
      const name = isRtl
        ? activation.packageNameAr || activation.packageName
        : activation.packageName || activation.packageNameAr;
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [activations, isRtl]);
  const months = useMemo(() => {
    const values = new Set<string>();
    for (const activation of activations) {
      if (activation.activatedAt) values.add(String(activation.activatedAt).slice(0, 7));
    }
    return Array.from(values).sort().reverse();
  }, [activations]);
  const filteredActivations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activations.filter((activation: any) => {
      const localizedPackage = isRtl
        ? activation.packageNameAr || activation.packageName
        : activation.packageName || activation.packageNameAr;
      const matchesSearch = !query || [
        activation.keyCode,
        activation.userName,
        activation.userEmail,
        activation.packageName,
        activation.packageNameAr,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesPackage = !packageFilter || localizedPackage === packageFilter;
      const matchesType = typeFilter === 'all' || getActivationType(activation) === typeFilter;
      const matchesMonth = !monthFilter || String(activation.activatedAt || '').startsWith(monthFilter);

      return matchesSearch && matchesPackage && matchesType && matchesMonth;
    });
  }, [activations, isRtl, monthFilter, packageFilter, search, typeFilter]);

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
  } = useDataTable(filteredActivations, activationSortFns);

  const exportCSV = () => {
    if (!filteredActivations.length) return;
    const headers = ['Key Code', 'User', 'Email', 'Package', 'Price (₪)', 'Upgrade', 'Renewal', 'Activated'];
    const rows = filteredActivations.map((a: any) => [
      a.keyCode, a.userName || '', a.userEmail || '',
      a.packageName || '', fmt(a.price || 0),
      a.isUpgrade ? 'Yes' : 'No', a.isRenewal ? 'Yes' : 'No',
      a.activatedAt ? formatLocalizedDate(a.activatedAt, language) : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-lg" />)}
          </div>
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
        </div>
      </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-600" />
          {isRtl ? 'تقرير الإيرادات والمحاسبة' : 'Revenue & Accounting Report'}
        </h1>
        <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filteredActivations.length}>
          <Download className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير CSV' : 'Export CSV'}
        </Button>
        <Button onClick={() => printReport(isRtl ? 'تقرير الإيرادات' : 'Revenue Report')} variant="outline" size="sm" className="no-print">
          <FileText className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير PDF' : 'Export PDF'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
          </div>
          <div className="text-3xl font-bold">{fmt(data?.totalRevenue || 0)}</div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Key className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'مفاتيح مُفعّلة' : 'Keys Activated'}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{data?.totalKeySales || 0}</div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'متوسط قيمة المفتاح' : 'Avg Key Value'}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{fmt(avgKeyValue)}</div>
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-lg font-bold mb-4">{isRtl ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</h2>
        {data?.monthlyRevenue?.length ? (
          <div className="space-y-2">
            {data.monthlyRevenue.map((m: any) => {
              const maxRevenue = Math.max(...data.monthlyRevenue.map((x: any) => x.revenue), 1);
              const pct = (m.revenue / maxRevenue) * 100;
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-sm font-bold w-24 text-end">{fmt(m.revenue)}</span>
                  <span className="text-xs text-muted-foreground w-16 text-end">{m.count} {isRtl ? 'مفتاح' : 'keys'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
        )}
      </div>

      {/* Revenue by Package */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-lg font-bold mb-4">{isRtl ? 'الإيرادات حسب الباقة' : 'Revenue by Package'}</h2>
        {data?.packageRevenue?.length ? (
          <div className="space-y-3">
            {data.packageRevenue.map((p: any) => (
              <div key={p.packageId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-sm">{isRtl ? (p.packageNameAr || p.packageName) : p.packageName}</div>
                  <div className="text-xs text-muted-foreground">{p.count} {isRtl ? 'مفتاح' : 'keys'}</div>
                </div>
                <div className="font-bold text-green-700">{fmt(p.revenue)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{isRtl ? 'لا توجد بيانات' : 'No data'}</p>
        )}
      </div>

      {/* Recent Key Activations Table */}
      <div className="bg-white border rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-bold">{isRtl ? 'سجل التفعيلات' : 'Activation Ledger'}</h2>
            <p className="text-sm text-muted-foreground">
              {isRtl
                ? `${filteredActivations.length.toLocaleString()} من ${activations.length.toLocaleString()} تفعيل`
                : `${filteredActivations.length.toLocaleString()} of ${activations.length.toLocaleString()} activations`}
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRtl ? 'بحث بالمفتاح أو العميل أو الإيميل...' : 'Search key, client, email...'}
              className="ps-9"
            />
          </div>
          <select
            value={packageFilter}
            onChange={(event) => setPackageFilter(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{isRtl ? 'كل الباقات' : 'All Packages'}</option>
            {packages.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{isRtl ? 'كل الأنواع' : 'All Types'}</option>
            <option value="new">{isRtl ? 'جديد' : 'New'}</option>
            <option value="upgrade">{isRtl ? 'ترقية' : 'Upgrade'}</option>
            <option value="renewal">{isRtl ? 'تجديد' : 'Renewal'}</option>
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{isRtl ? 'كل الأشهر' : 'All Months'}</option>
            {months.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-start font-medium">
                  <SortableHeader label={isRtl ? 'المفتاح' : 'Key'} sortKey="key" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-start font-medium">
                  <SortableHeader label={isRtl ? 'المستخدم' : 'User'} sortKey="user" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-start font-medium">
                  <SortableHeader label={isRtl ? 'الباقة' : 'Package'} sortKey="package" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  <SortableHeader label={isRtl ? 'السعر' : 'Price'} sortKey="price" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2.5 text-start font-medium">
                  <SortableHeader label={isRtl ? 'التاريخ' : 'Date'} sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((a: any, index: number) => (
                <tr key={a.id} className={zebraRow(index, "hover:bg-muted/30")}>
                  <td className="px-3 py-2 font-mono text-xs">{a.keyCode}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-xs">{a.userName || '—'}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{a.userEmail || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{isRtl ? (a.packageNameAr || a.packageName) : (a.packageName || '—')}</td>
                  <td className="px-3 py-2 text-center font-medium">{fmt(a.price || 0)}</td>
                  <td className="px-3 py-2 text-center">
                    {a.isUpgrade ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{isRtl ? 'ترقية' : 'Upgrade'}</span>
                    ) : a.isRenewal ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{isRtl ? 'تجديد' : 'Renewal'}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{isRtl ? 'جديد' : 'New'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {a.activatedAt ? new Date(a.activatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') : '—'}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد تفعيلات' : 'No activations found'}
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
      </div>
    </div>
    </DashboardLayout>
  );
}
