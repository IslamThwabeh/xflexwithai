import { useEffect, useState } from 'react';
import { CalendarPlus, ClipboardList, Eye, Radio, Save, ShieldAlert, Upload } from 'lucide-react';
import { Link } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import LivePackageJourneyPreview from '@/components/admin/LivePackageJourneyPreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const toAmmanInput = (iso: string) => iso ? new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
const fromAmmanInput = (value: string) => value ? new Date(`${value}:00+03:00`).toISOString() : '';

export default function AdminLivePackage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.livePackage.adminWorkspace.useQuery();
  const [config, setConfig] = useState<any>(null);
  const [session, setSession] = useState({ sessionType: 'educational' as 'educational' | 'trading_analysis', titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '', startsAt: '', endsAt: '', zoomJoinUrl: '' });
  const [notificationSessionId, setNotificationSessionId] = useState('');
  const [notificationTiming, setNotificationTiming] = useState({ mode: 'now' as 'now' | 'after_hours' | 'at', afterHours: '24', scheduledFor: '' });
  const [recurrence, setRecurrence] = useState({ weeks: '4', educationalDays: '1,3', analysisDays: '2,4' });
  const [grant, setGrant] = useState({ userId: '', reason: '' });
  const [recording, setRecording] = useState({ titleEn: '', titleAr: '', file: null as File | null });
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  useEffect(() => {
    if (!data) return;
    setConfig({
      ...data.config,
      sessionStartsAt: toAmmanInput(data.config.sessionStartsAt),
      sessionEndsAt: toAmmanInput(data.config.sessionEndsAt),
    });
  }, [data]);

  const refresh = () => utils.livePackage.adminWorkspace.invalidate();
  const updateConfig = trpc.packages.updateLiveConfig.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم حفظ الإعدادات' : 'Configuration saved'); refresh(); } });
  const previewConfig = trpc.packages.previewLiveConfig.useMutation({ onError: (e) => toast.error(e.message) });
  const setRegistration = trpc.packages.setLiveRegistration.useMutation({
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث حالة التسجيل وتوثيق التغيير' : 'Registration state updated and audited');
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const createSession = trpc.livePackage.createSession.useMutation({ onSuccess: () => { toast.success(isAr ? 'تمت جدولة اللقاء' : 'Session scheduled'); setSession({ sessionType: 'educational', titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '', startsAt: '', endsAt: '', zoomJoinUrl: '' }); refresh(); }, onError: (e) => toast.error(e.message) });
  const createSessions = trpc.livePackage.createSessions.useMutation({ onSuccess: (result) => { toast.success(isAr ? `تم إنشاء ${result.count} لقاء` : `${result.count} sessions created`); refresh(); }, onError: (e) => toast.error(e.message) });
  const updateSession = trpc.livePackage.updateSession.useMutation({ onSuccess: refresh });
  const updateRecording = trpc.livePackage.updateRecording.useMutation({ onSuccess: refresh });
  const previewNotification = trpc.livePackage.previewNotification.useQuery(
    { sessionId: Number(notificationSessionId) },
    { enabled: Number(notificationSessionId) > 0 },
  );
  const scheduleNotification = trpc.livePackage.scheduleNotification.useMutation({ onSuccess: () => { toast.success(isAr ? 'تمت جدولة الإشعار' : 'Notification queued'); refresh(); }, onError: (e) => toast.error(e.message) });
  const cancelNotification = trpc.livePackage.cancelNotification.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const grantAccess = trpc.livePackage.grantComplimentaryAccess.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم منح الوصول وتسجيله' : 'Complimentary access granted and audited'); setGrant({ userId: '', reason: '' }); }, onError: (e) => toast.error(e.message) });

  // The query-backed form state is initialized by the effect after the first render.
  // Keep the loading return before every config dereference so a slow/uncached response
  // cannot trip the page error boundary while the admin workspace is still loading.
  if (isLoading || !config || !data?.package) return <DashboardLayout><div className="p-8">{isAr ? 'جاري التحميل...' : 'Loading…'}</div></DashboardLayout>;

  const configPayload = () => ({
    adminVisible: config.adminVisible,
    lifecycle: config.lifecycle,
    cohortKey: config.cohortKey,
    sessionStartsAt: fromAmmanInput(config.sessionStartsAt),
    sessionEndsAt: fromAmmanInput(config.sessionEndsAt),
    recordingPolicy: 'permanent' as const,
    recordingAccessEndsAt: null,
    targetSubscriberCount: config.targetSubscriberCount ? Number(config.targetSubscriberCount) : null,
    cohortStatus: config.cohortStatus,
  });
  const saveConfig = () => updateConfig.mutate(configPayload());
  const preview = () => previewConfig.mutate({ ...configPayload(), courseIds: [] });

  const sessionComplete = Boolean(
    session.titleEn.trim()
    && session.titleAr.trim()
    && session.startsAt
    && session.endsAt
    && session.zoomJoinUrl.trim(),
  );

  const recurrencePreview = (() => {
    if (!sessionComplete) return [] as typeof session[];
    const weeks = Math.max(1, Math.min(12, Number(recurrence.weeks) || 1));
    const parseDays = (value: string) => value.split(',').map((item) => Number(item.trim())).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).slice(0, 2);
    const start = new Date(fromAmmanInput(session.startsAt));
    const end = new Date(fromAmmanInput(session.endsAt));
    const duration = end.getTime() - start.getTime();
    const build = (days: number[], type: 'educational' | 'trading_analysis') => days.flatMap((day) => Array.from({ length: weeks }, (_, week) => {
      const occurrenceStart = new Date(start);
      const offset = ((day - occurrenceStart.getUTCDay() + 7) % 7) + (week * 7);
      occurrenceStart.setUTCDate(occurrenceStart.getUTCDate() + offset);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      return {
        ...session,
        sessionType: type,
        titleEn: type === 'educational' ? session.titleEn : `${session.titleEn} Analysis`,
        titleAr: type === 'educational' ? session.titleAr : `${session.titleAr} - تحليل`,
        startsAt: toAmmanInput(occurrenceStart.toISOString()),
        endsAt: toAmmanInput(occurrenceEnd.toISOString()),
      };
    }));
    return [...build(parseDays(recurrence.educationalDays), 'educational'), ...build(parseDays(recurrence.analysisDays), 'trading_analysis')]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 40);
  })();

  const uploadRecordingFile = async () => {
    if (!recording.file) return;
    setRecordingUploading(true);
    setRecordingProgress(0);
    let uploadToken = '';
    const partSize = 25 * 1024 * 1024;
    try {
      const draft = JSON.parse(localStorage.getItem('liveRecordingUploadDraft') || 'null') as null | { uploadToken?: string; fileName?: string; size?: number };
      if (draft?.uploadToken && draft.fileName === recording.file.name && draft.size === recording.file.size) {
        const draftStatus = await fetch(`/api/live-package-recordings/multipart/status?token=${encodeURIComponent(draft.uploadToken)}`, { credentials: 'include' });
        if (draftStatus.ok) uploadToken = draft.uploadToken;
      }
      if (!uploadToken) {
        const initiate = await fetch('/api/live-package-recordings/multipart/initiate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: recording.file.name, contentType: recording.file.type, sizeBytes: recording.file.size }),
        });
        const initiated = await initiate.json().catch(() => ({}));
        if (!initiate.ok) throw new Error(initiated.message || 'Recording upload initiation failed');
        uploadToken = initiated.uploadToken;
        localStorage.setItem('liveRecordingUploadDraft', JSON.stringify({ uploadToken, fileName: recording.file.name, size: recording.file.size }));
      }
      const status = await fetch(`/api/live-package-recordings/multipart/status?token=${encodeURIComponent(uploadToken)}`, { credentials: 'include' }).then((r) => r.json()).catch(() => null);
      const completedParts = new Set((status?.upload?.completedParts ?? []).map((part: any) => Number(part.partNumber)));
      for (let offset = 0, partNumber = 1; offset < recording.file.size; offset += partSize, partNumber += 1) {
        if (completedParts.has(partNumber)) continue;
        const chunk = recording.file.slice(offset, Math.min(recording.file.size, offset + partSize));
        const part = await fetch(`/api/live-package-recordings/multipart/part?token=${encodeURIComponent(uploadToken)}&partNumber=${partNumber}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': recording.file.type },
          body: chunk,
        });
        const partPayload = await part.json().catch(() => ({}));
        if (!part.ok) throw new Error(partPayload.message || `Part ${partNumber} upload failed`);
        setRecordingProgress(Math.round(Math.min(100, ((offset + chunk.size) / recording.file.size) * 100)));
      }
      const complete = await fetch(`/api/live-package-recordings/multipart/complete?token=${encodeURIComponent(uploadToken)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleEn: recording.titleEn.trim(), titleAr: recording.titleAr.trim() }),
      });
      const completed = await complete.json().catch(() => ({}));
      if (!complete.ok) throw new Error(completed.message || 'Recording completion failed');
      toast.success(isAr ? 'تم رفع التسجيل كمسودة' : 'Recording uploaded as a draft');
      setRecording({ titleEn: '', titleAr: '', file: null });
      localStorage.removeItem('liveRecordingUploadDraft');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Recording upload failed');
    } finally {
      setRecordingUploading(false);
      setRecordingProgress(0);
    }
  };

  return <DashboardLayout>
    <main className="space-y-6 p-4 md:p-8" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Radio className="text-emerald-600" />{isAr ? 'إدارة بكج لايف' : 'Live Package control room'}</h1><p className="mt-1 text-sm text-slate-500">₪2,000 · {isAr ? 'شامل الضريبة' : 'VAT inclusive'} · {data.config.cohortKey}</p></div>
        <Badge variant={data.availability.deploymentEnabled ? 'default' : 'destructive'}>{data.availability.deploymentEnabled ? (isAr ? 'النشر مفعّل' : 'Deployment enabled') : (isAr ? 'مفتاح النشر متوقف' : 'Deployment switch OFF')}</Badge>
      </header>

      {!data.availability.deploymentEnabled && <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><ShieldAlert className="h-5 w-5 shrink-0" /><span>{isAr ? 'البكج مخفي عن الجمهور والشراء ممنوع مهما كانت إعدادات لوحة التحكم.' : 'Public visibility and purchase remain blocked regardless of the controls below until the deployment switch is explicitly enabled.'}</span></div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [isAr ? 'طلبات جديدة' : 'New orders', data.stats.newOrders],
          [isAr ? 'بانتظار التأكيد' : 'Awaiting confirmation', data.stats.awaitingConfirmation],
          [isAr ? 'مدفوعة' : 'Paid', data.stats.paidOrders],
          [isAr ? 'مفاتيح مفعلة' : 'Activated keys', data.stats.activatedKeys],
          [isAr ? 'استحقاقات فعالة' : 'Active entitlements', data.stats.activeEntitlements],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
      </section>

      <section className={`rounded-2xl border-2 p-5 ${data.config.registrationOpen ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{isAr ? 'حالة التسجيل' : 'Registration state'}</h2>
            <div className="mt-2 flex items-center gap-2"><Badge variant={data.config.registrationOpen ? 'default' : 'secondary'}>{data.config.registrationOpen ? (isAr ? 'مفتوح' : 'OPEN') : (isAr ? 'مغلق' : 'CLOSED')}</Badge><span className="text-sm text-slate-600">{isAr ? 'هذا المفتاح وحده يتحكم بإنشاء الطلبات الجديدة.' : 'This switch alone controls new order creation.'}</span></div>
            {data.config.cohortStatus === 'completed' && !data.config.registrationOpen && <p className="mt-3 text-sm font-semibold text-amber-800">{isAr ? 'تحذير: الفوج مكتمل. فتح التسجيل مسموح لكنه سيبيع وصول التسجيلات بلا وعد بلقاءات مستقبلية.' : 'Warning: the cohort is completed. Reopening is allowed, but sells recording access without promising future sessions.'}</p>}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant={data.config.registrationOpen ? 'destructive' : 'default'} disabled={setRegistration.isPending}>{data.config.registrationOpen ? (isAr ? 'إغلاق التسجيل' : 'Close registration') : (isAr ? 'فتح التسجيل' : 'Open registration')}</Button></AlertDialogTrigger>
            <AlertDialogContent dir={isAr ? 'rtl' : 'ltr'}>
              <AlertDialogHeader><AlertDialogTitle>{isAr ? 'تأكيد تغيير حالة التسجيل' : 'Confirm registration change'}</AlertDialogTitle><AlertDialogDescription>{data.config.registrationOpen ? (isAr ? 'سيُمنع إنشاء الطلبات الجديدة فوراً. لن تتأثر مراجعة الدفعات أو إصدار المفاتيح أو تفعيلها أو الوصول الحالي.' : 'New orders will be blocked immediately. Payment review, key issuance, activation, and existing access remain available.') : (isAr ? 'سيصبح إنشاء طلبات جديدة متاحاً فوراً حسب أهلية كل حساب.' : 'New orders will become available immediately according to each account’s eligibility.')}</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel><AlertDialogAction onClick={() => setRegistration.mutate({ registrationOpen: !data.config.registrationOpen })}>{isAr ? 'تأكيد' : 'Confirm'}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div><h2 className="flex items-center gap-2 font-bold text-sky-950"><ClipboardList className="h-5 w-5" />{isAr ? 'إجابات صاحبة العمل المتبقية' : 'Remaining owner decisions'}</h2><p className="mt-1 text-sm text-sky-900">{isAr ? 'نموذج قصير يحفظ كل إجابة تلقائياً ويحتفظ بسجل التعديلات.' : 'A short form that autosaves every answer and retains revision history.'}</p></div>
        <Button asChild variant="outline"><Link href="/admin/live-package-review">{isAr ? 'فتح النموذج' : 'Open owner review'}</Link></Button>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-lg font-bold">{isAr ? 'الجاهزية والتحكم' : 'Readiness and controls'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={config.adminVisible} onChange={(e) => setConfig({ ...config, adminVisible: e.target.checked })} />{isAr ? 'ظهور تسويقي' : 'Marketing visibility'}</label>
          <div><Label>{isAr ? 'حالة الفوج' : 'Cohort status'}</Label><select className="mt-1 h-10 w-full rounded-md border px-3" value={config.cohortStatus} onChange={(e) => setConfig({ ...config, cohortStatus: e.target.value })}><option value="not_started">{isAr ? 'لم يبدأ' : 'Not started'}</option><option value="in_progress">{isAr ? 'قيد التنفيذ' : 'In progress'}</option><option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option></select></div>
          <div><Label>{isAr ? 'رمز الفوج' : 'Cohort key'}</Label><Input value={config.cohortKey} onChange={(e) => setConfig({ ...config, cohortKey: e.target.value })} /></div>
          <div><Label>{isAr ? 'العدد المستهدف (اختياري)' : 'Target subscribers (optional)'}</Label><Input type="number" min="1" value={config.targetSubscriberCount ?? ''} onChange={(e) => setConfig({ ...config, targetSubscriberCount: e.target.value ? Number(e.target.value) : null })} /></div>
          {(['sessionStartsAt', 'sessionEndsAt'] as const).map((key) => <div key={key}><Label>{isAr ? (key === 'sessionStartsAt' ? 'بداية اللقاءات' : 'نهاية اللقاءات') : key}</Label><Input type="datetime-local" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })} /></div>)}
          <div className="rounded-lg border bg-slate-50 p-3 text-sm"><Label>{isAr ? 'سياسة التسجيلات' : 'Recording policy'}</Label><p className="mt-2 font-semibold text-emerald-800">{isAr ? 'وصول دائم ما لم يُلغَ صراحةً أو يُسترد المبلغ' : 'Permanent unless explicitly revoked or refunded'}</p></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{isAr ? 'جميع الأوقات معروضة بتوقيت عمّان.' : 'All date controls use Asia/Amman time.'}</p>
        <p className="mt-3 text-xs text-slate-500">{isAr ? 'يمكن ترك تواريخ اللقاءات فارغة إلى أن تعتمد المالكة الجدول النهائي.' : 'Leave the meeting dates empty until the owner approves the final schedule.'}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={preview} disabled={previewConfig.isPending}><Eye className="me-2 h-4 w-4" />{previewConfig.isPending ? (isAr ? 'جاري إنشاء المعاينة…' : 'Building preview…') : (isAr ? 'معاينة كما ستظهر عند التفعيل' : 'Preview as enabled')}</Button><Button onClick={saveConfig} disabled={updateConfig.isPending}><Save className="me-2 h-4 w-4" />{isAr ? 'حفظ' : 'Save configuration'}</Button></div>
        {!!data.availability.errors.length && <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-red-700">{data.availability.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      </section>

      {/* The journey demo intentionally uses the already-loaded admin workspace so the
          owner can review it before the launch gates are fully configured. */}
      <LivePackageJourneyPreview data={data} isAr={isAr} />

      {previewConfig.data && <section className="overflow-hidden rounded-3xl border-2 border-dashed border-violet-300 bg-white shadow-xl">
        <div className="flex items-center gap-2 bg-violet-100 px-5 py-3 text-sm font-bold text-violet-950"><Eye className="h-4 w-4" />{isAr ? 'معاينة فقط — لم يتم حفظ أو تفعيل أي شيء' : 'Preview only — nothing was saved or enabled'}</div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
          <div><Badge className="mb-3 bg-emerald-700">{previewConfig.data.config.lifecycle === 'active' ? (isAr ? 'بكج مؤقت ومحدود' : 'Limited live package') : (isAr ? 'قريباً' : 'Coming soon')}</Badge><h2 className="text-3xl font-black">{isAr ? previewConfig.data.package?.nameAr : previewConfig.data.package?.nameEn}</h2><p className="mt-3 leading-7 text-slate-600">{isAr ? previewConfig.data.package?.descriptionAr : previewConfig.data.package?.descriptionEn}</p><div className="mt-5 text-3xl font-black text-emerald-700">₪2,000 <span className="text-sm font-medium text-slate-500">{isAr ? 'شامل الضريبة' : 'VAT inclusive'}</span></div><Button className="mt-5" disabled={!previewConfig.data.availability.purchasable}>{previewConfig.data.availability.purchasable ? (isAr ? 'اشترِ الآن' : 'Buy now') : (isAr ? 'ترقبوا الحدث الأضخم هالسنة' : 'Launching soon')}</Button></div>
          <div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-bold">{isAr ? 'ما يشمله البكج' : 'What is included'}</h3><ul className="mt-3 space-y-2 text-sm"><li>✓ {isAr ? 'لقاءات مباشرة وتسجيلات محمية' : 'Live sessions and protected recordings'}</li><li>✓ {previewConfig.data.config.recordingPolicy === 'permanent' ? (isAr ? 'وصول دائم للتسجيلات' : 'Permanent recording access') : (isAr ? 'وصول للتسجيلات حتى التاريخ المحدد' : 'Recording access until the selected date')}</li></ul><div className="mt-4 border-t pt-4 text-xs text-slate-500">{isAr ? 'فترة اللقاءات' : 'Live period'}: {previewConfig.data.config.sessionStartsAt && previewConfig.data.config.sessionEndsAt ? `${toAmmanInput(previewConfig.data.config.sessionStartsAt).replace('T', ' ')} — ${toAmmanInput(previewConfig.data.config.sessionEndsAt).replace('T', ' ')}` : (isAr ? 'سيُعلن الجدول عند اعتماده' : 'Schedule will be announced once approved')}</div></div>
        </div>
        {!!previewConfig.data.availability.errors.length && <ul className="border-t bg-red-50 p-5 text-sm text-red-800">{previewConfig.data.availability.errors.map(error => <li key={error}>• {error}</li>)}</ul>}
      </section>}

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CalendarPlus className="h-5 w-5" />{isAr ? 'جدولة اللقاءات' : 'Session schedule'}</h2><div className="grid gap-3 md:grid-cols-2"><select className="h-10 rounded-md border px-3" value={session.sessionType} onChange={(e) => setSession({ ...session, sessionType: e.target.value as any })}><option value="educational">{isAr ? 'تعليمي' : 'Educational'}</option><option value="trading_analysis">{isAr ? 'تداول وتحليل مباشر' : 'Trading analysis'}</option></select><Input placeholder="English title" value={session.titleEn} onChange={(e) => setSession({ ...session, titleEn: e.target.value })} /><Input placeholder="العنوان بالعربية" value={session.titleAr} onChange={(e) => setSession({ ...session, titleAr: e.target.value })} /><Input type="datetime-local" value={session.startsAt} onChange={(e) => setSession({ ...session, startsAt: e.target.value })} /><Input type="datetime-local" value={session.endsAt} onChange={(e) => setSession({ ...session, endsAt: e.target.value })} /><Input className="md:col-span-2" dir="ltr" type="url" placeholder="Protected https://…zoom.us/… link" value={session.zoomJoinUrl} onChange={(e) => setSession({ ...session, zoomJoinUrl: e.target.value })} /><Textarea placeholder="English description" value={session.descriptionEn} onChange={(e) => setSession({ ...session, descriptionEn: e.target.value })} /><Textarea placeholder="الوصف بالعربية" value={session.descriptionAr} onChange={(e) => setSession({ ...session, descriptionAr: e.target.value })} /></div><div className="mt-3 flex flex-wrap gap-2"><Button disabled={!sessionComplete || createSession.isPending} onClick={() => createSession.mutate({ sessionType: session.sessionType, titleEn: session.titleEn.trim(), titleAr: session.titleAr.trim(), descriptionEn: session.descriptionEn.trim(), descriptionAr: session.descriptionAr.trim(), startsAt: fromAmmanInput(session.startsAt), endsAt: fromAmmanInput(session.endsAt), zoomJoinUrl: session.zoomJoinUrl.trim() })}>{isAr ? 'إضافة اللقاء' : 'Add session'}</Button><Button variant="outline" disabled={!recurrencePreview.length || createSessions.isPending} onClick={() => createSessions.mutate({ sessions: recurrencePreview.map((item) => ({ ...item, startsAt: fromAmmanInput(item.startsAt), endsAt: fromAmmanInput(item.endsAt), zoomJoinUrl: item.zoomJoinUrl.trim() })) })}>{isAr ? 'حفظ التكرار' : 'Save recurrence preview'}</Button></div><div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-3"><Input type="number" min="1" max="12" value={recurrence.weeks} onChange={(e) => setRecurrence({ ...recurrence, weeks: e.target.value })} placeholder="Weeks" /><Input value={recurrence.educationalDays} onChange={(e) => setRecurrence({ ...recurrence, educationalDays: e.target.value })} placeholder="Educational days 1,3" /><Input value={recurrence.analysisDays} onChange={(e) => setRecurrence({ ...recurrence, analysisDays: e.target.value })} placeholder="Analysis days 2,4" /></div>{!!recurrencePreview.length && <div className="mt-3 max-h-44 overflow-auto rounded-xl border p-3 text-xs">{recurrencePreview.map((item, index) => <p key={`${item.startsAt}-${index}`}>{item.sessionType === 'educational' ? 'Education' : 'Analysis'} · {item.startsAt.replace('T', ' ')}</p>)}</div>}<p className="mt-2 text-xs text-slate-500">{isAr ? 'يمكن إنشاء اللقاءات قبل اعتماد تواريخ الفوج النهائية، ولا يوجد شرط للوصول إلى 40 مشترك.' : 'Sessions can be created before final cohort dates are approved; the target of 40 is informational only.'}</p><div className="mt-5 space-y-2">{data.sessions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span><Badge variant="outline" className="me-2">{item.sessionType === 'trading_analysis' ? (isAr ? 'تحليل' : 'Analysis') : (isAr ? 'تعليمي' : 'Education')}</Badge>{isAr ? item.titleAr : item.titleEn} · {toAmmanInput(item.startsAt).replace('T', ' ')} · {item.status}</span><Button size="sm" variant="outline" onClick={() => updateSession.mutate({ id: item.id, status: item.status === 'cancelled' ? 'scheduled' : 'cancelled' })}>{item.status === 'cancelled' ? 'Restore' : 'Cancel'}</Button></div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-lg font-bold">{isAr ? 'إشعارات اللقاءات' : 'Live meeting notifications'}</h2><div className="grid gap-3 md:grid-cols-5"><select className="h-10 rounded-md border px-3 md:col-span-2" value={notificationSessionId} onChange={(e) => setNotificationSessionId(e.target.value)}><option value="">{isAr ? 'اختاري لقاء' : 'Choose a session'}</option>{data.sessions.filter((item) => item.status !== 'cancelled').map((item) => <option key={item.id} value={item.id}>{isAr ? item.titleAr : item.titleEn}</option>)}</select><select className="h-10 rounded-md border px-3" value={notificationTiming.mode} onChange={(e) => setNotificationTiming({ ...notificationTiming, mode: e.target.value as any })}><option value="now">{isAr ? 'الآن' : 'Now'}</option><option value="after_hours">{isAr ? 'بعد ساعات' : 'After hours'}</option><option value="at">{isAr ? 'وقت محدد' : 'Specific time'}</option></select>{notificationTiming.mode === 'after_hours' ? <Input type="number" min="1" max="168" value={notificationTiming.afterHours} onChange={(e) => setNotificationTiming({ ...notificationTiming, afterHours: e.target.value })} /> : <Input type="datetime-local" disabled={notificationTiming.mode !== 'at'} value={notificationTiming.scheduledFor} onChange={(e) => setNotificationTiming({ ...notificationTiming, scheduledFor: e.target.value })} />}<Button disabled={!notificationSessionId || scheduleNotification.isPending} onClick={() => scheduleNotification.mutate({ sessionId: Number(notificationSessionId), mode: notificationTiming.mode, afterHours: Number(notificationTiming.afterHours), scheduledFor: fromAmmanInput(notificationTiming.scheduledFor) })}>{isAr ? 'جدولة' : 'Queue'}</Button></div><Button className="mt-3" variant="outline" disabled={!notificationSessionId || previewNotification.isFetching} onClick={() => previewNotification.refetch()}>{isAr ? 'معاينة العدد والرسالة' : 'Preview count and message'}</Button>{previewNotification.data && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p>{isAr ? 'عدد المستلمين المؤهلين الآن' : 'Eligible recipients now'}: <b>{previewNotification.data.recipientCount}</b></p><pre className="mt-2 whitespace-pre-wrap text-slate-600">{previewNotification.data.bodyText}</pre></div>}<div className="mt-5 space-y-2">{(data.notificationJobs ?? []).map((job: any) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span><Badge variant={job.status === 'failed' ? 'destructive' : job.status === 'cancelled' ? 'secondary' : 'default'}>{job.status}</Badge> · {toAmmanInput(job.scheduledFor).replace('T', ' ')} · {job.materializedCount}/{job.recipientCount} {isAr ? 'مستلم' : 'recipients'}</span>{job.status === 'queued' && <Button size="sm" variant="outline" onClick={() => cancelNotification.mutate({ id: job.id })}>{isAr ? 'إلغاء' : 'Cancel'}</Button>}</div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5" />{isAr ? 'التسجيلات المحمية' : 'Protected recordings'}</h2><div className="grid gap-3 md:grid-cols-2"><Input placeholder="English title" value={recording.titleEn} onChange={(e) => setRecording({ ...recording, titleEn: e.target.value })} /><Input placeholder="العنوان بالعربية" value={recording.titleAr} onChange={(e) => setRecording({ ...recording, titleAr: e.target.value })} /><Input className="md:col-span-2" type="file" accept="video/mp4,video/webm" onChange={(e) => setRecording({ ...recording, file: e.target.files?.[0] ?? null })} /></div><Button className="mt-3" disabled={!recording.file || recordingUploading || !recording.titleEn.trim() || !recording.titleAr.trim()} onClick={uploadRecordingFile}>{recordingUploading ? `${isAr ? 'جاري الرفع' : 'Uploading'} ${recordingProgress}%` : (isAr ? 'رفع كمسودة' : 'Upload draft')}</Button><p className="mt-2 text-xs text-slate-500">{isAr ? 'يُرفع الملف على أجزاء إلى التخزين المحمي ويمكن استئناف الأجزاء المكتملة من نفس المتصفح.' : 'The file uploads in private R2 parts and completed parts can resume from the same browser.'}</p><div className="mt-5 space-y-2">{data.recordings.map((item) => <div key={item.id} className="space-y-3 rounded-lg border p-3"><div className="flex items-center justify-between"><span>{isAr ? item.titleAr : item.titleEn}</span><Button size="sm" variant="outline" onClick={() => updateRecording.mutate({ id: item.id, isPublished: !item.isPublished })}>{item.isPublished ? 'Unpublish' : 'Publish'}</Button></div><div className="grid gap-2 md:grid-cols-2"><Input defaultValue={item.titleEn} onBlur={(e) => e.target.value.trim() && updateRecording.mutate({ id: item.id, titleEn: e.target.value.trim() })} /><Input defaultValue={item.titleAr} onBlur={(e) => e.target.value.trim() && updateRecording.mutate({ id: item.id, titleAr: e.target.value.trim() })} /></div></div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-2 text-lg font-bold">{isAr ? 'منح وصول مجاني مدقق' : 'Audited complimentary access'}</h2><p className="mb-4 text-sm text-slate-500">{isAr ? 'لا يحصل الموظفون أو الدعم على وصول تلقائي.' : 'Employees and support staff never receive automatic access.'}</p><div className="grid gap-3 md:grid-cols-2"><Input type="number" placeholder="User ID" value={grant.userId} onChange={(e) => setGrant({ ...grant, userId: e.target.value })} /><Textarea placeholder="Required business reason (minimum 10 characters)" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /></div><Button className="mt-3" onClick={() => grantAccess.mutate({ userId: Number(grant.userId), reason: grant.reason })}>{isAr ? 'منح الوصول' : 'Grant access'}</Button></section>
    </main>
  </DashboardLayout>;
}
