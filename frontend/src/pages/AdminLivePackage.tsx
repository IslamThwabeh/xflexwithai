import { useEffect, useState } from 'react';
import { CalendarPlus, ClipboardList, Eye, Radio, Save, ShieldAlert, Upload } from 'lucide-react';
import { Link } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import LivePackageJourneyPreview from '@/components/admin/LivePackageJourneyPreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const toAmmanInput = (iso: string) => new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
const fromAmmanInput = (value: string) => new Date(`${value}:00+03:00`).toISOString();

export default function AdminLivePackage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.livePackage.adminWorkspace.useQuery();
  const { data: allCourses } = trpc.courses.listAll.useQuery();
  const [config, setConfig] = useState<any>(null);
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [session, setSession] = useState({ titleEn: '', titleAr: '', startsAt: '', endsAt: '', zoomJoinUrl: '' });
  const [grant, setGrant] = useState({ userId: '', reason: '' });
  const [recording, setRecording] = useState({ titleEn: '', titleAr: '', file: null as File | null });
  const [recordingUploading, setRecordingUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setConfig({
      ...data.config,
      salesStartsAt: toAmmanInput(data.config.salesStartsAt),
      salesEndsAt: toAmmanInput(data.config.salesEndsAt),
      sessionStartsAt: toAmmanInput(data.config.sessionStartsAt),
      sessionEndsAt: toAmmanInput(data.config.sessionEndsAt),
      recordingAccessEndsAt: data.config.recordingAccessEndsAt ? toAmmanInput(data.config.recordingAccessEndsAt) : '',
    });
    setCourseIds(data.courses.map((course) => course.courseId));
  }, [data]);

  const refresh = () => utils.livePackage.adminWorkspace.invalidate();
  const updateConfig = trpc.packages.updateLiveConfig.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم حفظ الإعدادات' : 'Configuration saved'); refresh(); } });
  const previewConfig = trpc.packages.previewLiveConfig.useMutation({ onError: (e) => toast.error(e.message) });
  const setCourses = trpc.packages.setCourses.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم حفظ الدورات' : 'Courses saved'); refresh(); } });
  const createSession = trpc.livePackage.createSession.useMutation({ onSuccess: () => { toast.success(isAr ? 'تمت جدولة اللقاء' : 'Session scheduled'); setSession({ titleEn: '', titleAr: '', startsAt: '', endsAt: '', zoomJoinUrl: '' }); refresh(); }, onError: (e) => toast.error(e.message) });
  const updateSession = trpc.livePackage.updateSession.useMutation({ onSuccess: refresh });
  const updateRecording = trpc.livePackage.updateRecording.useMutation({ onSuccess: refresh });
  const grantAccess = trpc.livePackage.grantComplimentaryAccess.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم منح الوصول وتسجيله' : 'Complimentary access granted and audited'); setGrant({ userId: '', reason: '' }); }, onError: (e) => toast.error(e.message) });

  // The query-backed form state is initialized by the effect after the first render.
  // Keep the loading return before every config dereference so a slow/uncached response
  // cannot trip the page error boundary while the admin workspace is still loading.
  if (isLoading || !config || !data?.package) return <DashboardLayout><div className="p-8">{isAr ? 'جاري التحميل...' : 'Loading…'}</div></DashboardLayout>;

  const configPayload = () => ({
    adminVisible: config.adminVisible,
    purchaseApproved: config.purchaseApproved,
    lifecycle: config.lifecycle,
    cohortKey: config.cohortKey,
    salesStartsAt: fromAmmanInput(config.salesStartsAt),
    salesEndsAt: fromAmmanInput(config.salesEndsAt),
    sessionStartsAt: fromAmmanInput(config.sessionStartsAt),
    sessionEndsAt: fromAmmanInput(config.sessionEndsAt),
    recordingPolicy: config.recordingPolicy,
    recordingAccessEndsAt: config.recordingPolicy === 'until_date' ? fromAmmanInput(config.recordingAccessEndsAt) : null,
  });
  const saveConfig = () => updateConfig.mutate(configPayload());
  const preview = () => previewConfig.mutate({ ...configPayload(), courseIds });

  const configDatesComplete = Boolean(
    config.salesStartsAt
    && config.salesEndsAt
    && config.sessionStartsAt
    && config.sessionEndsAt
    && (config.recordingPolicy !== 'until_date' || config.recordingAccessEndsAt),
  );
  const sessionComplete = Boolean(
    session.titleEn.trim()
    && session.titleAr.trim()
    && session.startsAt
    && session.endsAt
    && session.zoomJoinUrl.trim(),
  );

  const uploadRecordingFile = async () => {
    if (!recording.file) return;
    setRecordingUploading(true);
    try {
      const params = new URLSearchParams({ titleEn: recording.titleEn.trim(), titleAr: recording.titleAr.trim(), fileName: recording.file.name });
      const response = await fetch(`/api/live-package-recordings/upload?${params}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': recording.file.type },
        body: recording.file,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Recording upload failed');
      toast.success(isAr ? 'تم رفع التسجيل كمسودة' : 'Recording uploaded as a draft');
      setRecording({ titleEn: '', titleAr: '', file: null });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Recording upload failed');
    } finally {
      setRecordingUploading(false);
    }
  };

  return <DashboardLayout>
    <main className="space-y-6 p-4 md:p-8" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Radio className="text-emerald-600" />{isAr ? 'إدارة بكج لايف' : 'Live Package control room'}</h1><p className="mt-1 text-sm text-slate-500">₪2,000 · VAT inclusive · {data.config.cohortKey}</p></div>
        <Badge variant={data.availability.deploymentEnabled ? 'default' : 'destructive'}>{data.availability.deploymentEnabled ? 'Deployment enabled' : 'Deployment switch OFF'}</Badge>
      </header>

      {!data.availability.deploymentEnabled && <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><ShieldAlert className="h-5 w-5 shrink-0" /><span>{isAr ? 'البكج مخفي عن الجمهور والشراء ممنوع مهما كانت إعدادات لوحة التحكم.' : 'Public visibility and purchase remain blocked regardless of the controls below until the deployment switch is explicitly enabled.'}</span></div>}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div><h2 className="flex items-center gap-2 font-bold text-sky-950"><ClipboardList className="h-5 w-5" />{isAr ? 'إجابات صاحبة العمل المتبقية' : 'Remaining owner decisions'}</h2><p className="mt-1 text-sm text-sky-900">{isAr ? 'نموذج قصير يحفظ كل إجابة تلقائياً ويحتفظ بسجل التعديلات.' : 'A short form that autosaves every answer and retains revision history.'}</p></div>
        <Button asChild variant="outline"><Link href="/admin/live-package-review">{isAr ? 'فتح النموذج' : 'Open owner review'}</Link></Button>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-lg font-bold">{isAr ? 'الجاهزية والتحكم' : 'Readiness and controls'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={config.adminVisible} onChange={(e) => setConfig({ ...config, adminVisible: e.target.checked })} />{isAr ? 'ظهور تسويقي' : 'Marketing visibility'}</label>
          <label className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={config.purchaseApproved} onChange={(e) => setConfig({ ...config, purchaseApproved: e.target.checked })} />{isAr ? 'اعتماد الشراء' : 'Purchase approval'}</label>
          <div><Label>{isAr ? 'حالة الدورة' : 'Lifecycle'}</Label><select className="mt-1 h-10 w-full rounded-md border px-3" value={config.lifecycle} onChange={(e) => setConfig({ ...config, lifecycle: e.target.value })}><option value="coming_soon">Coming soon</option><option value="active">Active</option><option value="expired">Expired</option></select></div>
          <div><Label>Cohort key</Label><Input value={config.cohortKey} onChange={(e) => setConfig({ ...config, cohortKey: e.target.value })} /></div>
          {(['salesStartsAt', 'salesEndsAt', 'sessionStartsAt', 'sessionEndsAt'] as const).map((key) => <div key={key}><Label>{key}</Label><Input type="datetime-local" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })} /></div>)}
          <div><Label>{isAr ? 'سياسة التسجيلات' : 'Recording policy'}</Label><select className="mt-1 h-10 w-full rounded-md border px-3" value={config.recordingPolicy} onChange={(e) => setConfig({ ...config, recordingPolicy: e.target.value })}><option value="permanent">Permanent</option><option value="until_date">Until date</option></select></div>
          {config.recordingPolicy === 'until_date' && <div><Label>{isAr ? 'نهاية الوصول للتسجيلات' : 'Recording access ends'}</Label><Input type="datetime-local" value={config.recordingAccessEndsAt} onChange={(e) => setConfig({ ...config, recordingAccessEndsAt: e.target.value })} /></div>}
        </div>
        <p className="mt-3 text-xs text-slate-500">{isAr ? 'جميع الأوقات معروضة بتوقيت عمّان.' : 'All date controls use Asia/Amman time.'}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={preview} disabled={previewConfig.isPending || !configDatesComplete || !courseIds.length}><Eye className="me-2 h-4 w-4" />{previewConfig.isPending ? (isAr ? 'جاري إنشاء المعاينة…' : 'Building preview…') : (isAr ? 'معاينة كما ستظهر عند التفعيل' : 'Preview as enabled')}</Button><Button onClick={saveConfig} disabled={updateConfig.isPending || !configDatesComplete}><Save className="me-2 h-4 w-4" />{isAr ? 'حفظ' : 'Save configuration'}</Button></div>
        {!!data.availability.errors.length && <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-red-700">{data.availability.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      </section>

      {/* The journey demo intentionally uses the already-loaded admin workspace so the
          owner can review it before courses and launch gates are fully configured. */}
      <LivePackageJourneyPreview data={data} isAr={isAr} />

      {previewConfig.data && <section className="overflow-hidden rounded-3xl border-2 border-dashed border-violet-300 bg-white shadow-xl">
        <div className="flex items-center gap-2 bg-violet-100 px-5 py-3 text-sm font-bold text-violet-950"><Eye className="h-4 w-4" />{isAr ? 'معاينة فقط — لم يتم حفظ أو تفعيل أي شيء' : 'Preview only — nothing was saved or enabled'}</div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
          <div><Badge className="mb-3 bg-emerald-700">{previewConfig.data.config.lifecycle === 'active' ? (isAr ? 'بكج مؤقت ومحدود' : 'Limited live package') : (isAr ? 'قريباً' : 'Coming soon')}</Badge><h2 className="text-3xl font-black">{isAr ? previewConfig.data.package?.nameAr : previewConfig.data.package?.nameEn}</h2><p className="mt-3 leading-7 text-slate-600">{isAr ? previewConfig.data.package?.descriptionAr : previewConfig.data.package?.descriptionEn}</p><div className="mt-5 text-3xl font-black text-emerald-700">₪2,000 <span className="text-sm font-medium text-slate-500">{isAr ? 'شامل الضريبة' : 'VAT inclusive'}</span></div><Button className="mt-5" disabled={!previewConfig.data.availability.purchasable}>{previewConfig.data.availability.purchasable ? (isAr ? 'اشترِ الآن' : 'Buy now') : (isAr ? 'ترقبوا الحدث الأضخم هالسنة' : 'Launching soon')}</Button></div>
          <div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-bold">{isAr ? 'ما يشمله البكج' : 'What is included'}</h3><ul className="mt-3 space-y-2 text-sm">{previewConfig.data.courses.map(course => <li key={course.id}>✓ {isAr ? course.titleAr : course.titleEn}</li>)}<li>✓ {isAr ? 'لقاءات مباشرة وتسجيلات محمية' : 'Live sessions and protected recordings'}</li><li>✓ {previewConfig.data.config.recordingPolicy === 'permanent' ? (isAr ? 'وصول دائم للتسجيلات' : 'Permanent recording access') : (isAr ? 'وصول للتسجيلات حتى التاريخ المحدد' : 'Recording access until the selected date')}</li></ul><div className="mt-4 border-t pt-4 text-xs text-slate-500">{isAr ? 'فترة اللقاءات' : 'Live period'}: {toAmmanInput(previewConfig.data.config.sessionStartsAt).replace('T', ' ')} — {toAmmanInput(previewConfig.data.config.sessionEndsAt).replace('T', ' ')}</div></div>
        </div>
        {!!previewConfig.data.availability.errors.length && <ul className="border-t bg-red-50 p-5 text-sm text-red-800">{previewConfig.data.availability.errors.map(error => <li key={error}>• {error}</li>)}</ul>}
      </section>}

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 text-lg font-bold">{isAr ? 'الدورات الأساسية الدائمة' : 'Permanent base courses'}</h2><div className="grid gap-2 md:grid-cols-2">{allCourses?.map((course) => <label key={course.id} className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" checked={courseIds.includes(course.id)} onChange={(e) => setCourseIds(e.target.checked ? [...courseIds, course.id] : courseIds.filter((id) => id !== course.id))} />{isAr ? course.titleAr : course.titleEn}</label>)}</div><Button className="mt-4" disabled={!courseIds.length} onClick={() => setCourses.mutate({ packageId: data.package!.id, courseIds })}>{isAr ? 'حفظ الدورات' : 'Save courses'}</Button></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CalendarPlus className="h-5 w-5" />{isAr ? 'جدولة اللقاءات' : 'Session schedule'}</h2><div className="grid gap-3 md:grid-cols-2"><Input placeholder="English title" value={session.titleEn} onChange={(e) => setSession({ ...session, titleEn: e.target.value })} /><Input placeholder="العنوان بالعربية" value={session.titleAr} onChange={(e) => setSession({ ...session, titleAr: e.target.value })} /><Input type="datetime-local" value={session.startsAt} onChange={(e) => setSession({ ...session, startsAt: e.target.value })} /><Input type="datetime-local" value={session.endsAt} onChange={(e) => setSession({ ...session, endsAt: e.target.value })} /><Input className="md:col-span-2" dir="ltr" type="url" placeholder="Protected https://…zoom.us/… link" value={session.zoomJoinUrl} onChange={(e) => setSession({ ...session, zoomJoinUrl: e.target.value })} /></div><Button className="mt-3" disabled={!sessionComplete || createSession.isPending} onClick={() => createSession.mutate({ titleEn: session.titleEn.trim(), titleAr: session.titleAr.trim(), startsAt: fromAmmanInput(session.startsAt), endsAt: fromAmmanInput(session.endsAt), zoomJoinUrl: session.zoomJoinUrl.trim() })}>{isAr ? 'إضافة اللقاء' : 'Add session'}</Button><div className="mt-5 space-y-2">{data.sessions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span>{isAr ? item.titleAr : item.titleEn} · {toAmmanInput(item.startsAt).replace('T', ' ')}</span><Button size="sm" variant="outline" onClick={() => updateSession.mutate({ id: item.id, status: item.status === 'cancelled' ? 'scheduled' : 'cancelled' })}>{item.status === 'cancelled' ? 'Restore' : 'Cancel'}</Button></div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5" />{isAr ? 'التسجيلات المحمية' : 'Protected recordings'}</h2><div className="grid gap-3 md:grid-cols-2"><Input placeholder="English title" value={recording.titleEn} onChange={(e) => setRecording({ ...recording, titleEn: e.target.value })} /><Input placeholder="العنوان بالعربية" value={recording.titleAr} onChange={(e) => setRecording({ ...recording, titleAr: e.target.value })} /><Input className="md:col-span-2" type="file" accept="video/mp4,video/webm" onChange={(e) => setRecording({ ...recording, file: e.target.files?.[0] ?? null })} /></div><Button className="mt-3" disabled={!recording.file || recordingUploading || !recording.titleEn.trim() || !recording.titleAr.trim()} onClick={uploadRecordingFile}>{recordingUploading ? (isAr ? 'جاري الرفع...' : 'Uploading…') : (isAr ? 'رفع كمسودة' : 'Upload draft')}</Button><p className="mt-2 text-xs text-slate-500">{isAr ? 'يُرفع الملف مباشرة إلى التخزين المحمي ويبقى مسودة حتى نشره.' : 'The file streams directly to protected storage and stays draft until published.'}</p><div className="mt-5 space-y-2">{data.recordings.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3"><span>{isAr ? item.titleAr : item.titleEn}</span><Button size="sm" variant="outline" onClick={() => updateRecording.mutate({ id: item.id, isPublished: !item.isPublished })}>{item.isPublished ? 'Unpublish' : 'Publish'}</Button></div>)}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-2 text-lg font-bold">{isAr ? 'منح وصول مجاني مدقق' : 'Audited complimentary access'}</h2><p className="mb-4 text-sm text-slate-500">{isAr ? 'لا يحصل الموظفون أو الدعم على وصول تلقائي.' : 'Employees and support staff never receive automatic access.'}</p><div className="grid gap-3 md:grid-cols-2"><Input type="number" placeholder="User ID" value={grant.userId} onChange={(e) => setGrant({ ...grant, userId: e.target.value })} /><Textarea placeholder="Required business reason (minimum 10 characters)" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /></div><Button className="mt-3" onClick={() => grantAccess.mutate({ userId: Number(grant.userId), reason: grant.reason })}>{isAr ? 'منح الوصول' : 'Grant access'}</Button></section>
    </main>
  </DashboardLayout>;
}
