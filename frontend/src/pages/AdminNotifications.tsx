import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Loader2, Users, Inbox, CheckCheck, ExternalLink, Filter, Search, UserCheck, UserX, User, Mail, Info, ChevronDown, ChevronUp, MailCheck, MailX } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { STAFF_NOTIFICATION_EVENTS, type StaffNotificationEventType } from '@shared/const';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

type DeliveryLogView = 'grouped' | 'detailed';
type DeliveryCategory = 'all' | 'recommendations' | 'support' | 'orders' | 'login' | 'system';
type DeliveryDatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'custom';

const DELIVERY_CATEGORIES: Array<{ key: DeliveryCategory; labelEn: string; labelAr: string }> = [
  { key: 'all', labelEn: 'All', labelAr: 'الكل' },
  { key: 'recommendations', labelEn: 'Recommendations', labelAr: 'التوصيات' },
  { key: 'support', labelEn: 'Support', labelAr: 'الدعم' },
  { key: 'orders', labelEn: 'Orders', labelAr: 'الطلبات' },
  { key: 'login', labelEn: 'Login', labelAr: 'الدخول' },
  { key: 'system', labelEn: 'System', labelAr: 'النظام' },
];

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
  if (eventType.includes('support') || eventType === 'human_escalation' || eventType.includes('lexai')) return 'support';
  if (eventType.includes('order') || eventType.includes('payment')) return 'orders';
  if (eventType.includes('login') || eventType.includes('otp')) return 'login';
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
        recipients: [log],
      });
      continue;
    }

    current.recipientCount += 1;
    current.sentCount += log.status === 'sent' ? 1 : 0;
    current.failedCount += log.status === 'failed' ? 1 : 0;
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

