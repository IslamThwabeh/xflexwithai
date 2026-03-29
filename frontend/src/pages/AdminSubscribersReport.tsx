import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { printReport } from '@/lib/printReport';
import { Download, Search, Users, Filter, FileText, SlidersHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useDataTable,
  DataTablePagination,
  SortableHeader,
  zebraRow,
} from '@/components/DataTable';

const subSortFns: Record<string, (a: any, b: any) => number> = {
  name: (a, b) => (a.name || '').localeCompare(b.name || ''),
  email: (a, b) => (a.email || '').localeCompare(b.email || ''),
  city: (a, b) => (a.city || '').localeCompare(b.city || ''),
  country: (a, b) => (a.country || '').localeCompare(b.country || ''),
  registered: (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  orders: (a, b) => (a.completedOrders || 0) - (b.completedOrders || 0),
  spent: (a, b) => (a.totalSpent || 0) - (b.totalSpent || 0),
  renewals: (a, b) => (a.renewalCount || 0) - (b.renewalCount || 0),
};

export default function AdminSubscribersReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: subscribers, isLoading } = trpc.reports.subscribers.useQuery();
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  // Column visibility
  const allColumns = [
    { key: 'name', en: 'Name', ar: 'الاسم' },
    { key: 'email', en: 'Email', ar: 'الإيميل' },
    { key: 'phone', en: 'Phone', ar: 'الهاتف' },
    { key: 'city', en: 'City', ar: 'المدينة' },
    { key: 'country', en: 'Country', ar: 'البلد' },
    { key: 'registered', en: 'Registered', ar: 'تاريخ التسجيل' },
    { key: 'orders', en: 'Orders', ar: 'الطلبات' },
    { key: 'spent', en: 'Spent', ar: 'الإنفاق' },
    { key: 'packages', en: 'Active Packages', ar: 'الباقات النشطة' },
    { key: 'renewals', en: 'Renewals', ar: 'التجديدات' },
  ] as const;
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('adminSubs_visibleCols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(['name', 'email', 'country', 'spent', 'packages', 'renewals']);
  });
  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      localStorage.setItem('adminSubs_visibleCols', JSON.stringify([...next]));
      return next;
    });
  };
  const visibleColCount = visibleCols.size;

  // Package badge colors
  const pkgBadgeClass = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('comprehensive') || lower.includes('شامل'))
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const countries = useMemo(() => {
    if (!subscribers) return [];
    const c = new Set(subscribers.map((s: any) => s.country).filter(Boolean));
    return Array.from(c).sort() as string[];
  }, [subscribers]);

  const filtered = useMemo(() => {
    if (!subscribers) return [];
    return subscribers.filter((s: any) => {
      const matchSearch = !search || 
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.phone || '').includes(search) ||
        (s.city || '').toLowerCase().includes(search.toLowerCase());
      const matchCountry = !countryFilter || s.country === countryFilter;
      return matchSearch && matchCountry;
    });
  }, [subscribers, search, countryFilter]);

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
  } = useDataTable(filtered, subSortFns);

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Name', 'Email', 'Phone', 'City', 'Country', 'Registered', 'Total Orders', 'Total Spent ($)', 'Active Packages', 'Renewals'];
    const rows = filtered.map((s: any) => [
      s.name || '', s.email, s.phone || '', s.city || '', s.country || '',
      s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
      s.completedOrders, ((s.totalSpent || 0) / 100).toFixed(2),
      (s.activePackages || []).join('; '), s.renewalCount,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `subscribers_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            {isRtl ? 'تقرير المشتركين' : 'Subscribers Report'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl ? `${filtered?.length || 0} مشترك` : `${filtered?.length || 0} subscribers`}
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filtered?.length}>
          <Download className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير CSV' : 'Export CSV'}
        </Button>
        <Button onClick={() => printReport(isRtl ? 'تقرير المشتركين' : 'Subscribers Report')} variant="outline" size="sm" className="no-print">
          <FileText className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير PDF' : 'Export PDF'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isRtl ? 'الأعمدة' : 'Columns'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRtl ? 'start' : 'end'} className="w-48">
            <DropdownMenuLabel>{isRtl ? 'إظهار / إخفاء الأعمدة' : 'Toggle Columns'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allColumns.map(col => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleCols.has(col.key)}
                onCheckedChange={() => toggleCol(col.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {isRtl ? col.ar : col.en}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={isRtl ? 'بحث بالاسم، الإيميل، الهاتف، المدينة...' : 'Search by name, email, phone, city...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background min-w-[150px]"
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
        >
          <option value="">{isRtl ? 'جميع البلدان' : 'All Countries'}</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
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
                {visibleCols.has('name') && <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'الاسم' : 'Name'} sortKey="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('email') && <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'الإيميل' : 'Email'} sortKey="email" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('phone') && <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الهاتف' : 'Phone'}</th>}
                {visibleCols.has('city') && <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'المدينة' : 'City'} sortKey="city" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('country') && <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'البلد' : 'Country'} sortKey="country" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('registered') && <th className="px-3 py-3 text-start font-medium"><SortableHeader label={isRtl ? 'تاريخ التسجيل' : 'Registered'} sortKey="registered" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('orders') && <th className="px-3 py-3 text-center font-medium"><SortableHeader label={isRtl ? 'الطلبات' : 'Orders'} sortKey="orders" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('spent') && <th className="px-3 py-3 text-center font-medium"><SortableHeader label={isRtl ? 'الإنفاق' : 'Spent'} sortKey="spent" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
                {visibleCols.has('packages') && <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الباقات النشطة' : 'Active Packages'}</th>}
                {visibleCols.has('renewals') && <th className="px-3 py-3 text-center font-medium"><SortableHeader label={isRtl ? 'التجديدات' : 'Renewals'} sortKey="renewals" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} /></th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((s: any, i: number) => (
                <tr key={s.id} className={zebraRow(i, "hover:bg-muted/30")}>
                  {visibleCols.has('name') && <td className="px-3 py-2.5 font-medium">{s.name || '—'}</td>}
                  {visibleCols.has('email') && <td className="px-3 py-2.5 text-muted-foreground" dir="ltr">{s.email}</td>}
                  {visibleCols.has('phone') && <td className="px-3 py-2.5" dir="ltr">{s.phone || '—'}</td>}
                  {visibleCols.has('city') && <td className="px-3 py-2.5">{s.city || '—'}</td>}
                  {visibleCols.has('country') && <td className="px-3 py-2.5">{s.country || '—'}</td>}
                  {visibleCols.has('registered') && <td className="px-3 py-2.5 text-muted-foreground">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') : '—'}
                  </td>}
                  {visibleCols.has('orders') && <td className="px-3 py-2.5 text-center">{s.completedOrders}</td>}
                  {visibleCols.has('spent') && <td className="px-3 py-2.5 text-center font-medium text-green-700">
                    ${((s.totalSpent || 0) / 100).toFixed(0)}
                  </td>}
                  {visibleCols.has('packages') && <td className="px-3 py-2.5">
                    {(s.activePackages || []).length > 0
                      ? s.activePackages.map((p: string, i: number) => (
                          <span key={i} className={`inline-block text-xs px-2 py-0.5 rounded-full me-1 mb-1 border ${pkgBadgeClass(p)}`}>{p}</span>
                        ))
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>}
                  {visibleCols.has('renewals') && <td className="px-3 py-2.5 text-center">
                    {s.renewalCount > 0
                      ? <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{s.renewalCount}</span>
                      : '—'}
                  </td>}
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={visibleColCount} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد نتائج' : 'No results found'}
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
