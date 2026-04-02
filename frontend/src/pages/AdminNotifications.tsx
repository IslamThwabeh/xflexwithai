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

export default function AdminNotifications() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [tab, setTab] = useState<'alerts' | 'send'>('alerts');
  const [form, setForm] = useState({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', type: 'info' as string, actionUrl: '' });
  const [sendEmail, setSendEmail] = useState(true);
  const [eventFilter, setEventFilter] = useState<StaffNotificationEventType | 'all'>('all');
  const [audience, setAudience] = useState<'all' | 'active' | 'inactive' | 'specific'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Staff alerts inbox
  const { data: staffAlerts, isLoading: alertsLoading } = trpc.staffNotifications.list.useQuery(undefined, { refetchInterval: 30_000 });
  const markRead = trpc.staffNotifications.markRead.useMutation({ onSuccess: () => utils.staffNotifications.invalidate() });
  const markAllRead = trpc.staffNotifications.markAllRead.useMutation({ onSuccess: () => utils.staffNotifications.invalidate() });
  const utils = trpc.useUtils();

  // Students for targeting
  const { data: targetStudents } = trpc.notifications.targetStudents.useQuery(undefined, { enabled: tab === 'send' });
  // Sent history
  const { data: sentHistory, isLoading: sentLoading } = trpc.notifications.sentHistory.useQuery(undefined, { enabled: tab === 'send' });
  // Recipients for expanded batch
  const { data: batchRecipients, isLoading: recipientsLoading } = trpc.notifications.sentRecipients.useQuery(
    { batchId: expandedBatch! },
    { enabled: !!expandedBatch }
  );

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

  const filteredAlerts = (staffAlerts ?? []).filter((a: any) =>
    eventFilter === 'all' || a.eventType === eventFilter
  );

  const unreadCount = (staffAlerts ?? []).filter((a: any) => !a.isRead).length;

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
        </div>

        {/* ── Tab: Staff Alerts ── */}
        {tab === 'alerts' && (
          <div className="space-y-4">
            {/* Filter + Mark All Read */}
            <div className="flex flex-wrap items-center gap-3">
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

        {/* ── Tab: Send to Students ── */}
        {tab === 'send' && (
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
