import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ShoppingCart, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, FileCheck, Pencil, RefreshCw, Upload, X } from 'lucide-react';
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
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { getLegalVersionLinks } from '@/lib/legalVersions';
import { formatPaymentMethodLabel } from '@/lib/paymentMethodLabel';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import OrderKeyDeliveryPanel from '@/components/OrderKeyDeliveryPanel';
import OrderRelatedHistory from '@/components/admin/OrderRelatedHistory';
import OrderCancellationDialog from '@/components/admin/OrderCancellationDialog';
import OrderStatusHistory from '@/components/admin/OrderStatusHistory';
import OrderPriceBreakdown from '@/components/OrderPriceBreakdown';
import { useDataTable, DataTablePagination } from '@/components/DataTable';
import { toast } from 'sonner';
import { isLikelyValidEmail, normalizeEmailAddress } from '@shared/emailValidation';
import { filterOrdersForSearch, getFocusedOrderId, getOrderNoteAttachments } from '@/lib/orderManagement';
import { apiFetch } from '@/lib/apiBase';
import { formatApprovalDateTime, parseApprovalDateTime } from '@/lib/orderApprovalTime';
import { ACADEMY_TIME_LABEL_AR, ACADEMY_TIME_LABEL_EN } from '@shared/academyLocale';
import { getOrderReviewFilter, orderReviewPath, orderAgeDays, type OrderReviewFilter } from '@shared/orderReview';

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

const purposeLabels: Record<string, { en: string; ar: string }> = {
  new_sale: { en: 'New sale', ar: 'شراء جديد' },
  renewal: { en: 'Paid renewal', ar: 'تجديد مدفوع' },
  upgrade: { en: 'Upgrade', ar: 'ترقية' },
  copier_subscription: { en: 'Trade copier', ar: 'اشتراك الناسخ' },
};

const keyStatusLabels: Record<string, { en: string; ar: string }> = {
  issuance_pending: { en: 'Payment confirmed — key issuance pending', ar: 'الدفع مؤكد — إصدار المفتاح معلّق' },
  key_ready: { en: 'Key ready — awaiting redemption', ar: 'المفتاح جاهز — بانتظار التفعيل' },
  redeemed: { en: 'Key redeemed', ar: 'تم استخدام المفتاح' },
  closed: { en: 'Unused key closed', ar: 'المفتاح غير المستخدم مغلق' },
  redemption_expired: { en: 'Key redemption deadline expired — review required', ar: 'انتهت مهلة استخدام المفتاح — يلزم المراجعة' },
  historical_review: { en: 'Historical order — review separately', ar: 'طلب سابق — يُراجع بشكل منفصل' },
};

