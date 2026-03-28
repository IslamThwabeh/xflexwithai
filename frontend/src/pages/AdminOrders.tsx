import { useState } from 'react';
import { ShoppingCart, CheckCircle, Clock, XCircle, Eye, ChevronDown, ChevronUp, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { useDataTable, DataTablePagination } from '@/components/DataTable';

const orderSortFns: Record<string, (a: any, b: any) => number> = {
  created: (a, b) => new Date(String(a.createdAt).replace(' ', 'T')).getTime() - new Date(String(b.createdAt).replace(' ', 'T')).getTime(),
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  awaiting_confirmation: 'bg-orange-100 text-orange-800',
  paid: 'bg-blue-100 text-blue-800',
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

export default function AdminOrders() {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const { data: orders, isLoading } = trpc.orders.adminList.useQuery(filter ? { status: filter } : undefined);
  const updateMutation = trpc.orders.adminUpdateStatus.useMutation({
    onSuccess: () => utils.orders.adminList.invalidate(),
  });
  const processUpgradeMutation = trpc.upgrade.process.useMutation({
    onSuccess: () => utils.orders.adminList.invalidate(),
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const allOrders = orders ?? [];
  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    changePageSize,
  } = useDataTable(allOrders, orderSortFns);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    await updateMutation.mutateAsync({
      orderId,
      status: newStatus as any,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الطلبات' : 'Manage Orders'}</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: undefined, label: language === 'ar' ? 'الكل' : 'All' },
            { value: 'pending', label: language === 'ar' ? 'معلق' : 'Pending' },
            { value: 'awaiting_confirmation', label: language === 'ar' ? 'بانتظار التأكيد' : 'Awaiting' },
            { value: 'paid', label: language === 'ar' ? 'مدفوع' : 'Paid' },
            { value: 'completed', label: language === 'ar' ? 'مكتمل' : 'Completed' },
          ].map((f) => (
            <Button
              key={f.value || 'all'}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Orders */}
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : orders?.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            {language === 'ar' ? 'لا توجد طلبات' : 'No orders'}
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((order: any) => (
              <div key={order.id} className="bg-white border rounded-xl shadow-sm">
                <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">#{order.id}</h3>
                      <Badge className={`text-xs ${statusColors[order.status] || 'bg-gray-100'}`}>
                        {language === 'ar' ? statusLabels[order.status]?.ar : statusLabels[order.status]?.en || order.status}
                      </Badge>
                      {order.isGift ? <Badge variant="outline" className="text-xs">🎁 Gift</Badge> : null}
                      {(order as any).isUpgrade ? <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">⬆ Upgrade</Badge> : null}
                    </div>
                    <p className="text-sm text-gray-500">
                      {(order as any).userName || (order as any).userEmail || `User #${order.userId}`}
                      {(order as any).userEmail ? ` (${(order as any).userEmail})` : ''}
                      {' '}• ${(order.totalAmount / 100).toFixed(2)} {order.currency}
                      • {order.paymentMethod || '—'}
                      • {(() => { const d = new Date(String(order.createdAt).replace(' ', 'T')); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedId === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="border-t px-5 py-4 bg-gray-50 rounded-b-xl">
                    <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                      <div className="md:col-span-2 bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500 font-medium">{language === 'ar' ? 'العميل' : 'Customer'}:</span>{' '}
                        <span className="font-semibold">{(order as any).userName || '—'}</span>
                        {(order as any).userEmail && (
                          <span className="text-blue-700 ms-2">({(order as any).userEmail})</span>
                        )}
                        {(order as any).userPhone && (
                          <span className="text-gray-600 ms-2">📞 {(order as any).userPhone}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'المبلغ الفرعي' : 'Subtotal'}:</span>{' '}
                        ${(order.subtotal / 100).toFixed(2)}
                      </div>
                      <div>
                        <span className="text-gray-500">VAT ({order.vatRate}%):</span>{' '}
                        ${(order.vatAmount / 100).toFixed(2)}
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'الإجمالي' : 'Total'}:</span>{' '}
                        <strong>${(order.totalAmount / 100).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}:</span>{' '}
                        {order.paymentMethod || '—'}
                      </div>
                      {order.paymentReference && (
                        <div>
                          <span className="text-gray-500">Ref:</span> {order.paymentReference}
                        </div>
                      )}
                      {order.paymentProofUrl && (
                        <div>
                          <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />{language === 'ar' ? 'إيصال الدفع' : 'Payment Proof'}
                          </a>
                        </div>
                      )}
                      {order.giftEmail && (
                        <div>
                          <span className="text-gray-500">🎁 {language === 'ar' ? 'هدية إلى' : 'Gift to'}:</span> {order.giftEmail}
                        </div>
                      )}
                    </div>

                    {/* Status Actions */}
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleStatusChange(order.id, 'completed')}>
                            <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'تأكيد ✓' : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-red-600">
                            <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </>
                      )}
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <Button size="sm" onClick={() => handleStatusChange(order.id, 'completed')}>
                            <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'تأكيد ✓' : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-red-600">
                            <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
                        </>
                      )}
                      {order.status === 'paid' && (
                        <Button size="sm" onClick={() => handleStatusChange(order.id, 'completed')}>
                          <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إكمال' : 'Complete'}
                        </Button>
                      )}
                      {(order as any).isUpgrade && (order.status === 'paid' || order.status === 'awaiting_confirmation') && (
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={processUpgradeMutation.isPending} onClick={() => processUpgradeMutation.mutate({ orderId: order.id })}>
                          <ArrowUpCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'تنفيذ الترقية' : 'Process Upgrade'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && allOrders.length > 0 && (
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={totalItems}
            setPage={setPage}
            changePageSize={changePageSize}
            isRtl={language === 'ar'}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
