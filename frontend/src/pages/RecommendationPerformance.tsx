import { lazy, useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { formatAcademyDateTime } from '@shared/academyLocale';
import { PERFORMANCE_MIN_MONTH, illustratePerformance, isSupportedPerformanceMonth } from '@shared/recommendationPerformance';

const StaffPreviewLayout = lazy(() => import('@/components/DashboardLayout'));

export default function RecommendationPerformance({ preview = false }: { preview?: boolean }) {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const ar = language === 'ar';
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'daily' | 'weekly'>('weekly');
  const [startingAmount, setStartingAmount] = useState('100');
  const [valuePerPip, setValuePerPip] = useState('0.10');
  const [selectedPeriod, setSelectedPeriod] = useState<{ label: string; pips: number } | null>(null);
  const [expired, setExpired] = useState(false);
  const query = trpc.recommendations.customerPerformance.useQuery({ month, viewerId: user?.id ?? 0 }, {
    enabled: !!user && (!user.isStaff || preview),
    staleTime: query => Math.max(0, Date.parse(query.state.data?.expiresAt ?? '') - query.state.dataUpdatedAt) || 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true,
    refetchInterval: false, retry: false,
  });
  const report = user && (!user.isStaff || preview) ? query.data : undefined;
  useEffect(() => {
    setSelectedPeriod(null);
  }, [month, report?.calculatedAt]);
  useEffect(() => {
    if (!report) return;
    const remaining = Date.parse(report.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    // A one-shot display update, never a report polling timer.
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [report]);
  const number = (value: number) => new Intl.NumberFormat(ar ? 'ar-PS' : 'en-GB', { maximumFractionDigits: 2 }).format(value);
  const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-PS' : 'en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  const dateLabel = (value: string) => new Intl.DateTimeFormat(ar ? 'ar-PS' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  const periodLabel = selectedPeriod?.label ?? (ar ? 'الشهر المحدد' : 'Selected month');
  const illustration = report ? illustratePerformance(selectedPeriod?.pips ?? report.summary.netPips, Number(startingAmount), Number(valuePerPip)) : null;
  const rows = report ? report[view] : [];
  const tone = (pips: number) => pips < 0 ? 'text-red-700' : pips > 0 ? 'text-emerald-700' : 'text-slate-700';

  const Layout = preview ? StaffPreviewLayout : ClientLayout;
  return <Layout>
    <main dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      {preview && <p className="rounded-xl border bg-white p-4 text-sm leading-7">{ar ? 'معاينة المسؤول: هذا هو التقرير الإجمالي نفسه المتاح للعملاء، دون بيانات الصفقات الفردية.' : 'Admin preview: this is the same aggregate report available to customers, without individual trade data.'}</p>}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><TrendingUp className="h-5 w-5" />{ar ? 'أكاديمية XFlex' : 'XFlex Academy'}</p>
          <h1 className="text-3xl font-bold">{ar ? 'أداء التوصيات' : 'Recommendations Performance'}</h1>
          <p className="leading-7 text-slate-600">{ar ? 'تابع الأداء المُبلّغ عنه يومياً وأسبوعياً وشهرياً. التقرير متاح لجميع أصحاب الحسابات، دون الحاجة لاشتراك التوصيات.' : 'Explore reported daily, weekly and monthly performance. Available to every customer account, with no recommendations subscription required.'}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm font-medium">{ar ? 'شهر التقرير' : 'Report month'}
            <Input aria-label={ar ? 'شهر التقرير' : 'Report month'} className="mt-1 w-44" type="month" dir="ltr" min={PERFORMANCE_MIN_MONTH} max={new Date().toISOString().slice(0, 7)} value={month} onChange={event => {
              if (isSupportedPerformanceMonth(event.target.value)) setMonth(event.target.value);
            }} />
          </label>
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />{ar ? 'تحديث' : 'Refresh'}</Button>
        </div>
      </header>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
        <p>{ar ? 'الأداء مبني على تحديثات النقاط المُبلّغ عنها، وقد يشمل صفقات ما زالت مفتوحة. لا يمثل أرباحاً نقدية فعلية أو نتائج مؤكدة من وسيط.' : 'Performance uses reported pip progress and can include trades that are still open. It does not represent actual cash profits or broker-verified results.'}</p>
        <p>{ar ? 'حدود الأيام والأسابيع والأشهر بتوقيت UTC. الأسبوع من الأحد إلى السبت، مع اقتصار الأسابيع الجزئية على الشهر المحدد.' : 'Days, weeks and months use UTC boundaries. Weeks run Sunday–Saturday; partial weeks include only dates within the selected month.'}</p>
      </div>
      <div role="status" aria-live="polite" className="text-sm leading-6 text-slate-600">
        {query.isFetching ? (ar ? 'جارٍ تحميل التقرير…' : 'Loading report…') : report ? <>
          {ar ? 'تم احتساب التقرير: ' : 'Calculated: '}{formatAcademyDateTime(report.calculatedAt, language)} · {ar ? 'بتوقيت فلسطين' : 'Palestine time'}.
          {' '}{expired ? (ar ? 'هذه نسخة سابقة؛ اضغط تحديث للاطلاع على آخر تقرير.' : 'This snapshot has expired; refresh for the latest report.') : (ar ? 'قد تتأخر النتائج حتى خمس دقائق.' : 'Results may be up to five minutes behind.')}
        </> : null}
      </div>
      {query.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
        <p>{ar ? 'تعذّر تحميل آخر تقرير. حاول مجدداً باستخدام زر التحديث.' : 'Could not load the latest report. Use Refresh to try again.'}</p>
        {report && <p className="mt-2 text-sm">{ar ? 'المعروض أدناه هو آخر تقرير محفوظ، وليس تحديثاً جديداً.' : 'The report below is the last saved snapshot, not a new update.'}</p>}
      </div>}

      {report && <>
        <section aria-label={ar ? 'ملخص الشهر' : 'Monthly summary'} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: ar ? 'صافي النقاط المُبلّغ عنها' : 'Net reported pips', value: signed(report.summary.netPips), color: tone(report.summary.netPips) },
            { label: ar ? 'صفقات لها نقاط مُبلّغ عنها' : 'Trades with reported progress', value: number(report.summary.totalTrades), color: '' },
            { label: ar ? 'نسبة النتائج الموجبة' : 'Positive-result rate', value: `${number(report.summary.winRate)}%`, color: '' },
            { label: ar ? 'موجبة / سالبة / تعادل' : 'Positive / negative / breakeven', value: `${number(report.summary.winningTrades)} / ${number(report.summary.losingTrades)} / ${number(report.summary.breakevenTrades)}`, color: '' },
          ].map(item => <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm leading-6 text-slate-600">{item.label}</p><p dir="ltr" className={`mt-3 text-start text-3xl font-bold tabular-nums ${item.color}`}>{item.value}</p></div>)}
        </section>
        <p className="text-sm leading-7 text-slate-600">{ar ? `نتائج بانتظار تحديد النقاط: ${number(report.unresolvedTrades)}. أوامر معلّقة ملغاة قبل الدخول: ${number(report.cancelledPending)}. التعادل لا يدخل في مقام نسبة النتائج الموجبة.` : `Results awaiting a pip value: ${number(report.unresolvedTrades)}. Pending entries cancelled before entry: ${number(report.cancelledPending)}. Breakeven is excluded from the positive-result rate denominator.`}</p>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 className="text-xl font-bold">{ar ? 'تفاصيل الفترات' : 'Period breakdown'}</h2>
            <div className="flex gap-2" role="group" aria-label={ar ? 'طريقة العرض' : 'View by'}>
              <Button variant={view === 'weekly' ? 'default' : 'outline'} aria-pressed={view === 'weekly'} onClick={() => setView('weekly')}>{ar ? 'أسبوعي' : 'Weekly'}</Button>
              <Button variant={view === 'daily' ? 'default' : 'outline'} aria-pressed={view === 'daily'} onClick={() => setView('daily')}>{ar ? 'يومي' : 'Daily'}</Button>
            </div>
          </div>
          {report.summary.totalTrades === 0 && <p className="border-b bg-slate-50 p-5 leading-7">{ar ? 'لا توجد نتائج نقاط قابلة للاحتساب لهذا الشهر حتى الآن. الصفر لا يعني أن البيانات المفقودة صفقات متعادلة.' : 'No scorable pip results for this month yet. Zero does not classify missing results as breakeven trades.'}</p>}
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-slate-50 px-5 py-3 text-sm font-semibold"><span>{ar ? 'الفترة' : 'Period'}</span><span>{ar ? 'الصفقات' : 'Trades'}</span><span>{ar ? 'صافي النقاط' : 'Net pips'}</span></div>
          <div className="max-h-[34rem] overflow-y-auto">
            {rows.map(row => {
              const label = row.startDate === row.endDate ? dateLabel(row.startDate) : `${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}`;
              return <button key={row.startDate} type="button" onClick={() => setSelectedPeriod({ label, pips: row.netPips })}
                aria-label={`${label}: ${signed(row.netPips)} ${ar ? 'نقطة، عرض المثال الحسابي' : 'pips, show arithmetic illustration'}`}
                className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-5 py-4 text-start last:border-0 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 ${selectedPeriod?.label === label ? 'bg-emerald-50' : ''}`}>
                <span className="min-w-0 text-sm font-medium">{label}{row.partialWeek && <span className="mt-1 block text-sm font-normal text-slate-500">{ar ? 'أسبوع جزئي' : 'Partial week'}</span>}</span>
                <span className="min-w-12 text-center tabular-nums">{number(row.totalTrades)}</span>
                <span dir="ltr" className={`min-w-20 text-end font-bold tabular-nums ${tone(row.netPips)}`}>{signed(row.netPips)}</span>
              </button>;
            })}
          </div>
          <p className="border-t p-5 text-sm leading-7 text-slate-600">{ar ? 'تُحتسب كل زيادة أو نقصان مرة واحدة. قد تظهر الصفقة نفسها في عدة فترات؛ لذلك لا تجمع أعداد الصفقات اليومية للحصول على عدد صفقات الشهر. اختر فترة لتوضيح نقاطها بالدولار أدناه.' : 'Each increase or decrease is counted once. A trade may appear in several periods, so daily trade counts do not add up to the monthly trade count. Select a period to illustrate its pips in dollars below.'}</p>
        </section>

        <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{ar ? 'ماذا تعني النقاط بالدولار؟' : 'What could these pips mean in dollars?'}</h2>
            {selectedPeriod && <Button variant="outline" size="sm" onClick={() => setSelectedPeriod(null)}>{ar ? 'استخدام الشهر كاملاً' : 'Use full month'}</Button>}
          </div>
          <p className="text-sm leading-7">{ar ? 'مثال حسابي تعليمي بافتراض قيمة ثابتة لكل نقطة، دون تراكم الأرباح أو احتساب التكاليف. ليس محاكاة تداول أو وعداً بعائد.' : 'An educational arithmetic example using a fixed assumed value per pip, without compounding or costs. This is not a trading simulation or a promised return.'}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">{ar ? 'مبلغ البداية الافتراضي (USD)' : 'Illustrative starting amount (USD)'}<Input className="mt-2 bg-white" type="number" min="0.01" max="1000000" step="0.01" dir="ltr" value={startingAmount} onChange={event => setStartingAmount(event.target.value)} /></label>
            <label className="space-y-2 text-sm font-medium">{ar ? 'قيمة النقطة المفترضة (USD)' : 'Assumed value per pip (USD)'}<Input className="mt-2 bg-white" type="number" min="0.01" max="1000" step="0.01" dir="ltr" value={valuePerPip} onChange={event => setValuePerPip(event.target.value)} /></label>
          </div>
          <p className="text-sm font-semibold">{periodLabel} · <bdi>{signed(selectedPeriod?.pips ?? report.summary.netPips)}</bdi> {ar ? 'نقطة مُبلّغ عنها' : 'reported pips'}</p>
          {illustration ? <div className="grid gap-4 rounded-xl bg-white p-4 sm:grid-cols-3">
            <div><p className="text-sm text-slate-600">{ar ? 'التغيير الحسابي' : 'Illustrative change'}</p><p className={`mt-2 text-2xl font-bold ${tone(illustration.change)}`}><bdi>{money(illustration.change)}</bdi></p></div>
            <div><p className="text-sm text-slate-600">{ar ? 'الناتج الحسابي' : 'Illustrative ending amount'}</p><p className="mt-2 text-2xl font-bold"><bdi>{money(illustration.endingAmount)}</bdi></p></div>
            <div><p className="text-sm text-slate-600">{ar ? 'نسبة التغيير' : 'Illustrative change (%)'}</p><p className={`mt-2 text-2xl font-bold ${tone(illustration.change)}`}><bdi>{signed(illustration.percentage)}%</bdi></p></div>
          </div> : <p role="status" className="text-sm">{ar ? 'أدخل مبلغ بداية وقيمة نقطة موجبين.' : 'Enter a positive starting amount and pip value.'}</p>}
          <p className="text-sm leading-7 text-amber-950">{ar ? 'قيمة النقطة الفعلية تختلف حسب الأداة وحجم الصفقة. المثال لا يثبت إمكانية تنفيذ الصفقات بهذا المبلغ، ولا يحتسب السبريد والعمولات والانزلاق والتمويل أو متطلبات الهامش. إذا تجاوزت الخسارة مبلغ البداية، فهذا المثال لا يصف حساباً قابلاً للتداول.' : 'Actual pip value varies by instrument and position size. This example does not establish that the trades could be executed with this balance and excludes spread, commissions, slippage, financing and margin requirements. A loss exceeding the starting amount does not describe a viable trading account.'}</p>
        </section>
      </>}
    </main>
  </Layout>;
}
