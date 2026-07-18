import { useState } from 'react';
import { ShoppingCart, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAdminCurrency } from '@/lib/adminCurrency';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { getLegalVersionLinks } from '@/lib/legalVersions';
import { formatPaymentMethodLabel } from '@/lib/paymentMethodLabel';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { useDataTable, DataTablePagination } from '@/components/DataTable';
import { toast } from 'sonner';

const orderSortFns: Record<string, (a: any, b: any) => number> = {
  created: (a, b) => new Date(String(a.createdAt).replace(' ', 'T')).getTime() - new Date(String(b.createdAt).replace(' ', 'T')).getTime(),
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

export default function AdminOrders() {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [issueOrder, setIssueOrder] = useState<any | null>(null);
  const [keyConfigurations, setKeyConfigurations] = useState<Record<number, {
    entitlementDays: string;
    expiresAt: string;
    configurationNotes: string;
  }>>({});
  const { data: orders, isLoading } = trpc.orders.adminList.useQuery(filter ? { status: filter } : undefined);
  const updateMutation = trpc.orders.adminUpdateStatus.useMutation({
    onSuccess: (data) => {
      utils.orders.adminList.invalidate();
      if (data.activationKeys?.length) {
        toast.success(language === 'ar'
          ? 'تم تأكيد الدفع وإنشاء مفتاح مربوط ببريد العميل. لن يبدأ الكورس قبل إدخال المفتاح.'
          : 'Payment approved and an email-bound key was created. Course access starts after redemption.');
        setIssueOrder(null);
        setKeyConfigurations({});
      }
    },
    onError: (error) => toast.error(error.message),
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
    }).catch(() => undefined);
  };

  const openIssueDialog = (order: any) => {
    const initial: typeof keyConfigurations = {};
    for (const item of order.packageItems ?? []) {
      initial[item.packageId] = {
        entitlementDays: String(item.defaultEntitlementDays || 30),
        expiresAt: '',
        configurationNotes: '',
      };
    }
    setKeyConfigurations(initial);
    setIssueOrder(order);
  };

  const updateKeyConfiguration = (
    packageId: number,
    field: 'entitlementDays' | 'expiresAt' | 'configurationNotes',
    value: string,
  ) => {
    setKeyConfigurations((current) => ({
      ...current,
      [packageId]: {
        ...(current[packageId] ?? { entitlementDays: '', expiresAt: '', configurationNotes: '' }),
        [field]: value,
      },
    }));
  };

  const issueConfiguredKeys = async () => {
    if (!issueOrder) return;
    const packageItems = issueOrder.packageItems ?? [];
    if (!packageItems.length) {
      toast.error(language === 'ar' ? 'لا توجد باقة مرتبطة بهذا الطلب' : 'This order has no linked package');
      return;
    }
    const configurations = packageItems.map((item: any) => {
      const configuration = keyConfigurations[item.packageId];
      const days = Number(configuration?.entitlementDays);
      return {
        packageId: Number(item.packageId),
        entitlementDays: days,
        expiresAt: configuration?.expiresAt
          ? new Date(`${configuration.expiresAt}T23:59:59.999Z`).toISOString()
          : null,
        configurationNotes: configuration?.configurationNotes?.trim() || null,
      };
    });
    if (configurations.some((configuration: any) => !Number.isInteger(configuration.entitlementDays)
      || configuration.entitlementDays < 1
      || configuration.entitlementDays > 3650)) {
      toast.error(language === 'ar'
        ? 'يجب أن تكون مدة الخدمة بين يوم واحد و3650 يوماً'
        : 'Service duration must be between 1 and 3650 days');
      return;
    }
    await updateMutation.mutateAsync({
      orderId: issueOrder.id,
      status: 'completed',
      keyConfigurations: configurations,
    }).catch(() => undefined);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
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
            {paged.map((order: any) => {
              const legalLinks = getLegalVersionLinks(order.termsAcceptedVersion);
              return (
              <div key={order.id} className="bg-white border rounded-xl shadow-sm">
                <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">#{order.id}</h3>
                      <Badge className={`text-xs ${statusColors[order.status] || 'bg-gray-100'}`}>
                        {language === 'ar' ? statusLabels[order.status]?.ar : statusLabels[order.status]?.en || order.status}
                      </Badge>
                      {order.isGift ? <Badge variant="outline" className="text-xs">🎁 Gift</Badge> : null}
                      {(order as any).isUpgrade ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">⬆ Upgrade</Badge> : null}
                    </div>
                    <p className="text-sm text-gray-500">
                      {(order as any).userName || (order as any).userEmail || `User #${order.userId}`}
                      {(order as any).userEmail ? ` (${(order as any).userEmail})` : ''}
                      {' '}• {formatAdminCurrency(order.totalAmount, language, { sourceCurrency: order.currency, fromCents: true })}
                      • {formatPaymentMethodLabel(order.paymentMethod, language)}
                      • {formatLocalizedDate(String(order.createdAt).replace(' ', 'T'), language) || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedId === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="border-t px-5 py-4 bg-gray-50 rounded-b-xl">
                    <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                      <div className="md:col-span-2 bg-emerald-50 rounded-lg px-3 py-2">
                        <span className="text-gray-500 font-medium">{language === 'ar' ? 'العميل' : 'Customer'}:</span>{' '}
                        <span className="font-semibold">{(order as any).userName || '—'}</span>
                        {(order as any).userEmail && (
                          <span className="text-emerald-700 ms-2">({(order as any).userEmail})</span>
                        )}
                        {(order as any).userPhone && (
                          <span className="text-gray-600 ms-2">📞 {(order as any).userPhone}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'المبلغ الفرعي' : 'Subtotal'}:</span>{' '}
                        {formatAdminCurrency(order.subtotal, language, { sourceCurrency: order.currency, fromCents: true })}
                      </div>
                      <div>
                        <span className="text-gray-500">VAT ({order.vatRate}%):</span>{' '}
                        {formatAdminCurrency(order.vatAmount, language, { sourceCurrency: order.currency, fromCents: true })}
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'الإجمالي' : 'Total'}:</span>{' '}
                        <strong>{formatAdminCurrency(order.totalAmount, language, { sourceCurrency: order.currency, fromCents: true })}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}:</span>{' '}
                        {formatPaymentMethodLabel(order.paymentMethod, language)}
                      </div>
                      {order.paymentReference && (
                        <div>
                          <span className="text-gray-500">Ref:</span> {order.paymentReference}
                        </div>
                      )}
                      {order.paymentProofUrl && (
                        <div>
                          <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />{language === 'ar' ? 'إيصال الدفع' : 'Payment Proof'}
                          </a>
                        </div>
                      )}
                      <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <div className="mb-2 flex items-center gap-2 font-medium text-emerald-900">
                          <FileCheck className="h-4 w-4" />
                          {language === 'ar' ? 'دليل قبول الشروط والأحكام' : 'Terms & Conditions Acceptance Evidence'}
                        </div>
                        {order.termsAcceptedAt ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <span className="text-gray-500">{language === 'ar' ? 'وقت القبول' : 'Accepted at'}:</span>{' '}
                              <span className="font-semibold">
                                {formatLocalizedDate(String(order.termsAcceptedAt).replace(' ', 'T'), language) || order.termsAcceptedAt}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'ar' ? 'نسخة الشروط' : 'Terms version'}:</span>{' '}
                              <span className="font-semibold">{order.termsAcceptedVersion || '—'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'ar' ? 'عنوان IP' : 'IP address'}:</span>{' '}
                              <span className="font-semibold">{order.termsAcceptedIpAddress || '—'}</span>
                            </div>
                            <div className="break-words">
                              <span className="text-gray-500">{language === 'ar' ? 'المتصفح/الجهاز' : 'Browser/device'}:</span>{' '}
                              <span className="font-semibold">{order.termsAcceptedUserAgent || '—'}</span>
                            </div>
                            <div>
                              <a href={legalLinks.terms} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                                {language === 'ar' ? `فتح الشروط المقبولة ${order.termsAcceptedVersion || 'v1'}` : `Open accepted terms ${order.termsAcceptedVersion || 'v1'}`}
                              </a>
                              <span className="px-2 text-emerald-700">•</span>
                              <a href={legalLinks.refund} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                                {language === 'ar' ? `سياسة الاسترداد ${order.termsAcceptedVersion || 'v1'}` : `Refund policy ${order.termsAcceptedVersion || 'v1'}`}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-800">
                            {language === 'ar'
                              ? 'لا يوجد وقت قبول شروط محفوظ لهذا الطلب. قد يكون الطلب أقدم من إضافة سجل الموافقات.'
                              : 'No saved terms acceptance timestamp for this order. This may predate the acceptance record rollout.'}
                          </p>
                        )}
                      </div>
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
                          <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                            <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'تأكيد الدفع وإصدار المفتاح' : 'Approve & issue key'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-red-600">
                            <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </>
                      )}
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                            <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'تأكيد الدفع وإصدار المفتاح' : 'Approve & issue key'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-red-600">
                            <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
                        </>
                      )}
                      {order.status === 'paid' && (
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                          <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إصدار المفتاح' : 'Issue key'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
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

        <Dialog open={!!issueOrder} onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) {
            setIssueOrder(null);
            setKeyConfigurations({});
          }
        }}>
          <DialogContent className="max-w-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>
                {language === 'ar'
                  ? `اعتماد الطلب #${issueOrder?.id ?? ''} وإصدار المفتاح`
                  : `Approve order #${issueOrder?.id ?? ''} and issue key`}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar'
                  ? 'حددي مدة الخدمة لكل باقة قبل إصدار المفتاح. تبدأ هذه المدة حسب سياسة الجاهزية/فترة الحماية، وليس من تاريخ إنشاء المفتاح.'
                  : 'Set the service duration before issuing each key. The duration starts under the readiness/protection policy, not when the key is created.'}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
              {(issueOrder?.packageItems ?? []).map((item: any) => {
                const configuration = keyConfigurations[item.packageId] ?? {
                  entitlementDays: '',
                  expiresAt: '',
                  configurationNotes: '',
                };
                return (
                  <div key={item.packageId} className="space-y-4 rounded-lg border bg-gray-50 p-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {language === 'ar' ? item.packageNameAr || item.packageNameEn : item.packageNameEn || item.packageNameAr}
                      </p>
                      <p className="text-xs text-gray-500">
                        {language === 'ar'
                          ? `المدة الافتراضية للباقة: ${item.defaultEntitlementDays || 30} يوم`
                          : `Package default: ${item.defaultEntitlementDays || 30} days`}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'مدة الخدمة بالأيام *' : 'Service duration (days) *'}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="3650"
                          value={configuration.entitlementDays}
                          onChange={(event) => updateKeyConfiguration(item.packageId, 'entitlementDays', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'آخر موعد لاستخدام المفتاح' : 'Key redemption deadline'}</Label>
                        <Input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={configuration.expiresAt}
                          onChange={(event) => updateKeyConfiguration(item.packageId, 'expiresAt', event.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                          {language === 'ar'
                            ? 'هذا الموعد لا يغيّر مدة الخدمة؛ يحدد فقط آخر يوم لإدخال المفتاح.'
                            : 'This does not change service duration; it only limits when the key can be redeemed.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'ملاحظات إعداد المفتاح' : 'Key configuration notes'}</Label>
                      <Textarea
                        maxLength={1000}
                        value={configuration.configurationNotes}
                        onChange={(event) => updateKeyConfiguration(item.packageId, 'configurationNotes', event.target.value)}
                        placeholder={language === 'ar' ? 'سبب المدة الخاصة أو أي توضيح داخلي...' : 'Reason for a custom duration or internal context...'}
                      />
                    </div>
                  </div>
                );
              })}
              {issueOrder && !(issueOrder.packageItems ?? []).length && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {language === 'ar' ? 'لا توجد باقة مرتبطة بهذا الطلب.' : 'No package is linked to this order.'}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => {
                  setIssueOrder(null);
                  setKeyConfigurations({});
                }}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                disabled={updateMutation.isPending || !(issueOrder?.packageItems ?? []).length}
                onClick={issueConfiguredKeys}
              >
                <CheckCircle className="me-1 h-4 w-4" />
                {updateMutation.isPending
                  ? (language === 'ar' ? 'جاري الإصدار...' : 'Issuing...')
                  : (language === 'ar' ? 'تأكيد الدفع وإصدار المفتاح' : 'Confirm payment and issue key')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