export default function AdminOrders() {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const routeSearch = useSearch();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState(() => String(getFocusedOrderId(routeSearch) ?? ''));
  const lastFocusedOrder = useRef(getFocusedOrderId(routeSearch));
  const filter = getOrderReviewFilter(routeSearch);
  const setFilter = (value?: OrderReviewFilter) => {
    if (getFocusedOrderId(routeSearch)) {
      setSearch('');
      setExpandedId(null);
    }
    setLocation(orderReviewPath(value));
    setPage(0);
  };
  const [issueOrder, setIssueOrder] = useState<any | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState('');
  const [recipientOrder, setRecipientOrder] = useState<any | null>(null);
  const [cancellationOrder, setCancellationOrder] = useState<any | null>(null);
  useEffect(() => { setCancellationOrder(null); }, [routeSearch]);
  const [correctedIsGift, setCorrectedIsGift] = useState(false);
  const [correctedGiftEmail, setCorrectedGiftEmail] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [keyConfigurations, setKeyConfigurations] = useState<Record<number, {
    entitlementDays: string;
    expiresAt: string;
    configurationNotes: string;
  }>>({});
  const [financialPayment, setFinancialPayment] = useState({
    paidAt: '',
    baseAmountIls: '',
    rationale: '',
  });
  const [purposeDrafts, setPurposeDrafts] = useState<Record<number, { purpose: 'new_sale' | 'renewal' | 'upgrade'; reason: string }>>({});
  const [retireOrder, setRetireOrder] = useState<any | null>(null);
  const [retireDraft, setRetireDraft] = useState({ replacementOrderId: '', paidIls: '', reason: '' });
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const { data: financeAuthority } = trpc.roles.myFinanceAuthority.useQuery(undefined, {
    enabled: adminCheck?.isAdmin === true,
    retry: false,
  });
  const staffRoles = adminCheck?.staffRoles ?? [];
  const canManageOperationalOrders = adminCheck?.isAdmin === true || staffRoles.includes('key_manager');
  const canConfirmPayment = financeAuthority?.isFinanceOwner === true || staffRoles.includes('finance_manager');
  const { data: orders, isLoading, isError, isFetching, refetch } = trpc.orders.adminList.useQuery(filter ? { status: filter } : undefined);
  const updateMutation = trpc.orders.adminUpdateStatus.useMutation({
    onSuccess: (data) => {
      utils.orders.adminList.invalidate();
      if (data.order) void utils.orders.adminStatusHistory.invalidate({ orderId: data.order.id });
      if (data.activationKeys?.length) {
        setLocation(`/admin/orders?orderId=${data.order!.id}`);
        setSearch(String(data.order!.id));
        setPage(0);
        setExpandedId(data.order!.id);
        void utils.orders.adminKeyDelivery.invalidate({ orderId: data.order!.id });
        if (data.keyDeliveryQueued === false || data.keySupportDelivered === false) toast.warning(language === 'ar'
          ? 'تم تأكيد الدفع والمفتاح جاهز، لكن إحدى قنوات التسليم تحتاج متابعة. راجع البريد والدعم داخل الطلب.'
          : 'Payment confirmed and key ready, but a delivery channel needs attention. Check email and support in this order.');
        else toast.success(language === 'ar'
          ? 'تم تأكيد الدفع وحفظ المفتاح في الدعم وجدولة بريده. راجع حالة التسليم داخل الطلب.'
          : 'Payment confirmed. Key saved in support and email queued. Delivery status is shown in this order.');
        setIssueOrder(null);
        setKeyConfigurations({});
        setFinancialPayment({ paidAt: '', baseAmountIls: '', rationale: '' });
      }
    },
    onError: (error, variables) => {
      // A late issuance failure can follow a committed cash confirmation.
      // Refresh the persisted state so the recovery action remains reachable.
      utils.orders.adminList.invalidate();
      void utils.orders.adminStatusHistory.invalidate({ orderId: variables.orderId });
      toast.error(error.message);
    },
  });
  const correctRecipientMutation = trpc.orders.adminCorrectActivationRecipient.useMutation({
    onSuccess: () => {
      utils.orders.adminList.invalidate();
      toast.success(language === 'ar' ? 'تم تصحيح مستلم التفعيل وتسجيل العملية' : 'Activation recipient corrected and audited');
      setRecipientOrder(null);
      setCorrectedGiftEmail('');
      setCorrectionReason('');
    },
    onError: (error) => toast.error(error.message),
  });
  const classifyPurpose = trpc.orders.adminClassifyPurpose.useMutation({
    onSuccess: async () => { toast.success(language === 'ar' ? 'تم تثبيت غرض المعاملة.' : 'Transaction purpose locked.'); await utils.orders.adminList.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const [expandedId, setExpandedId] = useState<number | null>(() => getFocusedOrderId(routeSearch));
  const retireLiveOrder = trpc.orders.adminRetireLiveOrder.useMutation({
    onSuccess: async () => {
      setRetireOrder(null);
      await utils.orders.adminList.invalidate();
      toast.success(language === 'ar' ? 'تم حذف طلب اللايف المستبدل وحفظ رصيد التجديد.' : 'Replaced Live order removed and renewal credit saved.');
    },
    onError: error => toast.error(error.message),
  });

  const allOrders = orders ?? [];
  const replacementChoices = allOrders.filter(order => order.userId === retireOrder?.userId
    && order.status === 'completed' && order.id !== retireOrder?.id
    && order.packageItems?.some(item => item.packageSlug === 'comprehensive'));
  const retirementReplacement = replacementChoices.find(order => order.id === Number(retireDraft.replacementOrderId));
  const retirementCredit = Number(retireDraft.paidIls) - Number(retirementReplacement?.displayTotalIls ?? 0);
  const filteredOrders = filterOrdersForSearch(allOrders, search);
  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    changePageSize,
  } = useDataTable(filteredOrders, orderSortFns);

  useEffect(() => {
    const id = getFocusedOrderId(routeSearch);
    if (id) {
      setSearch(String(id));
      setExpandedId(id);
      setPage(0);
    } else if (lastFocusedOrder.current !== null) {
      setSearch('');
      setExpandedId(null);
      setPage(0);
    }
    lastFocusedOrder.current = id;
  }, [routeSearch, setPage]);

  const openIssueDialog = (order: any) => {
    if (order.transactionPurpose === 'copier_subscription') {
      toast.info(language === 'ar'
        ? 'طلبات الناسخ تُعتمد من صفحة الناسخ لأنها لا تصدر مفتاح باقة.'
        : 'Trade copier orders are approved from the copier page because they do not issue package keys.');
      window.location.href = '/admin/copier';
      return;
    }

    const initial: typeof keyConfigurations = {};
    for (const item of order.packageItems ?? []) {
      initial[item.packageId] = {
        entitlementDays: item.packageType === 'live' ? '1' : String(item.renewalEntitlementDays || item.defaultEntitlementDays || 30),
        expiresAt: '',
        configurationNotes: '',
      };
    }
    const currency = String(order.currency || 'ILS').toUpperCase();
    const totalAmount = Number(order.totalAmount || 0);
    setFinancialPayment({
      paidAt: formatApprovalDateTime(new Date()),
      baseAmountIls: Number(order.displayTotalIls
        ?? (currency === 'ILS' || currency === 'NIS' ? totalAmount / 100 : 0)).toFixed(2),
      rationale: '',
    });
    setKeyConfigurations(initial);
    setProofError('');
    updateMutation.reset();
    setIssueOrder(order);
  };

  const uploadAdminProof = async (file: File) => {
    if (!issueOrder || uploadingProof || updateMutation.isPending) return;
    const orderId = issueOrder.id;
    setProofError('');
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setProofError(language === 'ar' ? 'اختر ملفاً غير فارغ بحجم 10 ميغابايت أو أقل.' : 'Choose a non-empty file of 10 MB or less.');
      return;
    }
    setUploadingProof(true);
    try {
      const response = await apiFetch(`/api/uploads/admin-order-proof?orderId=${orderId}`, {
        method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Upload failed');
      setIssueOrder((current: any) => current?.id === orderId ? { ...current, paymentProofUrl: payload.proof.url } : current);
      void utils.orders.adminList.invalidate();
      toast.success(language === 'ar' ? 'تم حفظ الإيصال مع الطلب.' : 'Receipt saved to the order.');
    } catch {
      setProofError(language === 'ar'
        ? 'تعذر رفع الإيصال. استخدم صورة JPEG أو PNG أو WebP أو HEIC أو ملف PDF، وأعد المحاولة أو تابع بدون مرفق.'
        : 'Receipt upload failed. Use JPEG, PNG, WebP, HEIC or PDF, then retry or continue without an attachment.');
    } finally {
      setUploadingProof(false);
    }
  };

  const openRecipientCorrection = (order: any) => {
    setRecipientOrder(order);
    setCorrectedIsGift(Boolean(order.isGift));
    setCorrectedGiftEmail(order.giftEmail || '');
    setCorrectionReason('');
  };

  const saveRecipientCorrection = async () => {
    if (!recipientOrder) return;
    const normalizedEmail = normalizeEmailAddress(correctedGiftEmail);
    if (correctedIsGift && !isLikelyValidEmail(normalizedEmail)) {
      toast.error(language === 'ar' ? 'أدخل بريدًا إلكترونيًا صحيحًا لمستلم الهدية' : 'Enter a valid gift recipient email');
      return;
    }
    await correctRecipientMutation.mutateAsync({
      orderId: recipientOrder.id,
      isGift: correctedIsGift,
      giftEmail: correctedIsGift ? normalizedEmail : null,
      reason: correctionReason.trim(),
    }).catch(() => undefined);
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
    if (!issueOrder || uploadingProof || proofError || updateMutation.isPending) return;
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
        entitlementDays: item.packageType === 'live' ? 1 : days,
        expiresAt: configuration?.expiresAt
          ? new Date(`${configuration.expiresAt}T23:59:59.999Z`).toISOString()
          : null,
        configurationNotes: configuration?.configurationNotes?.trim() || null,
      };
    });
    if (configurations.some((configuration: any, index: number) => packageItems[index]?.packageType !== 'live' && (!Number.isInteger(configuration.entitlementDays)
      || configuration.entitlementDays < 1
      || configuration.entitlementDays > 3650))) {
      toast.error(language === 'ar'
        ? 'يجب أن تكون مدة الخدمة بين يوم واحد و3650 يوماً'
        : 'Service duration must be between 1 and 3650 days');
      return;
    }
    const paidAt = parseApprovalDateTime(financialPayment.paidAt);
    const baseAmountIlsMinor = Math.round(Number(financialPayment.baseAmountIls) * 100);
    const isRetry = issueOrder.fulfillment?.paymentConfirmed === true && issueOrder.status === 'completed';
    if (!isRetry && (Number.isNaN(paidAt.getTime()) || !Number.isSafeInteger(baseAmountIlsMinor) || baseAmountIlsMinor <= 0 || financialPayment.rationale.trim().length < 5)) {
      toast.error(language === 'ar'
        ? 'أدخل تاريخ الدفع والمبلغ المؤكد بالشيكل وسبب الاعتماد (5 أحرف على الأقل).'
        : 'Enter the paid date, confirmed ILS amount, and an approval rationale (at least 5 characters).');
      return;
    }
    await updateMutation.mutateAsync({
      orderId: issueOrder.id,
      status: 'completed',
      keyConfigurations: configurations,
      financialPayment: isRetry ? undefined : {
        paidAt: paidAt.toISOString(),
        baseAmountIlsMinor,
        rationale: financialPayment.rationale.trim(),
      },
    }).catch(() => undefined);
  };

  const approvalBusy = uploadingProof || updateMutation.isPending;
  const retryIssuance = issueOrder?.fulfillment?.paymentConfirmed === true && issueOrder?.status === 'completed';
  const liveOnlyApproval = !!issueOrder?.packageItems?.length && issueOrder.packageItems.every((item: any) => item.packageType === 'live');

  return (
    <DashboardLayout>
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الطلبات' : 'Manage Orders'}</h1>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            <Label htmlFor="order-search">{language === 'ar' ? 'بحث برقم الطلب أو اسم العميل أو البريد' : 'Search by order number, customer name, or email'}</Label>
            <Input id="order-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder={language === 'ar' ? 'مثال: #135 أو اسم العميل' : 'Example: #135 or customer name'} className="mt-2 h-11" />
          </div>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="me-2 h-4 w-4" />{language === 'ar' ? 'تحديث' : 'Refresh'}</Button>
        </div>
        {!canManageOperationalOrders && !canConfirmPayment && <p className="mb-4 text-sm text-slate-600">{language === 'ar' ? 'عرض الطلبات للدعم فقط. تأكيد الدفع وإصدار المفاتيح يتطلب الصلاحيات المختصة.' : 'Support has read-only order access. Payment approval and key issuance require the appropriate permissions.'}</p>}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: undefined, label: language === 'ar' ? 'الكل' : 'All' },
            { value: 'outstanding', label: language === 'ar' ? 'بانتظار المراجعة' : 'Outstanding' },
            { value: 'pending', label: language === 'ar' ? 'معلق' : 'Pending' },
            { value: 'awaiting_confirmation', label: language === 'ar' ? 'بانتظار التأكيد' : 'Awaiting' },
            { value: 'paid', label: language === 'ar' ? 'مدفوع' : 'Paid' },
            { value: 'completed', label: language === 'ar' ? 'مكتمل' : 'Completed' },
            { value: 'cancelled', label: language === 'ar' ? 'ملغي' : 'Cancelled' },
            { value: 'refunded', label: language === 'ar' ? 'مسترد' : 'Refunded' },
          ].map((f) => (
            <Button
              key={f.value || 'all'}
              size="sm"
              className="h-11 sm:h-9"
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value as OrderReviewFilter | undefined)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Orders */}
        {isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">{language === 'ar' ? 'تعذر تحميل الطلبات. تحقق من صلاحياتك واضغط تحديث.' : 'Orders could not be loaded. Check your permissions and click Refresh.'}</div>
        ) : isLoading ? (
          <div className="text-gray-400 text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            {language === 'ar' ? 'لا توجد طلبات مطابقة' : 'No matching orders'}
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((order: any) => {
              const legalLinks = getLegalVersionLinks(order.termsAcceptedVersion);
              const isCopierOrder = order.transactionPurpose === 'copier_subscription';
              return (
              <div key={order.id} className="bg-white border rounded-xl shadow-sm">
                <div id={`order-${order.id}`} role="button" tabIndex={0} aria-expanded={expandedId === order.id} aria-label={`${language === 'ar' ? 'تفاصيل الطلب' : 'Order details'} #${order.id}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedId(expandedId === order.id ? null : order.id); } }} className="p-4 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                  <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">#{order.id}</h3>
                      <Badge className={`text-xs ${statusColors[order.status] || 'bg-gray-100'}`}>
                        {language === 'ar' ? statusLabels[order.status]?.ar : statusLabels[order.status]?.en || order.status}
                      </Badge>
                      {order.isGift ? <Badge variant="outline" className="text-xs">{language === 'ar' ? 'هدية' : 'Gift'}</Badge> : null}
                      {(order as any).isUpgrade ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{language === 'ar' ? 'ترقية' : 'Upgrade'}</Badge> : null}
                      {order.transactionPurpose && <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">{purposeLabels[order.transactionPurpose]?.[language] || order.transactionPurpose}</Badge>}
                    </div>
                    <p className="mb-1 text-sm font-semibold text-slate-800">{order.packageItems?.map((item: any) => language === 'ar' ? item.packageNameAr || item.packageNameEn : item.packageNameEn || item.packageNameAr).join('، ') || (isCopierOrder ? (language === 'ar' ? 'الناسخ' : 'Copier') : (language === 'ar' ? 'الباقة غير متاحة — راجع التفاصيل' : 'Package unavailable — review details'))}</p>
                    <p className="mb-2 text-xs text-slate-600">
                      {language === 'ar' ? 'العمر بالأيام' : 'Age in days'}: {orderAgeDays(order.createdAt) ?? '—'} · {order.paymentProofUrl ? (language === 'ar' ? 'يوجد إيصال مرفق' : 'Receipt attached') : (language === 'ar' ? 'لا يوجد إيصال مرفق' : 'No receipt attached')}
                      {' · '}{order.isGift ? (language === 'ar' ? 'المستلم: ' : 'Recipient: ') + (order.giftEmail || '—') : (language === 'ar' ? 'للمشتري' : 'For purchaser')}
                    </p>
                    {keyStatusLabels[order.fulfillment?.keyStatus] && <p className={`mb-2 text-sm font-medium ${order.fulfillment.keyStatus === 'issuance_pending' ? 'text-amber-800' : 'text-slate-600'}`}>
                      {keyStatusLabels[order.fulfillment.keyStatus][language]}
                    </p>}

                    <p className="text-sm text-gray-500">
                      {(order as any).userName || (order as any).userEmail || `User #${order.userId}`}
                      {(order as any).userEmail ? ` (${(order as any).userEmail})` : ''}
                      {' '}• {formatAdminCurrencyFromIls(order.displayTotalIls, language)}
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
                    {!order.transactionPurpose && ['pending', 'awaiting_confirmation', 'paid'].includes(order.status) && canConfirmPayment && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3"><p className="mb-2 text-sm font-semibold text-amber-950">{language === 'ar' ? 'يجب تصنيف غرض المعاملة مرة واحدة قبل تأكيد الدفع.' : 'Classify the immutable transaction purpose before confirming payment.'}</p><div className="grid gap-2 md:grid-cols-[180px_1fr_auto]"><select className="h-10 rounded-md border bg-white px-3" value={(purposeDrafts[order.id]?.purpose || (order.isUpgrade ? 'upgrade' : 'new_sale'))} onChange={e => setPurposeDrafts({ ...purposeDrafts, [order.id]: { purpose: e.target.value as any, reason: purposeDrafts[order.id]?.reason || '' } })}><option value="new_sale">{purposeLabels.new_sale[language]}</option><option value="renewal">{purposeLabels.renewal[language]}</option><option value="upgrade">{purposeLabels.upgrade[language]}</option></select><Input placeholder={language === 'ar' ? 'سبب التصنيف (5 أحرف على الأقل)' : 'Classification reason (at least 5 characters)'} value={purposeDrafts[order.id]?.reason || ''} onChange={e => setPurposeDrafts({ ...purposeDrafts, [order.id]: { purpose: purposeDrafts[order.id]?.purpose || (order.isUpgrade ? 'upgrade' : 'new_sale'), reason: e.target.value } })} /><Button variant="outline" disabled={classifyPurpose.isPending} onClick={() => classifyPurpose.mutate({ orderId: order.id, purpose: purposeDrafts[order.id]?.purpose || (order.isUpgrade ? 'upgrade' : 'new_sale'), reason: purposeDrafts[order.id]?.reason || '' })}>{language === 'ar' ? 'تثبيت التصنيف' : 'Lock classification'}</Button></div></div>}
                    <OrderRelatedHistory key={order.id} orderId={order.id} />
                    <OrderStatusHistory key={`history-${order.id}`} orderId={order.id} />
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
                      {order.notes && <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 font-semibold">{language === 'ar' ? 'ملاحظات الطلب' : 'Order notes'}</p>
                        <p className="whitespace-pre-wrap break-words">{order.notes}</p>
                        {getOrderNoteAttachments(order.notes).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="mt-3 block font-semibold text-amber-900 underline">{language === 'ar' ? 'إفادة دفع من صاحب العمل — الإيصال الفعلي قيد الانتظار' : 'Owner-reported payment note — actual receipt pending'}</a>)}
                      </div>}
                      <div className="md:col-span-2">
                        <OrderPriceBreakdown order={order} audience="admin" />
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}:</span>{' '}
                        {formatPaymentMethodLabel(order.paymentMethod, language)}
                      </div>
                      {order.renewalCreditIlsMinor > 0 && <div className="rounded-md bg-emerald-50 p-3 font-medium text-emerald-900">
                        {language === 'ar' ? 'رصيد متاح للتجديد: ' : 'Available renewal credit: '}
                        {formatAdminCurrencyFromIls(order.renewalCreditIlsMinor / 100, language)}
                      </div>}
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
                    {isCopierOrder && ['pending', 'awaiting_confirmation', 'paid'].includes(order.status) && (
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="font-semibold">
                          {language === 'ar' ? 'هذا طلب ناسخ، وليس طلب باقة.' : 'This is a trade copier order, not a package order.'}
                        </p>
                        <p className="mt-1 text-emerald-800">
                          {language === 'ar'
                            ? 'لا يتم إصدار مفتاح لهذا الطلب. أكّد الدفع وتابع الربط الخارجي من صفحة الناسخ.'
                            : 'No package key is issued for this order. Confirm payment and manage external linking from the copier page.'}
                        </p>
                        <Button size="sm" className="mt-3" onClick={() => { window.location.href = '/admin/copier'; }}>
                          {language === 'ar' ? 'فتح صفحة الناسخ' : 'Open copier page'}
                        </Button>
                      </div>
                    )}
                    {(canManageOperationalOrders || canConfirmPayment) && order.status === 'completed' && !isCopierOrder && (
                      <OrderKeyDeliveryPanel key={order.id} orderId={order.id} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {financeAuthority?.isFinanceOwner && order.status === 'completed' && order.packageItems?.some((item: any) => item.packageSlug === 'live-package') && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setRetireOrder(order);
                          setRetireDraft({ replacementOrderId: '', paidIls: String(order.displayTotalIls), reason: '' });
                        }}>
                          {language === 'ar' ? 'حذف طلب لايف مستبدل' : 'Remove replaced Live order'}
                        </Button>
                      )}
                      {canManageOperationalOrders && ['pending', 'awaiting_confirmation', 'paid'].includes(order.status) && (
                        <Button size="sm" variant="outline" onClick={() => openRecipientCorrection(order)}>
                          <Pencil className="w-3.5 h-3.5 me-1" />
                          {language === 'ar' ? 'تصحيح مستلم التفعيل' : 'Correct activation recipient'}
                        </Button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          {canConfirmPayment && order.transactionPurpose && !isCopierOrder && (
                            <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                              <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'اعتماد الطلب وإرسال المفتاح' : 'Approve & send key'}
                            </Button>
                          )}
                          {(canManageOperationalOrders || (canConfirmPayment && !!order.paymentProofUrl)) && (
                            <Button size="sm" variant="outline" onClick={() => setCancellationOrder(order)} className="text-red-600">
                              <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>
                          )}
                        </>
                      )}
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          {canConfirmPayment && order.transactionPurpose && !isCopierOrder && (
                            <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                              <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'اعتماد الطلب وإرسال المفتاح' : 'Approve & send key'}
                            </Button>
                          )}
                          {(canManageOperationalOrders || (canConfirmPayment && !!order.paymentProofUrl)) && (
                            <Button size="sm" variant="outline" onClick={() => setCancellationOrder(order)} className="text-red-600">
                              <XCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'رفض' : 'Reject'}
                            </Button>
                          )}
                        </>
                      )}
                      {canConfirmPayment && order.transactionPurpose && !isCopierOrder && order.status === 'paid' && (
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                          <CheckCircle className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إصدار المفتاح وإرساله' : 'Issue & send key'}
                        </Button>
                      )}
                      {canConfirmPayment && order.fulfillment?.keyStatus === 'issuance_pending' && (
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => openIssueDialog(order)}>
                          <RefreshCw className="w-3.5 h-3.5 me-1" />{language === 'ar' ? 'إعادة محاولة إصدار المفتاح' : 'Retry key issuance'}
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

        {cancellationOrder && <OrderCancellationDialog key={cancellationOrder.id} order={cancellationOrder} onClose={() => setCancellationOrder(null)} onCancelled={() => setCancellationOrder(null)} />}

        <Dialog open={!!retireOrder} onOpenChange={open => { if (!open && !retireLiveOrder.isPending) setRetireOrder(null); }}>
          <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'حذف طلب اللايف المستبدل' : 'Remove replaced Live order'} #{retireOrder?.id}</DialogTitle>
              <DialogDescription>{language === 'ar'
                ? 'للطلبات ذات المفاتيح غير المستخدمة فقط. يُحذف الطلب من القوائم وتُصحّح الدفعة المكررة مع حفظ إثبات الدفع ورصيد التجديد.'
                : 'For unused keys only. Removes the order from lists, corrects the duplicated payment allocation, and keeps payment evidence and renewal credit.'}</DialogDescription>
            </DialogHeader>
            <Label htmlFor="retire-replacement">{language === 'ar' ? 'طلب الشامل البديل' : 'Replacement Comprehensive order'}</Label>
            <select id="retire-replacement" className="h-10 rounded-md border px-3" value={retireDraft.replacementOrderId} onChange={event => setRetireDraft({ ...retireDraft, replacementOrderId: event.target.value })}>
              <option value="">{language === 'ar' ? 'اختر الطلب' : 'Choose an order'}</option>
              {replacementChoices.map(order => <option key={order.id} value={order.id}>#{order.id} · {formatAdminCurrencyFromIls(order.displayTotalIls, language)}</option>)}
            </select>
            <Label htmlFor="retire-paid">{language === 'ar' ? 'إجمالي ما دفعه العميل بالشيكل' : 'Total actually paid by customer (ILS)'}</Label>
            <Input id="retire-paid" type="number" min="0.01" step="0.01" value={retireDraft.paidIls} onChange={event => setRetireDraft({ ...retireDraft, paidIls: event.target.value })} />
            {retirementReplacement && <p className="rounded-md bg-emerald-50 p-3 text-sm">
              {language === 'ar' ? 'للشامل: ' : 'Comprehensive: '}{formatAdminCurrencyFromIls(retirementReplacement.displayTotalIls, language)} ·{' '}
              {language === 'ar' ? 'رصيد التجديد المتبقي: ' : 'Remaining renewal credit: '}{formatAdminCurrencyFromIls(retirementCredit, language)}
            </p>}
            <Label htmlFor="retire-reason">{language === 'ar' ? 'السبب' : 'Reason'}</Label>
            <Textarea id="retire-reason" minLength={5} maxLength={1000} value={retireDraft.reason} onChange={event => setRetireDraft({ ...retireDraft, reason: event.target.value })} />
            <DialogFooter>
              <Button variant="outline" disabled={retireLiveOrder.isPending} onClick={() => setRetireOrder(null)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button disabled={retireLiveOrder.isPending || !retirementReplacement || retirementCredit < 0 || !Number.isFinite(retirementCredit) || retireDraft.reason.trim().length < 5}
                onClick={() => retireLiveOrder.mutate({ orderId: retireOrder.id, replacementOrderId: Number(retireDraft.replacementOrderId), paidIlsMinor: Math.round(Number(retireDraft.paidIls) * 100), reason: retireDraft.reason.trim() })}>
                {language === 'ar' ? 'حذف الطلب وحفظ الرصيد' : 'Remove order and save credit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pagination */}
        {!isLoading && !isError && filteredOrders.length > 0 && (
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
          if (!open && !approvalBusy) {
            setIssueOrder(null);
            setKeyConfigurations({});
            setFinancialPayment({ paidAt: '', baseAmountIls: '', rationale: '' });
          }
        }}>
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <button type="button" className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50" aria-label={language === 'ar' ? 'إغلاق' : 'Close'} disabled={approvalBusy} onClick={() => setIssueOrder(null)}><X className="h-5 w-5" /></button>
            <DialogHeader className="shrink-0 p-4 pe-14 text-start sm:p-6 sm:pe-14">
              <DialogTitle>
                {issueOrder?.fulfillment?.paymentConfirmed && issueOrder?.status === 'completed'
                  ? (language === 'ar' ? `إعادة إصدار مفتاح الطلب #${issueOrder?.id}` : `Retry key issuance for order #${issueOrder?.id}`)
                  : language === 'ar'
                  ? `اعتماد الطلب #${issueOrder?.id ?? ''} وإرسال المفتاح`
                  : `Approve order #${issueOrder?.id ?? ''} and send key`}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar'
                  ? (liveOnlyApproval ? 'راجع الدفع وأرسل مفتاح بكج لايف. لا تحتاج لاختيار مدة خدمة لهذه الباقة.' : 'حدد مدة الخدمة لكل باقة قبل إصدار المفتاح. تبدأ هذه المدة حسب سياسة الجاهزية/فترة الحماية، وليس من تاريخ إنشاء المفتاح.')
                  : (liveOnlyApproval ? 'Review payment and send the Live Package key. No service duration is needed for this package.' : 'Set the service duration before issuing each key. The duration starts under the readiness/protection policy, not when the key is created.')}
              </DialogDescription>
              {issueOrder?.userName && <p className="break-words text-sm font-medium">{language === 'ar' ? 'العميل: ' : 'Customer: '}{issueOrder.userName}</p>}
            </DialogHeader>

            <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
              {issueOrder?.fulfillment?.paymentConfirmed && issueOrder?.status === 'completed' ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  {language === 'ar' ? 'الدفع مؤكد مسبقًا. ستُستخدم عملية التأكيد الأصلية دون تسجيل دفعة أخرى أو تغيير تاريخها. تبقى المفاتيح الموجودة ومددها كما هي.' : 'Payment is already confirmed. This uses the original confirmation without recording another payment or changing its date. Existing keys and their durations are preserved.'}
                </p>
              ) : <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="font-semibold text-emerald-950">{language === 'ar' ? 'بيانات تأكيد الدفع' : 'Payment confirmation details'}</p>
                  <p className="text-xs text-emerald-800">
                    {language === 'ar'
                      ? 'يُسجّل الدخل في تاريخ تأكيد الدفع، وليس عند استخدام المفتاح أو تفعيله.'
                      : 'Income is recorded on confirmed payment date, not on key issuance or activation.'}
                  </p>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="approval-paid-at">{language === 'ar' ? 'تاريخ ووقت تأكيد الدفع *' : 'Confirmed payment date/time *'}</Label>
                    <Input id="approval-paid-at" className="block h-11 min-w-0 max-w-full [&::-webkit-date-and-time-value]:min-w-0" dir="ltr" type="datetime-local" value={financialPayment.paidAt} onChange={(event) => setFinancialPayment((current) => ({ ...current, paidAt: event.target.value }))} />
                    <p className="text-xs text-emerald-800">{language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}</p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="approval-amount">{language === 'ar' ? 'المبلغ المؤكد بالشيكل *' : 'Confirmed ILS amount *'}</Label>
                    <Input id="approval-amount" className="h-11" dir="ltr" type="number" min="0.01" step="0.01" inputMode="decimal" value={financialPayment.baseAmountIls} onChange={(event) => setFinancialPayment((current) => ({ ...current, baseAmountIls: event.target.value }))} />
                  </div>
                </div>
                {issueOrder && !['ILS', 'NIS'].includes(String(issueOrder.currency || '').toUpperCase()) && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {language === 'ar'
                      ? 'هذا طلب قديم مخزن بعملة USD، لكن التأكيد المالي سيُسجل بالشيكل فقط وفق السعر التجاري الظاهر، دون استخدام سعر صرف.'
                      : 'This legacy order is stored as USD, but its financial confirmation is recorded only in ILS using the displayed commercial price, without an exchange rate.'}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="approval-rationale">{language === 'ar' ? 'سبب اعتماد الدفع *' : 'Payment-approval rationale *'}</Label>
                  <Textarea id="approval-rationale" minLength={5} maxLength={500} value={financialPayment.rationale} onChange={(event) => setFinancialPayment((current) => ({ ...current, rationale: event.target.value }))} placeholder={language === 'ar' ? 'وضح كيف تحققت من وصول الدفع، سواء أرفقت إيصالاً أم لا.' : 'Explain how you verified payment, with or without an attached receipt.'} />
                </div>
              </div>}
              {!retryIssuance && <section className="min-w-0 space-y-3 rounded-lg border bg-white p-4" aria-label={language === 'ar' ? 'إيصال الدفع' : 'Payment receipt'}>
                <Label htmlFor="approval-proof">{language === 'ar' ? 'صورة الإيصال أو ملف PDF (اختياري)' : 'Receipt image or PDF (optional)'}</Label>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'يمكن اعتماد الدفع بدون صورة. الحد الأقصى 10 ميغابايت؛ اختيار الملف يرفعه ويحفظه مع الطلب.' : 'You may approve without an image. Maximum 10 MB; choosing a file uploads and saves it to this order.'}</p>
                {issueOrder?.paymentProofUrl && <a href={issueOrder.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-700 underline"><FileCheck className="h-4 w-4" />{language === 'ar' ? 'عرض الإيصال المرفق' : 'View attached receipt'}</a>}
                <Input id="approval-proof" type="file" className="h-auto min-h-11 py-2" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif" disabled={approvalBusy} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAdminProof(file); event.target.value = ''; }} />
                {uploadingProof && <p role="status" className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" />{language === 'ar' ? 'جاري رفع الإيصال…' : 'Uploading receipt…'}</p>}
                {proofError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{proofError}</p><Button variant="outline" onClick={() => setProofError('')}>{language === 'ar' ? 'متابعة بدون مرفق جديد' : 'Continue without a new attachment'}</Button></div>}
              </section>}
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
                          ? (item.packageType === 'live' ? 'مدة الوصول حسب إعدادات بكج لايف.' : `المدة الافتراضية للباقة: ${item.defaultEntitlementDays || 30} يوم`)
                          : (item.packageType === 'live' ? 'Access follows the Live Package settings.' : `Package default: ${item.defaultEntitlementDays || 30} days`)}
                      </p>
                    </div>

                    {item.packageType === 'live' ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {language === 'ar'
                          ? 'نافذة بكج لايف ثابتة وتُدار من لوحة بكج لايف؛ لا ينشئ هذا الطلب تجديداً.'
                          : 'Live Package uses its fixed cohort window from the Live admin workspace; this order does not create a renewal.'}
                      </div>
                    ) : issueOrder?.transactionPurpose === 'renewal' ? <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                      {language === 'ar' ? `مدة التجديد ثابتة: ${item.renewalEntitlementDays} يوم. التوصيات حتى ${formatLocalizedDate(item.recommendationsProjectedEndAt, language)}${item.lexaiProjectedEndAt ? `، وLexAI حتى ${formatLocalizedDate(item.lexaiProjectedEndAt, language)}` : ''}.` : `Fixed renewal duration: ${item.renewalEntitlementDays} days. Recommendations through ${formatLocalizedDate(item.recommendationsProjectedEndAt, language)}${item.lexaiProjectedEndAt ? `; LexAI through ${formatLocalizedDate(item.lexaiProjectedEndAt, language)}` : ''}.`}
                    </div> : <div className="grid gap-4 sm:grid-cols-2">
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
                    </div>}

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
              {updateMutation.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{updateMutation.error.message}</p>}
            </div>
            <DialogFooter className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <Button
                className="min-h-11"
                variant="outline"
                disabled={approvalBusy}
                onClick={() => {
                  setIssueOrder(null);
                  setKeyConfigurations({});
                  setFinancialPayment({ paidAt: '', baseAmountIls: '', rationale: '' });
                }}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="h-auto min-h-11 whitespace-normal text-center"
                disabled={approvalBusy || !!proofError || !(issueOrder?.packageItems ?? []).length}
                onClick={issueConfiguredKeys}
              >
                <CheckCircle className="me-1 h-4 w-4" />
                {updateMutation.isPending
                  ? (language === 'ar' ? 'جاري الإصدار...' : 'Issuing...')
                  : issueOrder?.fulfillment?.paymentConfirmed && issueOrder?.status === 'completed'
                    ? (language === 'ar' ? 'إعادة محاولة إصدار المفتاح' : 'Retry key issuance')
                    : (language === 'ar' ? 'تأكيد الدفع وإرسال المفتاح' : 'Confirm payment and send key')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!recipientOrder} onOpenChange={(open) => {
          if (!open && !correctRecipientMutation.isPending) setRecipientOrder(null);
        }}>
          <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>
                {language === 'ar'
                  ? `تصحيح مستلم تفعيل الطلب #${recipientOrder?.id ?? ''}`
                  : `Correct activation recipient for order #${recipientOrder?.id ?? ''}`}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar'
                  ? 'يُسمح بهذا التصحيح قبل إصدار أي مفتاح فقط، وسيتم حفظ السبب والتغيير في سجل التدقيق.'
                  : 'This is allowed only before any key is issued. The reason and change are saved in the audit log.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-500">{language === 'ar' ? 'بريد العميل' : 'Customer email'}:</span>{' '}
                <span className="font-medium">{recipientOrder?.userEmail || '—'}</span>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={correctedIsGift}
                  onChange={(event) => setCorrectedIsGift(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {language === 'ar' ? 'هذا الطلب هدية' : 'This order is a gift'}
              </label>
              {correctedIsGift && (
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'بريد مستلم الهدية *' : 'Gift recipient email *'}</Label>
                  <Input
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    value={correctedGiftEmail}
                    onChange={(event) => setCorrectedGiftEmail(event.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'سبب التصحيح *' : 'Correction reason *'}</Label>
                <Textarea
                  minLength={10}
                  maxLength={500}
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  placeholder={language === 'ar' ? 'مثال: اختار العميل خيار الهدية بالخطأ...' : 'Example: customer selected the gift option by mistake...'}
                />
                <p className="text-xs text-gray-500">
                  {language === 'ar' ? '10 أحرف على الأقل' : 'At least 10 characters'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={correctRecipientMutation.isPending} onClick={() => setRecipientOrder(null)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                disabled={correctRecipientMutation.isPending
                  || correctionReason.trim().length < 10
                  || (correctedIsGift && !isLikelyValidEmail(normalizeEmailAddress(correctedGiftEmail)))}
                onClick={saveRecipientCorrection}
              >
                {correctRecipientMutation.isPending
                  ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                  : (language === 'ar' ? 'حفظ التصحيح' : 'Save correction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
