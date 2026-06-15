import { useMemo, useState } from 'react';
import { Download, Eye, FileCheck, Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataTable, DataTablePagination } from '@/components/DataTable';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAdminCurrency } from '@/lib/adminCurrency';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { getLegalVersionLinks } from '@/lib/legalVersions';
import { formatPaymentMethodLabel } from '@/lib/paymentMethodLabel';
import { trpc } from '@/lib/trpc';

const orderSortFns: Record<string, (a: any, b: any) => number> = {
  accepted: (a, b) =>
    new Date(String(a.termsAcceptedAt ?? a.createdAt).replace(' ', 'T')).getTime()
    - new Date(String(b.termsAcceptedAt ?? b.createdAt).replace(' ', 'T')).getTime(),
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  awaiting_confirmation: 'bg-orange-100 text-orange-800',
  paid: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'معلق' },
  awaiting_confirmation: { en: 'Awaiting Confirmation', ar: 'بانتظار التأكيد' },
  paid: { en: 'Paid', ar: 'مدفوع' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  refunded: { en: 'Refunded', ar: 'مسترد' },
};

export default function AdminTermsAcceptance() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: orders, isLoading } = trpc.orders.adminList.useQuery(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const acceptedOrders = useMemo(
    () => (orders ?? []).filter((order: any) => order.termsAcceptedAt),
    [orders],
  );
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    for (const order of acceptedOrders as any[]) {
      if (order.status) statuses.add(order.status);
    }
    return Array.from(statuses).sort();
  }, [acceptedOrders]);
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (acceptedOrders as any[]).filter((order) => {
      const matchesSearch = !query || [
        order.id,
        order.userName,
        order.userEmail,
        order.userPhone,
        order.termsAcceptedIpAddress,
        order.termsAcceptedVersion,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = !statusFilter || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [acceptedOrders, search, statusFilter]);
  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    changePageSize,
  } = useDataTable(filteredOrders, orderSortFns);

  const exportCSV = () => {
    if (!filteredOrders.length) return;

    const headers = ['Order ID', 'Status', 'User', 'Email', 'Phone', 'Accepted At', 'Version', 'IP Address', 'User Agent'];
    const rows = filteredOrders.map((order: any) => [
      order.id,
      statusLabels[order.status]?.en || order.status || '',
      order.userName || '',
      order.userEmail || '',
      order.userPhone || '',
      order.termsAcceptedAt || '',
      order.termsAcceptedVersion || '',
      order.termsAcceptedIpAddress || '',
      order.termsAcceptedUserAgent || '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terms-acceptance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold">{isRtl ? 'موافقات الشروط والأحكام' : 'Terms & Conditions Acceptance'}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isRtl
                  ? 'سجل الموافقات المرتبطة بالطلبات، لاستخدامه كدليل عند الحاجة.'
                  : 'Order-linked acceptance records for evidence when needed.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="w-fit bg-emerald-100 text-emerald-800">
              {isRtl
                ? `${filteredOrders.length} / ${acceptedOrders.length} موافقة`
                : `${filteredOrders.length} / ${acceptedOrders.length} acceptances`}
            </Badge>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filteredOrders.length}>
              <Download className="me-2 h-4 w-4" />
              {isRtl ? 'تصدير CSV' : 'Export CSV'}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRtl ? 'بحث بالطلب أو العميل أو الإيميل أو IP' : 'Search order, client, email, or IP'}
              className="ps-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {isRtl ? statusLabels[status]?.ar : statusLabels[status]?.en || status}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-400">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-gray-400">
            {search || statusFilter
              ? (isRtl ? 'لا توجد موافقات تطابق الفلاتر' : 'No acceptance records match these filters')
              : (isRtl ? 'لا توجد موافقات شروط مسجلة بعد' : 'No terms acceptance records yet')}
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((order: any) => {
              const legalLinks = getLegalVersionLinks(order.termsAcceptedVersion);
              return (
              <div key={order.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-gray-900">#{order.id}</h2>
                      <Badge className={`text-xs ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {isRtl ? statusLabels[order.status]?.ar : statusLabels[order.status]?.en || order.status}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {isRtl ? 'تم قبول الشروط' : 'Terms accepted'}
                      </Badge>
                      {order.termsAcceptedVersion && (
                        <Badge variant="outline">{order.termsAcceptedVersion}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.userName || order.userEmail || `User #${order.userId}`}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {order.userEmail || '—'}
                      {order.userPhone ? ` • ${order.userPhone}` : ''}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[620px]">
                    <EvidenceLine
                      label={isRtl ? 'وقت القبول' : 'Accepted At'}
                      value={formatLocalizedDate(String(order.termsAcceptedAt).replace(' ', 'T'), language) || String(order.termsAcceptedAt)}
                    />
                    <EvidenceLine
                      label={isRtl ? 'وقت إنشاء الطلب' : 'Order Created'}
                      value={formatLocalizedDate(String(order.createdAt).replace(' ', 'T'), language) || String(order.createdAt)}
                    />
                    <EvidenceLine
                      label={isRtl ? 'المبلغ' : 'Amount'}
                      value={formatAdminCurrency(order.totalAmount, language, { sourceCurrency: order.currency, fromCents: true })}
                    />
                    <EvidenceLine
                      label={isRtl ? 'طريقة الدفع' : 'Payment'}
                      value={formatPaymentMethodLabel(order.paymentMethod, language)}
                    />
                    <EvidenceLine
                      label={isRtl ? 'عنوان IP' : 'IP Address'}
                      value={order.termsAcceptedIpAddress || '-'}
                    />
                    <EvidenceLine
                      label={isRtl ? 'المتصفح/الجهاز' : 'Browser/Device'}
                      value={order.termsAcceptedUserAgent || '-'}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`/admin/orders`} className="inline-flex items-center">
                      <Eye className="me-1 h-3.5 w-3.5" />
                      {isRtl ? 'فتح الطلبات' : 'Open Orders'}
                    </a>
                  </Button>
                  {order.paymentProofUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                        {isRtl ? 'إيصال الدفع' : 'Payment Proof'}
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <a href={legalLinks.terms} target="_blank" rel="noopener noreferrer">
                      {isRtl ? `الشروط المقبولة ${order.termsAcceptedVersion || 'v1'}` : `Accepted Terms ${order.termsAcceptedVersion || 'v1'}`}
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={legalLinks.refund} target="_blank" rel="noopener noreferrer">
                      {isRtl ? `سياسة الاسترداد ${order.termsAcceptedVersion || 'v1'}` : `Refund Policy ${order.termsAcceptedVersion || 'v1'}`}
                    </a>
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {!isLoading && filteredOrders.length > 0 && (
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={totalItems}
            setPage={setPage}
            changePageSize={changePageSize}
            isRtl={isRtl}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function EvidenceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || '-'}</p>
    </div>
  );
}
