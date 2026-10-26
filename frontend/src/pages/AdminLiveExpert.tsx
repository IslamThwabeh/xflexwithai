import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Search } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import LiveExpertConversation from '@/components/LiveExpertConversation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageVisible } from '@/hooks/usePageVisible';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

function ExpertEmailPreference() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const utils = trpc.useUtils();
  const prefs = trpc.adminSettings.getNotificationPrefs.useQuery(undefined, { retry: false });
  const [emailEnabled, setEmailEnabled] = useState(true);
  useEffect(() => { if (prefs.data) setEmailEnabled(prefs.data.live_expert_question !== false); }, [prefs.data]);
  const save = trpc.adminSettings.updateNotificationPrefs.useMutation({
    onSuccess: () => { void utils.adminSettings.getNotificationPrefs.invalidate(); toast.success(isAr ? 'تم حفظ تفضيلات البريد.' : 'Email preference saved.'); },
    onError: error => { setEmailEnabled(prefs.data?.live_expert_question !== false); toast.error(error.message); },
  });
  return <div className="rounded-xl border bg-white p-4 text-slate-950">
    <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={prefs.isLoading || !!prefs.error || save.isPending} checked={emailEnabled} onChange={event => { const next = event.target.checked; setEmailEnabled(next); save.mutate({ prefs: { ...prefs.data, live_expert_question: next } }); }} />{isAr ? 'أرسل لي بريداً عند وصول أسئلة جديدة من العملاء' : 'Email me when clients send new questions'}</label>
    <p className="mt-2 text-xs text-slate-500">{isAr ? 'تبقى إشعارات الموقع متاحة عند إيقاف البريد. لا يُرسل البريد للمحادثات التي قرأتها بالفعل.' : 'Website notifications remain available when email is off. Already-read conversations do not trigger an email.'}</p>
    {prefs.error ? <p role="alert" className="mt-2 text-sm text-red-700">{prefs.error.message}</p> : null}
  </div>;
}

