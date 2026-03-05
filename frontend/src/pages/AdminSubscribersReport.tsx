import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Users, Filter } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminSubscribersReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: subscribers, isLoading } = trpc.reports.subscribers.useQuery();
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

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
            <Users className="w-6 h-6 text-blue-600" />
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
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الإيميل' : 'Email'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الهاتف' : 'Phone'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'المدينة' : 'City'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'البلد' : 'Country'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'تاريخ التسجيل' : 'Registered'}</th>
                <th className="px-3 py-3 text-center font-medium">{isRtl ? 'الطلبات' : 'Orders'}</th>
                <th className="px-3 py-3 text-center font-medium">{isRtl ? 'الإنفاق' : 'Spent'}</th>
                <th className="px-3 py-3 text-start font-medium">{isRtl ? 'الباقات النشطة' : 'Active Packages'}</th>
                <th className="px-3 py-3 text-center font-medium">{isRtl ? 'التجديدات' : 'Renewals'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered?.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">{s.name || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground" dir="ltr">{s.email}</td>
                  <td className="px-3 py-2.5" dir="ltr">{s.phone || '—'}</td>
                  <td className="px-3 py-2.5">{s.city || '—'}</td>
                  <td className="px-3 py-2.5">{s.country || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">{s.completedOrders}</td>
                  <td className="px-3 py-2.5 text-center font-medium text-green-700">
                    ${((s.totalSpent || 0) / 100).toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5">
                    {(s.activePackages || []).length > 0
                      ? s.activePackages.map((p: string, i: number) => (
                          <span key={i} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full me-1 mb-1">{p}</span>
                        ))
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {s.renewalCount > 0
                      ? <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{s.renewalCount}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
              {filtered?.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد نتائج' : 'No results found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
