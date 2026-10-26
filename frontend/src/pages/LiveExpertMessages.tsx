import { useState } from 'react';
import { Link } from 'wouter';
import { MessageSquare } from 'lucide-react';
import ClientLayout from '@/components/ClientLayout';
import LiveExpertConversation from '@/components/LiveExpertConversation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageVisible } from '@/hooks/usePageVisible';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function LiveExpertMessages() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const visible = usePageVisible();
  const [cohortKey, setCohortKey] = useState<string | undefined>(() => {
    const requested = new URLSearchParams(window.location.search).get('cohortKey')?.trim();
    return requested && requested.length <= 100 ? requested : undefined;
  });
  const workspace = trpc.liveExpert.myWorkspace.useQuery({ cohortKey }, { retry: false, refetchInterval: visible ? 30000 : false, refetchIntervalInBackground: false });
  const open = trpc.liveExpert.openConversation.useMutation({ onSuccess: () => { void workspace.refetch(); }, onError: error => toast.error(error.message) });
  const data = workspace.data;
  return <ClientLayout><main className="mx-auto max-w-4xl space-y-5 p-4 md:p-8" dir={isAr ? 'rtl' : 'ltr'}>
    <Link href="/live-package" className="text-sm text-emerald-700 underline">{isAr ? 'العودة إلى بكج لايف' : 'Back to Live Package'}</Link>
    <header className="rounded-2xl bg-emerald-950 p-6 text-white"><h1 className="flex items-center gap-2 text-2xl font-bold"><MessageSquare />{isAr ? 'راسل خبير لايف' : 'Message your Live Expert'}</h1><p className="mt-3 text-sm leading-6 text-emerald-100">{isAr ? 'مكانك الخاص للأسئلة والمساعدة المتعلقة باللقاءات والدروس.' : 'Your private space for questions and help with classes and lessons.'}</p></header>
    {workspace.isLoading ? <p>{isAr ? 'جاري التحميل…' : 'Loading…'}</p> : workspace.error ? <div role="alert"><p>{workspace.error.message}</p><Button variant="outline" onClick={() => { void workspace.refetch(); }}>{isAr ? 'إعادة المحاولة' : 'Retry'}</Button></div> : !data?.hasAccess ? <p className="rounded-xl border p-6">{isAr ? 'هذه الخدمة متاحة لعملاء بكج لايف بعد تفعيل التسجيل.' : 'This service is available to Live Package clients after enrollment is activated.'}</p> : <>
      {data.cohorts.length > 1 ? <label className="block text-sm font-medium">{isAr ? 'الفوج' : 'Cohort'}<select className="ms-3 rounded-lg border bg-white p-2" value={cohortKey ?? data.thread?.cohort_key ?? data.cohorts[0]?.cohortKey} onChange={event => setCohortKey(event.target.value)}>{data.cohorts.map(cohort => <option key={cohort.cohortKey} value={cohort.cohortKey}>{cohort.cohortKey}</option>)}</select></label> : null}
      <div className="rounded-xl border bg-white p-4 text-sm leading-6"><p className="font-semibold">{data.expertName || (isAr ? 'خبير لايف' : 'Live Expert')}</p><p>{isAr ? data.settings.availability_ar : data.settings.availability_en}</p>{data.messagingEndsAt ? <p className="mt-2 text-slate-500">{isAr ? 'نهاية فترة المراسلة: ' : 'Messaging period ends: '}{new Intl.DateTimeFormat(isAr ? 'ar-JO' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Amman' }).format(new Date(data.messagingEndsAt))}</p> : null}<p className="mt-2 text-xs text-slate-500">{isAr ? 'يمكن للإدارة مراجعة المحادثة عند الحاجة إلى المتابعة أو المساعدة.' : 'Admins can review the conversation when needed for oversight or assistance.'}</p></div>
      {data.thread ? <LiveExpertConversation key={data.thread.id} conversationId={data.thread.id} viewer="client" title={isAr ? `محادثتك مع ${data.expertName}` : `Your conversation with ${data.expertName}`} /> : <div className="rounded-2xl border bg-white p-8 text-center"><p className="mb-4 text-sm text-slate-600">{!data.expertAvailable ? (isAr ? 'سيظهر خبيرك هنا فور تفعيل المراسلة.' : 'Your expert will appear here once messaging is available.') : !data.canSend ? (isAr ? 'انتهت فترة المراسلة لهذا الفوج.' : 'The messaging period for this cohort has ended.') : (isAr ? 'ابدأ محادثتك الخاصة مع خبيرك.' : 'Start your private conversation with your expert.')}</p><Button disabled={!data.canSend || open.isPending} onClick={() => open.mutate({ cohortKey })}>{isAr ? 'بدء المحادثة' : 'Start conversation'}</Button></div>}
    </>}
  </main></ClientLayout>;
}