function ExpertSettings({ conversationId }: { conversationId?: number }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const settings = trpc.liveExpert.settings.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [expertUserId, setExpertUserId] = useState('');
  const [graceDays, setGraceDays] = useState(7);
  const [availabilityEn, setAvailabilityEn] = useState('');
  const [availabilityAr, setAvailabilityAr] = useState('');
  const [reassignId, setReassignId] = useState('');
  useEffect(() => { if (settings.data) {
    setExpertUserId(String(settings.data.expert_user_id ?? '')); setGraceDays(settings.data.grace_days);
    setAvailabilityEn(settings.data.availability_en); setAvailabilityAr(settings.data.availability_ar);
  } }, [settings.data]);
  const save = trpc.liveExpert.updateSettings.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم حفظ الإعدادات.' : 'Settings saved.'); void utils.liveExpert.settings.invalidate(); }, onError: error => toast.error(error.message) });
  const reassign = trpc.liveExpert.reassign.useMutation({ onSuccess: () => { toast.success(isAr ? 'تم تعيين الخبير للمحادثة.' : 'Conversation reassigned.'); void utils.liveExpert.invalidate(); }, onError: error => toast.error(error.message) });
  return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">{isAr ? 'إعدادات المراسلة · للإدارة' : 'Messaging settings · Admin'}</summary>
    {settings.error ? <p role="alert">{settings.error.message}</p> : !settings.data ? <p>{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={event => { event.preventDefault(); save.mutate({ expertUserId: Number(expertUserId), graceDays, availabilityEn, availabilityAr }); }}>
      <label className="space-y-2 text-sm"><span>{isAr ? 'الخبير للمحادثات الجديدة' : 'Expert for new conversations'}</span><select required className="block w-full rounded-lg border p-2" value={expertUserId} onChange={event => setExpertUserId(event.target.value)}><option value="">{isAr ? 'اختر الخبير' : 'Choose expert'}</option>{settings.data.experts.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span>{isAr ? 'أيام المراسلة الإضافية بعد نهاية الفوج' : 'Messaging grace days after cohort ends'}</span><Input type="number" min={0} max={90} required value={graceDays} onChange={event => setGraceDays(Number(event.target.value))} /></label>
      <label className="space-y-2 text-sm"><span>{isAr ? 'نص التوفر بالإنجليزية' : 'Availability text in English'}</span><Textarea dir="ltr" required maxLength={500} value={availabilityEn} onChange={event => setAvailabilityEn(event.target.value)} /></label>
      <label className="space-y-2 text-sm"><span>{isAr ? 'نص التوفر بالعربية' : 'Availability text in Arabic'}</span><Textarea dir="rtl" required maxLength={500} value={availabilityAr} onChange={event => setAvailabilityAr(event.target.value)} /></label>
      <div className="md:col-span-2"><Button disabled={save.isPending || !expertUserId}>{isAr ? 'حفظ الإعدادات' : 'Save settings'}</Button><p className="mt-2 text-xs text-slate-500">{isAr ? 'المحادثات الحالية تبقى مع خبيرها. عيّن صلاحية خبير لايف من إدارة الصلاحيات.' : 'Existing conversations keep their assigned expert. Assign the Live Expert role in role management.'} <Link className="underline" href="/admin/roles">{isAr ? 'إدارة الصلاحيات' : 'Manage roles'}</Link></p></div>
    </form>}
    {conversationId && settings.data ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4"><label className="text-sm">{isAr ? 'نقل المحادثة المحددة إلى' : 'Reassign selected conversation to'}<select className="ms-2 rounded-lg border p-2" value={reassignId} onChange={event => setReassignId(event.target.value)}><option value="">{isAr ? 'اختر الخبير' : 'Choose expert'}</option>{settings.data.experts.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label><Button variant="outline" disabled={!reassignId || reassign.isPending} onClick={() => reassign.mutate({ conversationId, expertUserId: Number(reassignId) })}>{isAr ? 'نقل المحادثة' : 'Reassign'}</Button></div> : null}
  </details>;
}

export default function AdminLiveExpert() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const visible = usePageVisible();
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | undefined>(() => {
    const id = Number(new URLSearchParams(window.location.search).get('conversationId'));
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  });
  const inbox = trpc.liveExpert.inbox.useQuery({ search, unansweredOnly, offset }, { retry: false, refetchInterval: visible ? 30000 : false, refetchIntervalInBackground: false });
  const selectedThread = inbox.data?.items.find(thread => thread.id === selected);
  return <DashboardLayout><main className="space-y-5 p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><MessageSquare />{isAr ? 'رسائل خبير لايف' : 'Live Expert Inbox'}</h1><p className="mt-2 text-sm text-muted-foreground">{isAr ? 'محادثة مستقلة لكل عميل وفوج، والأسئلة التي تنتظر إجابة تظهر أولاً.' : 'Separate conversations for each client and cohort. Unanswered questions appear first.'}</p></header>
    {inbox.data?.isAdmin ? <ExpertSettings conversationId={selected} /> : null}
    {inbox.data && !inbox.data.isAdmin ? <ExpertEmailPreference /> : null}
    <form className="flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); setSearch(draftSearch.trim()); setOffset(0); }}>
      <label className="sr-only" htmlFor="expert-inbox-search">{isAr ? 'بحث بالاسم أو الفوج' : 'Search name or cohort'}</label><Input className="w-full sm:max-w-xs" id="expert-inbox-search" value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder={isAr ? 'بحث بالاسم أو الفوج' : 'Search name or cohort'} maxLength={100} /><Button type="submit" variant="outline"><Search className="me-2 h-4 w-4" />{isAr ? 'بحث' : 'Search'}</Button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unansweredOnly} onChange={event => { setUnansweredOnly(event.target.checked); setOffset(0); }} />{isAr ? 'بانتظار إجابة فقط' : 'Unanswered only'}</label>
    </form>
    {inbox.error ? <div role="alert"><p>{inbox.error.message}</p><Button variant="outline" onClick={() => { void inbox.refetch(); }}>{isAr ? 'إعادة المحاولة' : 'Retry'}</Button></div> : null}
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-2" aria-label={isAr ? 'المحادثات' : 'Conversations'}>
        {inbox.isLoading ? <p>{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : !inbox.data?.items.length ? <p className="rounded-xl border p-5 text-sm text-muted-foreground">{isAr ? 'لا توجد محادثات مطابقة. تظهر المحادثة عندما يبدأ العميل بمراسلتك.' : 'No matching conversations. A conversation appears when a client starts messaging you.'}</p> : inbox.data.items.map(thread => <button key={thread.id} type="button" onClick={() => setSelected(thread.id)} aria-pressed={thread.id === selected} className={`block w-full rounded-xl border p-4 text-start ${selected === thread.id ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'bg-white text-slate-950 hover:bg-slate-50'}`}>
          <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{thread.client_name || (isAr ? 'عميل' : 'Client')}</span>{thread.unread ? <Badge>{thread.unread}</Badge> : null}</div><p className="mt-1 text-xs text-slate-500">{thread.cohort_key}</p><p className="mt-2 truncate text-sm text-slate-600">{thread.preview || (isAr ? 'محادثة جديدة' : 'New conversation')}</p>{thread.last_client_message_id > thread.last_expert_message_id ? <p className="mt-2 text-xs font-medium text-amber-700">{isAr ? 'بانتظار إجابة' : 'Awaiting reply'}</p> : null}
        </button>)}
        <div className="flex justify-between gap-2"><Button variant="outline" size="sm" disabled={offset === 0 || inbox.isFetching} onClick={() => setOffset(current => Math.max(0, current - 50))}>{isAr ? 'السابق' : 'Previous'}</Button><Button variant="outline" size="sm" disabled={!inbox.data?.hasMore || inbox.isFetching} onClick={() => setOffset(current => current + 50)}>{isAr ? 'التالي' : 'Next'}</Button></div>
      </aside>
      {selected ? <LiveExpertConversation key={selected} conversationId={selected} viewer="staff" title={selectedThread?.client_name || (isAr ? 'محادثة العميل' : 'Client conversation')} /> : <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">{isAr ? 'اختر محادثة للقراءة والرد.' : 'Select a conversation to read and reply.'}</div>}
    </div>
  </main></DashboardLayout>;
}
