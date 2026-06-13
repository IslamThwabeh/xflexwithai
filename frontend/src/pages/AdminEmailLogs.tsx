import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { ChevronDown, ChevronUp, Loader2, Mail, MailCheck, MailX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type DeliveryLogView = 'grouped' | 'detailed';
type DeliveryCategory = 'all' | 'recommendations' | 'support' | 'orders' | 'login' | 'lifecycle' | 'system';
type DeliveryDatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'custom';
type DeliveryStatus = 'all' | 'sent' | 'failed' | 'skipped_unsubscribed' | 'skipped_deduped' | 'skipped_renewed';

const DELIVERY_CATEGORIES: Array<{ key: DeliveryCategory; labelEn: string; labelAr: string }> = [
  { key: 'all', labelEn: 'All', labelAr: 'الكل' },
  { key: 'recommendations', labelEn: 'Recommendations', labelAr: 'التوصيات' },
  { key: 'support', labelEn: 'Support', labelAr: 'الدعم' },
  { key: 'orders', labelEn: 'Orders', labelAr: 'الطلبات' },
  { key: 'login', labelEn: 'Login', labelAr: 'الدخول' },
  { key: 'lifecycle', labelEn: 'Lifecycle', labelAr: 'الاشتراكات' },
  { key: 'system', labelEn: 'System', labelAr: 'النظام' },
];
const DELIVERY_PAGE_SIZE = 50;

function getAmmanDateValue(offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatter.format(date);
}

function getDeliveryCategory(eventType: string): DeliveryCategory {
  if (eventType.startsWith('recommendation') || eventType === 'trade_result') return 'recommendations';
  if (eventType.includes('support') || eventType === 'human_escalation') return 'support';
  if (eventType.includes('order') || eventType.includes('payment')) return 'orders';
  if (eventType.includes('login') || eventType.includes('otp')) return 'login';
  if (
    eventType.includes('expiry') ||
    eventType.includes('expiring') ||
    eventType.includes('subscription') ||
    eventType.includes('renewal') ||
    eventType.includes('welcome') ||
    eventType.includes('drip') ||
    eventType.includes('milestone') ||
    eventType.includes('inactivity') ||
    eventType.includes('onboarding') ||
    eventType.includes('quiz') ||
    eventType.includes('freeze') ||
    eventType.startsWith('lexai_expiry')
  ) return 'lifecycle';
  return 'system';
}

function getDeliveryMetadata(log: any) {
  if (!log?.metadata) return {};
  try {
    return JSON.parse(log.metadata);
  } catch {
    return {};
  }
}

function getDeliveryGroupKey(log: any) {
  const metadata = getDeliveryMetadata(log);
  const batchKey = metadata.batchId || metadata.messageId || metadata.recommendationId || metadata.orderId || metadata.flowId || '';
  return [
    log.eventType,
    log.templateId || '',
    log.subject || '',
    log.status,
    log.provider || '',
    log.errorMessage || '',
    batchKey,
  ].join('||');
}

function buildDeliveryGroups(logs: any[] = []) {
  const map = new Map<string, any>();

  for (const log of logs) {
    const key = getDeliveryGroupKey(log);
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        key,
        eventType: log.eventType,
        templateId: log.templateId,
        subject: log.subject,
        status: log.status,
        provider: log.provider,
        errorMessage: log.errorMessage,
        metadata: log.metadata,
        latestCreatedAt: log.createdAt,
        recipientCount: 1,
        sentCount: log.status === 'sent' ? 1 : 0,
        failedCount: log.status === 'failed' ? 1 : 0,
        skippedCount: String(log.status || '').startsWith('skipped_') ? 1 : 0,
        recipients: [log],
      });
      continue;
    }

    current.recipientCount += 1;
    current.sentCount += log.status === 'sent' ? 1 : 0;
    current.failedCount += log.status === 'failed' ? 1 : 0;
    current.skippedCount += String(log.status || '').startsWith('skipped_') ? 1 : 0;
    current.recipients.push(log);
  }

  return Array.from(map.values());
}

function formatDeliveryLogTimestamp(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;

  const normalized = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString(locale);
}

function formatMetadata(value: string | null | undefined) {
  if (!value) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return String(value);
  }
}

