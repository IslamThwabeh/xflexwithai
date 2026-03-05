import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Download, DollarSign, TrendingUp, CreditCard, Package } from 'lucide-react';

export default function AdminRevenueReport() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data, isLoading } = trpc.reports.revenue.useQuery();

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const totalRevenue = data?.monthlyRevenue?.reduce((s, m) => s + m.revenue, 0) || 0;
  const totalOrders = data?.monthlyRevenue?.reduce((s, m) => s + m.orderCount, 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const exportCSV = () => {
    if (!data?.recentOrders?.length) return;
    const headers = ['Order ID', 'User', 'Email', 'Package', 'Status', 'Total ($)', 'Payment Method', 'Date'];
    const rows = data.recentOrders.map((o: any) => [
      o.id, o.userName, o.userEmail, o.packageNames || '', o.status,
      ((o.totalAmount || 0) / 100).toFixed(2), o.paymentMethod || '', o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-lg" />)}
          </div>
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-600" />
          {isRtl ? 'تقرير الإيرادات والمحاسبة' : 'Revenue & Accounting Report'}
        </h1>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 me-2" />
          {isRtl ? 'تصدير الطلبات CSV' : 'Export Orders CSV'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
          </div>
          <div className="text-3xl font-bold">{fmt(totalRevenue)}</div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'إجمالي الطلبات المكتملة' : 'Total Completed Orders'}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalOrders}</div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <CreditCard className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'متوسط قيمة الطلب' : 'Average Order Value'}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{fmt(avgOrderValue)}</div>
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-lg font-bold mb-4">{isRtl ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</h2>
        {data?.monthlyRevenue?.length ? (
          <div className="space-y-2">
            {data.monthlyRevenue.map((m: any) => {
              const pct = totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-sm font-bold w-24 text-end">{fmt(m.revenue)}</span>
                  <span className="text-xs text-muted-foreground w-16 text-end">{m.orderCount} {isRtl ? 'طلب' : 'orders'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
        )}
      </div>

      {/* Revenue by Package + Payment Method side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Package */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">{isRtl ? 'الإيرادات حسب الباقة' : 'Revenue by Package'}</h2>
          {data?.packageRevenue?.length ? (
            <div className="space-y-3">
              {data.packageRevenue.map((p: any) => (
                <div key={p.packageId} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{p.packageName}</div>
                    <div className="text-xs text-muted-foreground">{p.orderCount} {isRtl ? 'طلب' : 'orders'}</div>
                  </div>
                  <div className="font-bold text-green-700">{fmt(p.revenue)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{isRtl ? 'لا توجد بيانات' : 'No data'}</p>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">{isRtl ? 'طرق الدفع' : 'Payment Methods'}</h2>
          {data?.paymentMethodBreakdown?.length ? (
            <div className="space-y-3">
              {data.paymentMethodBreakdown.map((pm: any) => (
                <div key={pm.method} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm capitalize">{pm.method === 'unknown' ? (isRtl ? 'غير محدد' : 'Unknown') : pm.method}</div>
                    <div className="text-xs text-muted-foreground">{pm.count} {isRtl ? 'عملية' : 'transactions'}</div>
                  </div>
                  <div className="font-bold">{fmt(pm.revenue)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{isRtl ? 'لا توجد بيانات' : 'No data'}</p>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-lg font-bold mb-4">{isRtl ? 'آخر الطلبات' : 'Recent Orders'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-start font-medium">#</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'المستخدم' : 'User'}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'الباقة' : 'Package'}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'المبلغ' : 'Amount'}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isRtl ? 'الدفع' : 'Payment'}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isRtl ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.recentOrders?.map((o: any) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">#{o.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-xs">{o.userName}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{o.userEmail}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{o.packageNames || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.status === 'completed' || o.status === 'paid' ? 'bg-green-100 text-green-800' :
                      o.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-medium">{fmt(o.totalAmount || 0)}</td>
                  <td className="px-3 py-2 text-center text-xs capitalize">{o.paymentMethod || '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {(!data?.recentOrders || data.recentOrders.length === 0) && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {isRtl ? 'لا توجد طلبات' : 'No orders found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
