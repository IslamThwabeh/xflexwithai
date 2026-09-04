import { CalendarDays, Clock, ExternalLink, PlayCircle, Radio } from 'lucide-react';
import ClientLayout from '@/components/ClientLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const formatDate = (value: string, language: string) => new Intl.DateTimeFormat(language === 'ar' ? 'ar-JO' : 'en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Amman',
}).format(new Date(value));

export default function LivePackageWorkspace() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { data, isLoading } = trpc.livePackage.myWorkspace.useQuery();
  const join = trpc.livePackage.joinSession.useMutation({
    onSuccess: (session) => window.open(session.zoomJoinUrl, '_blank', 'noopener,noreferrer'),
    onError: (error) => toast.error(error.message),
  });

  return (
    <ClientLayout>
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="rounded-3xl bg-gradient-to-br from-emerald-950 to-slate-950 p-6 text-white md:p-8">
          <div className="mb-3 flex items-center gap-2 text-emerald-300"><Radio className="h-5 w-5" /> Live Package</div>
          <h1 className="text-3xl font-bold">{isAr ? 'بكج لايف' : 'Live Package'}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            {isAr ? 'جدول اللقاءات التعليمية المباشرة والتسجيلات المخصصة لفوجك.' : 'Your cohort schedule and protected educational recordings.'}
          </p>
        </header>

        {isLoading ? <p>{isAr ? 'جاري التحميل...' : 'Loading…'}</p> : !data?.hasAccess ? (
          <section className="rounded-2xl border bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">{isAr ? 'لا يوجد وصول لبكج لايف' : 'No Live Package access'}</h2>
            <p className="mt-2 text-sm text-slate-500">{isAr ? 'يظهر المحتوى هنا بعد تفعيل وصول الفوج.' : 'Cohort content appears here after your access is activated.'}</p>
          </section>
        ) : <>
          {data.cohortStatus === 'not_started' ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <h2 className="font-semibold">{isAr ? 'سيُعلن الجدول قريباً' : 'Schedule will be announced'}</h2>
              <p className="mt-2 text-sm leading-7">{isAr ? 'أنت مسجل في الفوج. ستظهر هنا مواعيد اللقاءات التعليمية ولقاءات التداول والتحليل المباشر فور نشرها.' : 'You are registered for the cohort. Educational and live trading/analysis session times will appear here as soon as they are published.'}</p>
            </section>
          ) : <section className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{isAr ? 'نافذة اللقاءات المباشرة' : 'Live meeting window'}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatDate(data.entitlement!.sessionStartsAt, language)} – {formatDate(data.entitlement!.sessionEndsAt, language)}</p>
              </div>
              <Badge variant={data.entitlement!.liveAccessActive ? 'default' : 'secondary'}>
                {data.entitlement!.liveAccessActive ? (isAr ? 'متاح الآن' : 'Active now') : (isAr ? 'غير نشط حالياً' : 'Not active now')}
              </Badge>
            </div>
          </section>}

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays className="h-5 w-5" />{isAr ? 'اللقاءات' : 'Sessions'}</h2>
            {data.sessions.length ? data.sessions.map((session) => (
              <article key={session.id} className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline">{session.sessionType === 'trading_analysis' ? (isAr ? 'تداول وتحليل' : 'Trading analysis') : (isAr ? 'تعليمي' : 'Educational')}</Badge><Badge variant={session.status === 'cancelled' ? 'destructive' : session.status === 'completed' ? 'secondary' : 'default'}>{session.status === 'cancelled' ? (isAr ? 'ملغي' : 'Cancelled') : session.status === 'completed' ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'قادم' : 'Upcoming')}</Badge></div><h3 className="font-semibold">{isAr ? session.titleAr : session.titleEn}</h3><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Clock className="h-4 w-4" />{formatDate(session.startsAt, language)}</p></div>
                <Button disabled={!data.entitlement!.liveAccessActive || session.status !== 'scheduled' || join.isPending} onClick={() => join.mutate({ sessionId: session.id })}>
                  <ExternalLink className="me-2 h-4 w-4" />{isAr ? 'الانضمام للقاء' : 'Join session'}
                </Button>
              </article>
            )) : <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">{isAr ? 'سيُعلن جدول اللقاءات هنا عند اعتماده، ولا يلزمك اتخاذ أي إجراء الآن.' : 'The session schedule will be announced here once approved; no action is required from you now.'}</p>}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-bold"><PlayCircle className="h-5 w-5" />{isAr ? 'التسجيلات' : 'Recordings'}</h2>
            {data.recordings.length ? data.recordings.map((recording) => (
              <article key={recording.id} className="rounded-2xl border bg-white p-5">
                <h3 className="font-semibold">{isAr ? recording.titleAr : recording.titleEn}</h3>
                <video className="mt-4 w-full rounded-xl bg-black" controls controlsList="nodownload" preload="metadata" src={recording.streamPath} />
              </article>
            )) : <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">{isAr ? 'ستظهر التسجيلات المنشورة هنا.' : 'Published recordings will appear here.'}</p>}
          </section>
        </>}
      </main>
    </ClientLayout>
  );
}