function getStatusLabel(status: string, isRtl: boolean) {
  if (status === 'sent') return isRtl ? 'تم الإرسال' : 'Sent';
  if (status === 'failed') return isRtl ? 'فشل' : 'Failed';
  if (status === 'skipped_unsubscribed') return isRtl ? 'تخطي: إلغاء الاشتراك' : 'Skipped: Unsubscribed';
  if (status === 'skipped_deduped') return isRtl ? 'تخطي: مكرر' : 'Skipped: Deduped';
  if (status === 'skipped_renewed') return isRtl ? 'تخطي: تم التجديد' : 'Skipped: Renewed';
  return status;
}

function getStatusBadgeClass(status: string) {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'failed') return 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200';
}

export default function AdminEmailLogs() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const isAdmin = !!adminCheck?.isAdmin;
  const [recipientQuery, setRecipientQuery] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('all');
  const [deliveryEventType, setDeliveryEventType] = useState('');
  const [deliveryFromDate, setDeliveryFromDate] = useState('');
  const [deliveryToDate, setDeliveryToDate] = useState('');
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const [deliveryView, setDeliveryView] = useState<DeliveryLogView>('detailed');
  const [deliveryCategory, setDeliveryCategory] = useState<DeliveryCategory>('all');
  const [deliveryDatePreset, setDeliveryDatePreset] = useState<DeliveryDatePreset>('all');
  const [expandedDeliveryGroups, setExpandedDeliveryGroups] = useState<Record<string, boolean>>({});
  const deliveryListTopRef = useRef<HTMLDivElement | null>(null);

  const deliveryFilters = useMemo(() => ({
    limit: DELIVERY_PAGE_SIZE,
    offset: deliveryOffset,
    recipientQuery: recipientQuery.trim() || undefined,
    status: deliveryStatus === 'all' ? undefined : deliveryStatus,
    eventType: deliveryEventType.trim() || undefined,
    eventCategory: deliveryCategory === 'all' ? undefined : deliveryCategory,
    fromDate: deliveryFromDate || undefined,
    toDate: deliveryToDate ? `${deliveryToDate} 23:59:59` : undefined,
  }), [deliveryOffset, recipientQuery, deliveryStatus, deliveryEventType, deliveryCategory, deliveryFromDate, deliveryToDate]);

  const deliverySummaryFilters = useMemo(() => ({
    recipientQuery: recipientQuery.trim() || undefined,
    status: deliveryStatus === 'all' ? undefined : deliveryStatus,
    eventType: deliveryEventType.trim() || undefined,
    eventCategory: deliveryCategory === 'all' ? undefined : deliveryCategory,
    fromDate: deliveryFromDate || undefined,
    toDate: deliveryToDate ? `${deliveryToDate} 23:59:59` : undefined,
  }), [recipientQuery, deliveryStatus, deliveryEventType, deliveryCategory, deliveryFromDate, deliveryToDate]);

  const { data: deliveryLogs, isLoading: deliveryLogsLoading } = trpc.adminEmail.deliveryLogs.useQuery(
    deliveryFilters,
    { enabled: isAdmin }
  );
  const { data: deliverySummary, isLoading: deliverySummaryLoading } = trpc.adminEmail.deliveryLogSummary.useQuery(
    deliverySummaryFilters,
    { enabled: isAdmin }
  );

  const deliveryTotal = deliverySummary?.total ?? 0;
  const hasOlderDeliveryLogs = deliveryOffset + (deliveryLogs?.length ?? 0) < deliveryTotal;
  const currentPage = Math.floor(deliveryOffset / DELIVERY_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(deliveryTotal / DELIVERY_PAGE_SIZE));
  const visibleDeliveryLogs = useMemo(
    () => (deliveryLogs ?? []).filter((log: any) => (
      deliveryCategory === 'all' || getDeliveryCategory(log.eventType) === deliveryCategory
    )),
    [deliveryLogs, deliveryCategory],
  );
  const deliveryGroups = useMemo(() => buildDeliveryGroups(visibleDeliveryLogs), [visibleDeliveryLogs]);
  const deliveryStats = useMemo(() => {
    const logs = visibleDeliveryLogs;
    return {
      total: deliverySummary?.total ?? logs.length,
      sent: deliverySummary?.sent ?? logs.filter((log: any) => log.status === 'sent').length,
      failed: deliverySummary?.failed ?? logs.filter((log: any) => log.status === 'failed').length,
      skipped: deliverySummary?.skipped ?? logs.filter((log: any) => String(log.status || '').startsWith('skipped_')).length,
      grouped: deliveryGroups.length,
    };
  }, [visibleDeliveryLogs, deliveryGroups.length, deliverySummary]);

  useEffect(() => {
    setDeliveryOffset(0);
  }, [recipientQuery, deliveryStatus, deliveryEventType, deliveryFromDate, deliveryToDate, deliveryCategory]);

  useEffect(() => {
    setExpandedDeliveryGroups({});
  }, [deliveryOffset, recipientQuery, deliveryStatus, deliveryEventType, deliveryFromDate, deliveryToDate, deliveryCategory]);

  const applyDeliveryDatePreset = (preset: DeliveryDatePreset) => {
    setDeliveryDatePreset(preset);
    if (preset === 'all') {
      setDeliveryFromDate('');
      setDeliveryToDate('');
      return;
    }
    if (preset === 'today') {
      const today = getAmmanDateValue();
      setDeliveryFromDate(today);
      setDeliveryToDate(today);
      return;
    }
    if (preset === 'yesterday') {
      const yesterday = getAmmanDateValue(-1);
      setDeliveryFromDate(yesterday);
      setDeliveryToDate(yesterday);
      return;
    }
    if (preset === 'last7') {
      setDeliveryFromDate(getAmmanDateValue(-6));
      setDeliveryToDate(getAmmanDateValue());
    }
  };

  const unavailableDateLabel = isRtl ? 'تاريخ غير متوفر' : 'Date unavailable';
  const deliveryShownStart = visibleDeliveryLogs.length ? deliveryOffset + 1 : 0;
  const deliveryShownEnd = deliveryOffset + visibleDeliveryLogs.length;
  const deliveryRangeLabel = deliveryTotal
    ? isRtl
      ? `عرض ${deliveryShownStart} - ${deliveryShownEnd} من ${deliveryTotal}`
      : `Showing ${deliveryShownStart} - ${deliveryShownEnd} of ${deliveryTotal}`
    : isRtl
      ? `عرض ${deliveryShownStart} - ${deliveryShownEnd}`
      : `Showing ${deliveryShownStart} - ${deliveryShownEnd}`;
  const pageLabel = isRtl
    ? `الصفحة ${currentPage} من ${totalPages}`
    : `Page ${currentPage} of ${totalPages}`;
  const scrollDeliveryListToTop = () => {
    window.requestAnimationFrame(() => {
      deliveryListTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const goToPreviousPage = () => {
    setDeliveryOffset((current) => Math.max(0, current - DELIVERY_PAGE_SIZE));
    scrollDeliveryListToTop();
  };
  const goToNextPage = () => {
    setDeliveryOffset((current) => current + DELIVERY_PAGE_SIZE);
    scrollDeliveryListToTop();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6 text-emerald-500" />
              {isRtl ? 'سجل تسليم البريد' : 'Email Delivery Logs'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRtl
                ? 'مكان منفصل لمراجعة محاولات إرسال البريد الإلكتروني بدون البحث داخل صفحة الإشعارات.'
                : 'A dedicated place to review email send attempts without digging through the notifications page.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div ref={deliveryListTopRef} className="bg-white dark:bg-slate-800 border rounded-xl p-5 space-y-4 scroll-mt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {isRtl ? 'سجل تسليم البريد' : 'Email Delivery Logs'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRtl
                    ? 'ابحث باسم العميل أو بريده. إذا لم يظهر أي سجل، فهذا يعني أنه لم يتم تسجيل محاولة إرسال من المسارات التي تمر عبر المرسل المركزي.'
                    : 'Search by client name or email. If no rows appear, no send attempt was recorded through the central sender path.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border p-1 text-xs dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDeliveryView('grouped')}
                    className={`rounded-md px-3 py-1.5 ${deliveryView === 'grouped' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                  >
                    {isRtl ? 'مجمّع' : 'Grouped'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryView('detailed')}
                    className={`rounded-md px-3 py-1.5 ${deliveryView === 'detailed' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                  >
                    {isRtl ? 'تفصيلي' : 'Detailed'}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deliveryOffset === 0 || deliveryLogsLoading}
                  onClick={goToPreviousPage}
                >
                  {isRtl ? 'السابق' : 'Previous'}
                </Button>
                <span className="rounded-md border px-3 py-2 text-xs font-medium text-muted-foreground dark:border-slate-700">
                  {pageLabel}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasOlderDeliveryLogs || deliveryLogsLoading}
                  onClick={goToNextPage}
                >
                  {isRtl ? 'التالي' : 'Next'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                <p className="text-xs text-muted-foreground">{isRtl ? 'المحاولات المطابقة' : 'Matching Attempts'}</p>
                <p className="text-lg font-semibold">{deliverySummaryLoading ? '...' : deliveryStats.total}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 px-3 py-2 dark:bg-emerald-900/10">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{isRtl ? 'تم الإرسال' : 'Sent'}</p>
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{deliverySummaryLoading ? '...' : deliveryStats.sent}</p>
              </div>
              <div className="rounded-lg border bg-red-50 px-3 py-2 dark:bg-red-900/10">
                <p className="text-xs text-red-700 dark:text-red-300">{isRtl ? 'فشل' : 'Failed'}</p>
                <p className="text-lg font-semibold text-red-700 dark:text-red-300">{deliverySummaryLoading ? '...' : deliveryStats.failed}</p>
              </div>
              <div className="rounded-lg border bg-amber-50 px-3 py-2 dark:bg-amber-900/10">
                <p className="text-xs text-amber-700 dark:text-amber-300">{isRtl ? 'تم التخطي' : 'Skipped'}</p>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{deliverySummaryLoading ? '...' : deliveryStats.skipped}</p>
              </div>
              <div className="rounded-lg border bg-teal-50 px-3 py-2 dark:bg-teal-900/10">
                <p className="text-xs text-teal-700 dark:text-teal-300">{isRtl ? 'مجموعات الصفحة' : 'Page Groups'}</p>
                <p className="text-lg font-semibold text-teal-700 dark:text-teal-300">{deliveryStats.grouped}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {DELIVERY_CATEGORIES.map((category) => (
                <Button
                  key={category.key}
                  type="button"
                  variant={deliveryCategory === category.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeliveryCategory(category.key)}
                  className={deliveryCategory === category.key ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                >
                  {isRtl ? category.labelAr : category.labelEn}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', labelEn: 'All dates', labelAr: 'كل التواريخ' },
                { key: 'today', labelEn: 'Today', labelAr: 'اليوم' },
                { key: 'yesterday', labelEn: 'Yesterday', labelAr: 'أمس' },
                { key: 'last7', labelEn: 'Last 7 days', labelAr: 'آخر 7 أيام' },
                { key: 'custom', labelEn: 'Custom', labelAr: 'مخصص' },
              ] as Array<{ key: DeliveryDatePreset; labelEn: string; labelAr: string }>).map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant={deliveryDatePreset === preset.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyDeliveryDatePreset(preset.key)}
                  className={deliveryDatePreset === preset.key ? 'bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}
                >
                  {isRtl ? preset.labelAr : preset.labelEn}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <label className="text-sm font-medium">{isRtl ? 'بحث المستلم' : 'Recipient Search'}</label>
                <input
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  placeholder={isRtl ? 'اسم العميل أو البريد الإلكتروني' : 'Client name or email'}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'الحالة' : 'Status'}</label>
                <select
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="all">{isRtl ? 'الكل' : 'All'}</option>
                  <option value="sent">{isRtl ? 'تم الإرسال' : 'Sent'}</option>
                  <option value="failed">{isRtl ? 'فشل' : 'Failed'}</option>
                  <option value="skipped_unsubscribed">{isRtl ? 'تخطي: إلغاء الاشتراك' : 'Skipped: Unsubscribed'}</option>
                  <option value="skipped_deduped">{isRtl ? 'تخطي: مكرر' : 'Skipped: Deduped'}</option>
                  <option value="skipped_renewed">{isRtl ? 'تخطي: تم التجديد' : 'Skipped: Renewed'}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{isRtl ? 'نوع الحدث' : 'Event Type'}</label>
                <input
                  value={deliveryEventType}
                  onChange={(e) => setDeliveryEventType(e.target.value)}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  placeholder={isRtl ? 'مثال: welcome' : 'Example: welcome'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'من' : 'From'}</label>
                  <input
                    type="date"
                    value={deliveryFromDate}
                    onChange={(e) => { setDeliveryDatePreset('custom'); setDeliveryFromDate(e.target.value); }}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'إلى' : 'To'}</label>
                  <input
                    type="date"
                    value={deliveryToDate}
                    onChange={(e) => { setDeliveryDatePreset('custom'); setDeliveryToDate(e.target.value); }}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 space-y-1">
              <p>{isRtl ? 'إذا لم تجد أي صف: لم تُسجَّل محاولة إرسال من هذا المسار بعد.' : 'If you find no rows: no send attempt has been logged for that flow yet.'}</p>
              <p>{isRtl ? 'تنبيهات انتهاء الاشتراك، LexAI، التجديد، الترحيب، الإنجازات، والخمول موجودة تحت تصنيف الاشتراكات.' : 'Subscription expiry, LexAI expiry, renewal, welcome, milestone, and inactivity emails are under Lifecycle.'}</p>
              <p>{isRtl ? 'إذا كانت الحالة فشل: راجع رسالة الخطأ لمعرفة رفض ZeptoMail أو فشل المزود.' : 'If status is failed: inspect the error message for provider rejection or transport failure.'}</p>
              <p>{isRtl ? 'إذا كانت الحالة تم الإرسال: التطبيق سلّم الرسالة للمزود، ثم افحص البريد المزعج أو لوحة المزود.' : 'If status is sent: the app handed the email to the provider, so next check spam or the provider dashboard.'}</p>
              <p>{isRtl ? 'ملاحظة: ردود الدعم للعميل ما زالت داخل المنصة فقط حالياً، وليست بريداً تلقائياً في المسار الحالي.' : 'Note: support replies to clients are still in-app only in the current flow, not automatic emails.'}</p>
              {!!deliverySummary?.legacyTimestampCount && (
                <p>
                  {isRtl
                    ? `${deliverySummary.legacyTimestampCount} سجل قديم لديه وقت غير دقيق من مرحلة التسجيل الأولى؛ السجلات الجديدة تُحفظ بوقت فعلي.`
                    : `${deliverySummary.legacyTimestampCount} older rows have legacy unknown timestamps from the first audit rollout; new rows are timestamped normally.`}
                </p>
              )}
            </div>
          </div>

          {deliveryLogsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : !visibleDeliveryLogs.length ? (
            <div className="text-center py-12 text-muted-foreground bg-white dark:bg-slate-800 border rounded-xl">
              <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>{isRtl ? 'لا توجد سجلات مطابقة' : 'No matching delivery logs'}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3 text-xs text-muted-foreground dark:border-slate-700">
                <span>{deliveryRangeLabel}</span>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline rounded-md border px-3 py-2 font-medium dark:border-slate-700">
                    {pageLabel}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deliveryOffset === 0 || deliveryLogsLoading}
                    onClick={goToPreviousPage}
                  >
                    {isRtl ? 'السابق' : 'Previous'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasOlderDeliveryLogs || deliveryLogsLoading}
                    onClick={goToNextPage}
                  >
                    {isRtl ? 'التالي' : 'Next'}
                  </Button>
                </div>
              </div>

              {deliveryView === 'grouped' ? (
                <div className="divide-y dark:divide-slate-700">
                  {deliveryGroups.map((group: any) => {
                    const isExpanded = !!expandedDeliveryGroups[group.key];
                    const metadataText = formatMetadata(group.metadata);

                    return (
                      <div key={group.key} className="p-4">
                        <button
                          type="button"
                          onClick={() => setExpandedDeliveryGroups((current) => ({ ...current, [group.key]: !isExpanded }))}
                          className="flex w-full flex-col gap-3 text-start lg:flex-row lg:items-start lg:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              <Badge variant="outline">{group.eventType}</Badge>
                              {group.templateId && <Badge variant="secondary">{group.templateId}</Badge>}
                              <Badge className={getStatusBadgeClass(group.status)}>
                                {getStatusLabel(group.status, isRtl)}
                              </Badge>
                            </div>
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{group.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDeliveryLogTimestamp(group.latestCreatedAt, isRtl ? 'ar-EG' : 'en-US', unavailableDateLabel)}
                              {' - '}
                              {group.provider || (isRtl ? 'مزود غير محدد' : 'No provider')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100">
                              {isRtl ? `المستلمون ${group.recipientCount}` : `Recipients ${group.recipientCount}`}
                            </Badge>
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200">
                              {isRtl ? `تم بنجاح ${group.sentCount}` : `Successful ${group.sentCount}`}
                            </Badge>
                            {group.failedCount > 0 && (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200">
                                {isRtl ? `فشل ${group.failedCount}` : `Failed ${group.failedCount}`}
                              </Badge>
                            )}
                            {group.skippedCount > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200">
                                {isRtl ? `تم التخطي ${group.skippedCount}` : `Skipped ${group.skippedCount}`}
                              </Badge>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-3 rounded-lg border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                            {group.errorMessage && (
                              <div className="rounded border border-red-100 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                                {group.errorMessage}
                              </div>
                            )}
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {group.recipients.map((recipient: any) => (
                                <div key={recipient.id} className="rounded-md border bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950/40">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{recipient.recipientName || recipient.recipientEmail}</div>
                                  {recipient.recipientName && <div className="text-muted-foreground">{recipient.recipientEmail}</div>}
                                  <div className="mt-1 flex items-center gap-2">
                                    {recipient.status === 'sent'
                                      ? <MailCheck className="h-3.5 w-3.5 text-emerald-600" />
                                      : <MailX className={`h-3.5 w-3.5 ${String(recipient.status || '').startsWith('skipped_') ? 'text-amber-600' : 'text-red-600'}`} />}
                                    <span className="text-muted-foreground">{formatDeliveryLogTimestamp(recipient.createdAt, isRtl ? 'ar-EG' : 'en-US', unavailableDateLabel)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {metadataText && (
                              <details>
                                <summary className="cursor-pointer text-xs text-emerald-700 dark:text-emerald-300">
                                  {isRtl ? 'عرض البيانات' : 'View metadata'}
                                </summary>
                                <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words rounded bg-white dark:bg-slate-950/40 border dark:border-slate-700 p-2 text-muted-foreground">{metadataText}</pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-900/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                        <th className="px-4 py-3 text-start">{isRtl ? 'المستلم' : 'Recipient'}</th>
                        <th className="px-4 py-3 text-start">{isRtl ? 'الحدث' : 'Event'}</th>
                        <th className="px-4 py-3 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                        <th className="px-4 py-3 text-start">{isRtl ? 'المزود' : 'Provider'}</th>
                        <th className="px-4 py-3 text-start">{isRtl ? 'الخطأ / البيانات' : 'Error / Metadata'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDeliveryLogs.map((log: any) => {
                        const metadataText = formatMetadata(log.metadata);

                        return (
                          <tr key={log.id} className="border-t dark:border-slate-700 align-top">
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                              {formatDeliveryLogTimestamp(log.createdAt, isRtl ? 'ar-EG' : 'en-US', unavailableDateLabel)}
                            </td>
                            <td className="px-4 py-3 min-w-[220px]">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{log.recipientName || log.recipientEmail}</div>
                              {log.recipientName && (
                                <div className="text-xs text-muted-foreground mt-0.5">{log.recipientEmail}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[180px]">
                              <div className="font-medium">{log.eventType}</div>
                              {log.templateId && (
                                <div className="text-xs text-muted-foreground mt-0.5">{log.templateId}</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.subject}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge className={getStatusBadgeClass(log.status)}>
                                {getStatusLabel(log.status, isRtl)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">{log.provider || '-'}</td>
                            <td className="px-4 py-3 min-w-[260px]">
                              {log.errorMessage ? (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300">
                                  {log.errorMessage}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                              {metadataText && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-xs text-emerald-700 dark:text-emerald-300">
                                    {isRtl ? 'عرض البيانات' : 'View metadata'}
                                  </summary>
                                  <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words rounded bg-gray-50 dark:bg-slate-900/40 border dark:border-slate-700 p-2 text-muted-foreground">{metadataText}</pre>
                                </details>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