export default function AdminNotifications() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const isAdmin = !!adminCheck?.isAdmin;
  const [tab, setTab] = useState<'alerts' | 'send' | 'emailLogs'>('alerts');
  const [form, setForm] = useState({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', type: 'info' as string, actionUrl: '' });
  const [sendEmail, setSendEmail] = useState(true);
  const [eventFilter, setEventFilter] = useState<StaffNotificationEventType | 'all'>('all');
  const [audience, setAudience] = useState<'all' | 'active' | 'inactive' | 'specific'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<'all' | 'sent' | 'failed'>('all');
  const [deliveryEventType, setDeliveryEventType] = useState('');
  const [deliveryFromDate, setDeliveryFromDate] = useState('');
  const [deliveryToDate, setDeliveryToDate] = useState('');
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const [deliveryView, setDeliveryView] = useState<DeliveryLogView>('grouped');
  const [deliveryCategory, setDeliveryCategory] = useState<DeliveryCategory>('all');
  const [deliveryDatePreset, setDeliveryDatePreset] = useState<DeliveryDatePreset>('all');
  const [expandedDeliveryGroups, setExpandedDeliveryGroups] = useState<Record<string, boolean>>({});
  const [, setLocation] = useLocation();
  const deliveryPageSize = 150;

  // Staff alerts inbox
  const { data: staffAlerts, isLoading: alertsLoading } = trpc.staffNotifications.list.useQuery(undefined, { refetchInterval: 30_000 });
  const markRead = trpc.staffNotifications.markRead.useMutation({ onSuccess: () => utils.staffNotifications.invalidate() });
  const markAllRead = trpc.staffNotifications.markAllRead.useMutation({ onSuccess: () => utils.staffNotifications.invalidate() });
  const utils = trpc.useUtils();

  // Students for targeting
  const { data: targetStudents } = trpc.notifications.targetStudents.useQuery(undefined, { enabled: isAdmin && tab === 'send' });
  // Sent history
  const { data: sentHistory, isLoading: sentLoading } = trpc.notifications.sentHistory.useQuery(undefined, { enabled: isAdmin && tab === 'send' });
  // Recipients for expanded batch
  const { data: batchRecipients, isLoading: recipientsLoading } = trpc.notifications.sentRecipients.useQuery(
    { batchId: expandedBatch! },
    { enabled: isAdmin && !!expandedBatch }
  );
  const deliveryFilters = useMemo(() => ({
    limit: deliveryPageSize,
    offset: deliveryOffset,
    recipientQuery: recipientQuery.trim() || undefined,
    status: deliveryStatus === 'all' ? undefined : deliveryStatus,
    eventType: deliveryEventType.trim() || undefined,
    eventCategory: deliveryCategory === 'all' ? undefined : deliveryCategory,
    fromDate: deliveryFromDate || undefined,
    toDate: deliveryToDate ? `${deliveryToDate} 23:59:59` : undefined,
  }), [deliveryOffset, recipientQuery, deliveryStatus, deliveryEventType, deliveryCategory, deliveryFromDate, deliveryToDate]);
  const { data: deliveryLogs, isLoading: deliveryLogsLoading } = trpc.adminEmail.deliveryLogs.useQuery(
    deliveryFilters,
    { enabled: isAdmin && tab === 'emailLogs' }
  );
  const hasOlderDeliveryLogs = (deliveryLogs?.length ?? 0) === deliveryPageSize;
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
      total: logs.length,
      sent: logs.filter((log: any) => log.status === 'sent').length,
      failed: logs.filter((log: any) => log.status === 'failed').length,
      grouped: deliveryGroups.length,
    };
  }, [visibleDeliveryLogs, deliveryGroups.length]);

  const sendMut = trpc.notifications.send.useMutation({
    onSuccess: (data) => {
      toast.success(isRtl ? `تم إرسال الإشعار إلى ${data.count} طالب` : `Notification sent to ${data.count} students`);
      setForm({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', type: 'info', actionUrl: '' });
      setSelectedStudentIds([]);
      setAudience('all');
      setSendEmail(true);
      utils.notifications.sentHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter students based on audience
  const filteredStudents = useMemo(() => {
    if (!targetStudents) return [];
    switch (audience) {
      case 'active': return targetStudents.filter((s: any) => s.hasActivePackage);
      case 'inactive': return targetStudents.filter((s: any) => !s.hasActivePackage);
      case 'specific': return targetStudents;
      default: return targetStudents;
    }
  }, [targetStudents, audience]);

  const targetUserIds = useMemo(() => {
    if (audience === 'specific') return selectedStudentIds;
    return filteredStudents.map((s: any) => s.id);
  }, [audience, filteredStudents, selectedStudentIds]);

  // Search for specific student picker — show all when empty, filter as typing
  const searchResults = useMemo(() => {
    if (!targetStudents) return [];
    const q = studentSearch.trim().toLowerCase();
    const filtered = q
      ? targetStudents.filter((s: any) =>
          (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
        )
      : targetStudents;
    return filtered.slice(0, 50);
  }, [studentSearch, targetStudents]);

  const canSend = form.titleAr.trim() && targetUserIds.length > 0 && !sendMut.isPending;
  const unavailableDateLabel = isRtl ? 'تاريخ غير متوفر' : 'Date unavailable';

  const filteredAlerts = (staffAlerts ?? []).filter((a: any) =>
    eventFilter === 'all' || a.eventType === eventFilter
  );

  const unreadCount = (staffAlerts ?? []).filter((a: any) => !a.isRead).length;

  useEffect(() => {
    if (!isAdmin && tab !== 'alerts') {
      setTab('alerts');
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    setDeliveryOffset(0);
  }, [recipientQuery, deliveryStatus, deliveryEventType, deliveryFromDate, deliveryToDate]);

  useEffect(() => {
    setExpandedDeliveryGroups({});
  }, [deliveryOffset, recipientQuery, deliveryStatus, deliveryEventType, deliveryFromDate, deliveryToDate, deliveryCategory]);

  const applyDeliveryCategory = (category: DeliveryCategory) => {
    setDeliveryCategory(category);
  };

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

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-500" />
            {isRtl ? 'مركز الإشعارات' : 'Notification Center'}
          </h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b pb-2">
          <button onClick={() => setTab('alerts')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === 'alerts'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Inbox className="w-4 h-4" />
            {isRtl ? 'تنبيهات الفريق' : 'Staff Alerts'}
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <button onClick={() => setTab('emailLogs')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === 'emailLogs'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="w-4 h-4" />
              {isRtl ? 'سجل تسليم البريد' : 'Email Delivery Logs'}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setTab('send')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === 'send'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Send className="w-4 h-4" />
              {isRtl ? 'إرسال للطلاب' : 'Send to Students'}
            </button>
          )}
        </div>

        {/* ── Tab: Staff Alerts ── */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* Filter + Mark All Read */}
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={eventFilter}
                  onChange={e => setEventFilter(e.target.value as any)}
                  className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="all">{isRtl ? 'جميع الأنواع' : 'All Types'}</option>
                  {Object.entries(STAFF_NOTIFICATION_EVENTS).map(([key, ev]) => (
                    <option key={key} value={key}>{isRtl ? ev.labelAr : ev.labelEn}</option>
                  ))}
                </select>
              </div>
              )}
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="w-4 h-4 me-1" />
                  {isRtl ? 'تعليم الكل كمقروء' : 'Mark All Read'}
                </Button>
              )}
            </div>

            {/* Alerts List */}
            {alertsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !filteredAlerts.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>{isRtl ? 'لا توجد تنبيهات' : 'No alerts'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAlerts.map((alert: any) => {
                  const eventDef = STAFF_NOTIFICATION_EVENTS[alert.eventType as StaffNotificationEventType];
                  return (
                    <div
                      key={alert.id}
                      className={`bg-white dark:bg-slate-800 border rounded-lg p-4 flex items-start gap-3 transition-colors ${
                        !alert.isRead
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      <Bell className={`w-4 h-4 mt-1 shrink-0 ${!alert.isRead ? 'text-emerald-500' : 'text-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{isRtl ? alert.titleAr : alert.titleEn}</p>
                          {eventDef && (
                            <Badge variant="outline" className="text-[10px]">
                              {isRtl ? eventDef.labelAr : eventDef.labelEn}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{isRtl ? alert.contentAr : alert.contentEn}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {new Date(alert.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {alert.actionUrl && (
                          <button
                            onClick={() => setLocation(alert.actionUrl)}
                            className="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center transition"
                            title={isRtl ? 'انتقل' : 'Go to'}
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        )}
                        {!alert.isRead && (
                          <button
                            onClick={() => markRead.mutate({ notificationId: alert.id })}
                            className="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center transition"
                            title={isRtl ? 'تعليم كمقروء' : 'Mark read'}
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isAdmin && tab === 'emailLogs' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border rounded-xl p-5 space-y-4">
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
                    onClick={() => setDeliveryOffset((current) => Math.max(0, current - deliveryPageSize))}
                  >
                    {isRtl ? 'الأحدث' : 'Newer'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasOlderDeliveryLogs || deliveryLogsLoading}
                    onClick={() => setDeliveryOffset((current) => current + deliveryPageSize)}
                  >
                    {isRtl ? 'أقدم' : 'Older'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                  <p className="text-xs text-muted-foreground">{isRtl ? 'المحاولات' : 'Attempts'}</p>
                  <p className="text-lg font-semibold">{deliveryStats.total}</p>
                </div>
                <div className="rounded-lg border bg-emerald-50 px-3 py-2 dark:bg-emerald-900/10">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">{isRtl ? 'تم الإرسال' : 'Sent'}</p>
                  <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{deliveryStats.sent}</p>
                </div>
                <div className="rounded-lg border bg-red-50 px-3 py-2 dark:bg-red-900/10">
                  <p className="text-xs text-red-700 dark:text-red-300">{isRtl ? 'فشل' : 'Failed'}</p>
                  <p className="text-lg font-semibold text-red-700 dark:text-red-300">{deliveryStats.failed}</p>
                </div>
                <div className="rounded-lg border bg-teal-50 px-3 py-2 dark:bg-teal-900/10">
                  <p className="text-xs text-teal-700 dark:text-teal-300">{isRtl ? 'صفوف مجمعة' : 'Grouped Rows'}</p>
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
                    onClick={() => applyDeliveryCategory(category.key)}
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
                    onChange={(e) => setDeliveryStatus(e.target.value as 'all' | 'sent' | 'failed')}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="all">{isRtl ? 'الكل' : 'All'}</option>
                    <option value="sent">{isRtl ? 'تم الإرسال' : 'Sent'}</option>
                    <option value="failed">{isRtl ? 'فشل' : 'Failed'}</option>
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
                <p>{isRtl ? 'إذا كانت الحالة فشل: راجع رسالة الخطأ لمعرفة رفض ZeptoMail أو فشل المزود.' : 'If status is failed: inspect the error message for provider rejection or transport failure.'}</p>
                <p>{isRtl ? 'إذا كانت الحالة تم الإرسال: التطبيق سلّم الرسالة للمزود، ثم افحص البريد المزعج أو لوحة المزود.' : 'If status is sent: the app handed the email to the provider, so next check spam or the provider dashboard.'}</p>
                <p>{isRtl ? 'ملاحظة: ردود الدعم للعميل ما زالت داخل المنصة فقط حالياً، وليست بريداً تلقائياً في المسار الحالي.' : 'Note: support replies to clients are still in-app only in the current flow, not automatic emails.'}</p>
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
                  <span>
                    {isRtl
                      ? `عرض ${deliveryOffset + 1} - ${deliveryOffset + visibleDeliveryLogs.length}`
                      : `Showing ${deliveryOffset + 1} - ${deliveryOffset + visibleDeliveryLogs.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deliveryOffset === 0 || deliveryLogsLoading}
                      onClick={() => setDeliveryOffset((current) => Math.max(0, current - deliveryPageSize))}
                    >
                      {isRtl ? 'الأحدث' : 'Newer'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasOlderDeliveryLogs || deliveryLogsLoading}
                      onClick={() => setDeliveryOffset((current) => current + deliveryPageSize)}
                    >
                      {isRtl ? 'أقدم' : 'Older'}
                    </Button>
                  </div>
                </div>
                {deliveryView === 'grouped' ? (
                  <div className="divide-y dark:divide-slate-700">
                    {deliveryGroups.map((group: any) => {
                      const isExpanded = !!expandedDeliveryGroups[group.key];
                      const metadataText = group.metadata
                        ? (() => {
                            try { return JSON.stringify(JSON.parse(group.metadata), null, 2); }
                            catch { return String(group.metadata); }
                          })()
                        : '';

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
                                <Badge className={group.status === 'sent' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200'}>
                                  {group.status === 'sent'
                                    ? (isRtl ? 'تم الإرسال' : 'Sent')
                                    : (isRtl ? 'فشل' : 'Failed')}
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
                                        : <MailX className="h-3.5 w-3.5 text-red-600" />}
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
                        let metadataText = '';
                        if (log.metadata) {
                          try {
                            metadataText = JSON.stringify(JSON.parse(log.metadata), null, 2);
                          } catch {
                            metadataText = String(log.metadata);
                          }
                        }

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
                              <Badge className={log.status === 'sent' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200'}>
                                {log.status === 'sent'
                                  ? (isRtl ? 'تم الإرسال' : 'Sent')
                                  : (isRtl ? 'فشل' : 'Failed')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">{log.provider || '—'}</td>
                            <td className="px-4 py-3 min-w-[260px]">
                              {log.errorMessage ? (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300">
                                  {log.errorMessage}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
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
        )}

        {/* ── Tab: Send to Students ── */}
        {isAdmin && tab === 'send' && (
          <div className="space-y-4">
            {/* Send Form - always visible */}
            <div className="bg-white dark:bg-slate-800 border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Send className="w-4 h-4" />
                {isRtl ? 'إرسال إشعار للطلاب' : 'Send Notification to Students'}
              </h3>

              {/* Audience Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">{isRtl ? 'الجمهور المستهدف' : 'Target Audience'}</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    { value: 'all', icon: Users, labelEn: 'All Students', labelAr: 'جميع الطلاب',
                      tipEn: 'Sends to every registered student (excludes staff members)',
                      tipAr: 'يرسل لجميع الطلاب المسجلين (لا يشمل فريق العمل)' },
                    { value: 'active', icon: UserCheck, labelEn: 'Active Students', labelAr: 'الطلاب النشطين',
                      tipEn: 'Students who currently have an active package subscription (Basic or Comprehensive)',
                      tipAr: 'الطلاب الذين لديهم اشتراك باقة فعّال حالياً (أساسي أو شامل)' },
                    { value: 'inactive', icon: UserX, labelEn: 'Inactive Students', labelAr: 'الطلاب غير النشطين',
                      tipEn: 'Students who registered but have no active package — either expired or never subscribed',
                      tipAr: 'الطلاب المسجلون ولكن بدون باقة فعّالة — إما انتهت صلاحيتها أو لم يشتركوا' },
                    { value: 'specific', icon: User, labelEn: 'Specific Student', labelAr: 'طالب محدد',
                      tipEn: 'Search and select individual students by name or email',
                      tipAr: 'ابحث واختر طلاب محددين بالاسم أو البريد الإلكتروني' },
                  ] as const).map(opt => (
                    <div key={opt.value} className="relative group">
                      <button onClick={() => { setAudience(opt.value); setSelectedStudentIds([]); setStudentSearch(''); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          audience === opt.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <opt.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{isRtl ? opt.labelAr : opt.labelEn}</span>
                        <Info className="w-3.5 h-3.5 ms-auto shrink-0 text-gray-400 group-hover:text-gray-600" />
                      </button>
                      {/* Tooltip */}
                      <div className="absolute z-20 bottom-full mb-2 start-0 end-0 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none shadow-lg">
                        {isRtl ? opt.tipAr : opt.tipEn}
                        <div className="absolute top-full start-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {audience !== 'specific'
                    ? (isRtl ? `سيتم الإرسال إلى ${targetUserIds.length} طالب` : `Will send to ${targetUserIds.length} students`)
                    : (isRtl ? `تم اختيار ${selectedStudentIds.length} طالب` : `${selectedStudentIds.length} students selected`)
                  }
                </p>

                {/* Audience preview list for all/active/inactive */}
                {audience !== 'specific' && filteredStudents.length > 0 && (
                  <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto divide-y dark:divide-slate-700 dark:border-slate-700">
                    {filteredStudents.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="truncate font-medium">{s.name || s.email}</span>
                        <span className="text-muted-foreground ms-auto truncate max-w-[180px]">{s.email}</span>
                        <Badge variant={s.hasActivePackage ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {s.hasActivePackage ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Specific Student Picker */}
              {audience === 'specific' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full ps-9 pe-3 py-2 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700"
                      placeholder={isRtl ? 'ابحث بالاسم أو البريد الإلكتروني...' : 'Search by name or email...'}
                      value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto divide-y dark:divide-slate-700 dark:border-slate-700">
                      {searchResults.map((s: any) => {
                        const checked = selectedStudentIds.includes(s.id);
                        return (
                          <button key={s.id} onClick={() => setSelectedStudentIds(prev =>
                            checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700/50 text-start ${checked ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-slate-600'}`}>
                              {checked && <CheckCheck className="w-3 h-3" />}
                            </div>
                            <span className="truncate">{s.name || s.email}</span>
                            <span className="text-xs text-muted-foreground ms-auto truncate">{s.email}</span>
                            <Badge variant={s.hasActivePackage ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                              {s.hasActivePackage ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Selected students chips */}
                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStudentIds.map(id => {
                        const s = (targetStudents ?? []).find((u: any) => u.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-xs px-2 py-1 rounded-full">
                            {s?.name || s?.email || `#${id}`}
                            <button onClick={() => setSelectedStudentIds(prev => prev.filter(x => x !== id))} className="hover:text-red-500">&times;</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Form Fields — Arabic first (required), English optional */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'العنوان (عربي)' : 'Title (Arabic)'} <span className="text-red-500">*</span></label>
                  <input className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" dir="rtl" value={form.titleAr}
                    onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} placeholder={isRtl ? 'عنوان الإشعار بالعربي — مطلوب' : 'Notification title in Arabic — required'} />
                </div>
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'المحتوى (عربي)' : 'Content (Arabic)'} <span className="text-red-500">*</span></label>
                  <textarea className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" rows={4} dir="rtl" value={form.contentAr}
                    onChange={e => setForm(f => ({ ...f, contentAr: e.target.value }))} placeholder={isRtl ? 'نص الرسالة بالعربي...' : 'Message body in Arabic...'} />
                </div>

                {/* English (optional, collapsible) */}
                <details className="border rounded-lg dark:border-slate-700">
                  <summary className="px-3 py-2 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 dark:text-gray-400 select-none">
                    {isRtl ? '🌐 إضافة نسخة إنجليزية (اختياري)' : '🌐 Add English version (optional)'}
                  </summary>
                  <div className="px-3 pb-3 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">{isRtl ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
                      <input className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" value={form.titleEn}
                        onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} placeholder={isRtl ? 'اتركه فارغاً لاستخدام العربي' : 'Leave empty to use Arabic title'} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">{isRtl ? 'المحتوى (إنجليزي)' : 'Content (English)'}</label>
                      <textarea className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" rows={3} value={form.contentEn}
                        onChange={e => setForm(f => ({ ...f, contentEn: e.target.value }))} placeholder={isRtl ? 'اتركه فارغاً لاستخدام العربي' : 'Leave empty to use Arabic content'} />
                    </div>
                  </div>
                </details>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'النوع' : 'Type'}</label>
                  <select className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="info">{isRtl ? 'معلومات' : 'Info'}</option>
                    <option value="success">{isRtl ? 'نجاح' : 'Success'}</option>
                    <option value="warning">{isRtl ? 'تحذير' : 'Warning'}</option>
                    <option value="action">{isRtl ? 'إجراء مطلوب' : 'Action Required'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{isRtl ? 'رابط الإجراء (اختياري)' : 'Action URL (optional)'}</label>
                  <input className="w-full mt-1 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" dir="ltr" value={form.actionUrl}
                    onChange={e => setForm(f => ({ ...f, actionUrl: e.target.value }))} placeholder="/courses/123" />
                </div>
              </div>

              {/* Email toggle */}
              <label className="flex items-center gap-3 p-3 rounded-lg border dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded" />
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{isRtl ? 'إرسال بريد إلكتروني أيضاً' : 'Also send email'}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? 'سيتم إرسال بريد إلكتروني مصمم بقالب XFlex لكل طالب بالإضافة للإشعار داخل المنصة' : 'Send a branded XFlex email to each student in addition to the in-app notification'}</p>
                </div>
              </label>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => sendMut.mutate({ ...form, userIds: targetUserIds, sendEmail })} disabled={!canSend}>
                  {sendMut.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                  <Send className="w-4 h-4 me-2" />
                  {isRtl
                    ? `إرسال (${targetUserIds.length})${sendEmail ? ' + بريد' : ''}`
                    : `Send (${targetUserIds.length})${sendEmail ? ' + Email' : ''}`
                  }
                </Button>
              </div>
            </div>

            {/* Sent History */}
            <div>
              <h2 className="text-lg font-semibold mb-3">{isRtl ? 'الإشعارات المرسلة مؤخراً' : 'Recently Sent'}</h2>
              {sentLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : !sentHistory?.length ? (
                <div className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد إشعارات مرسلة' : 'No sent notifications yet'}</div>
              ) : (
                <div className="space-y-2">
                  {sentHistory.map((n: any, i: number) => {
                    const isExpanded = expandedBatch === n.batchId;
                    return (
                      <div key={n.batchId || i} className="bg-white dark:bg-slate-800 border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedBatch(isExpanded ? null : n.batchId)}
                          className="w-full p-3 flex items-start gap-3 text-start hover:bg-gray-50 dark:hover:bg-slate-700/30 transition"
                        >
                          <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.type === 'warning' ? 'text-amber-500' : n.type === 'success' ? 'text-green-500' : n.type === 'action' ? 'text-red-500' : 'text-emerald-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{isRtl ? n.titleAr : n.titleEn}</p>
                            {(isRtl ? n.contentAr : n.contentEn) && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{isRtl ? n.contentAr : n.contentEn}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
                              {n.emailSentCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                                  <MailCheck className="w-3 h-3" />
                                  {n.emailSentCount}/{n.recipientCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs">
                              <Users className="w-3 h-3 me-1" />
                              {n.recipientCount}
                            </Badge>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>

                        {/* Expanded recipient list */}
                        {isExpanded && (
                          <div className="border-t dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b dark:border-slate-700">
                              {isRtl ? 'المستلمون' : 'Recipients'}
                            </div>
                            {recipientsLoading ? (
                              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
                            ) : !batchRecipients?.length ? (
                              <p className="text-xs text-muted-foreground text-center py-4">
                                {isRtl ? 'لا توجد بيانات' : 'No data available'}
                              </p>
                            ) : (
                              <div className="max-h-48 overflow-y-auto divide-y dark:divide-slate-700">
                                {batchRecipients.map((r: any) => (
                                  <div key={r.userId} className="flex items-center gap-2 px-3 py-2 text-xs">
                                    <span className="font-medium truncate">{r.name || r.email}</span>
                                    <span className="text-muted-foreground ms-auto truncate max-w-[200px]">{r.email}</span>
                                    {r.emailSent ? (
                                      <span className="inline-flex items-center gap-0.5 text-emerald-600 shrink-0" title={isRtl ? 'تم إرسال البريد' : 'Email sent'}>
                                        <MailCheck className="w-3.5 h-3.5" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-gray-400 shrink-0" title={isRtl ? 'لم يُرسل بريد' : 'No email sent'}>
                                        <MailX className="w-3.5 h-3.5" />
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
