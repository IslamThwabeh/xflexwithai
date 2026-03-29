import { trpc } from '@/lib/trpc';
import { printReport } from '@/lib/printReport';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Download, DollarSign, TrendingUp, Key, Package, FileText } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminRevenueReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data, isLoading } = trpc.reports.revenue.useQuery();

  const fmt = (dollars: number) => `$${dollars.toFixed(2)}`;

  const avgKeyValue = (data?.totalKeySales || 0) > 0
    ? (data?.totalRevenue || 0) / (data?.totalKeySales || 1)
    : 0;

  const exportCSV = () => {
    if (!data?.recentActivations?.length) return;
    const headers = ['Key Code', 'User', 'Email', 'Package', 'Price ($)', 'Upgrade', 'Renewal', 'Activated'];
    const rows = data.recentActivations.map((a: any) => [
      a.keyCode, a.userName || '', a.userEmail || '',
      a.packageName || '', a.price?.toFixed(2) || '0',
      a.isUpgrade ? 'Yes' : 'No', a.isRenewal ? 'Yes' : 'No',
      a.activatedAt ? new Date(a.activatedAt).toLocaleDateString() : '',
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
        <Button onClick={exportCSV} variant="outline" size="sm">
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
            <DollarSign className="w-5 h-5" />
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
        <h2 className="text-lg font-bold mb-4">{isRtl ? 'آخر التفعيلات' : 'Recent Key Activations'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'المفتاح' : 'Key'}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'المستخدم' : 'User'}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'الباقة' : 'Package'}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.recentActivations?.map((a: any) => (
                <tr key={a.id} className="hover:bg-muted/30">
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
              {(!data?.recentActivations || data.recentActivations.length === 0) && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد تفعيلات' : 'No activations found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
