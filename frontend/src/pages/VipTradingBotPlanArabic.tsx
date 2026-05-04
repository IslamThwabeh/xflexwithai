import {
  Button,
} from "@/components/ui/button";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Printer,
  ShieldCheck,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  PlanHero,
  PlanSectionTitle,
  PlanTopBar,
  usePlanDocumentLanguage,
  type PlanNavLink,
} from "@/components/public/VipBotPlanShared";

const navLinks: PlanNavLink[] = [
  { href: "/business-owner/vip-trading-bot-plan", label: "نظرة عامة" },
  { href: "/en/project/vip-bot-plan", label: "Technical EN" },
  { href: "/ar/project/vip-bot-plan", label: "العربية", active: true },
];

const heroStats = [
  {
    title: "التكلفة التشغيلية الشهرية",
    value: "30-80 دولار",
    note: "تكلفة تشغيل تقديرية لنسخة MVP خفيفة قبل رسوم التداول والانزلاق.",
    icon: Wallet,
  },
  {
    title: "جهد البناء",
    value: "92-165 ساعة",
    note: "الوقت المتوقع لتطوير النسخة الأولى القابلة للتشغيل.",
    icon: Workflow,
  },
  {
    title: "المدة الواقعية",
    value: "4-7 أشهر",
    note: "تشمل البناء، التداول الورقي، والإطلاق المحدود المنضبط.",
    icon: Clock3,
  },
  {
    title: "الهدف المحافظ بعد التحقق",
    value: "1%-2% شهريًا",
    note: "هدف محافظ بعد التحقق وليس وعدًا أو ضمانًا بالعائد.",
    icon: ShieldCheck,
  },
] as const;

const valueCards = [
  {
    title: "حماية السمعة",
    body: "الفكرة ليست بيع بوت سريع الربح، بل تقديم خدمة VIP محافظة يمكن شرحها ومراجعتها والدفاع عنها عند أي سؤال من العميل.",
  },
  {
    title: "تقليل الاعتماد على العامل البشري",
    body: "إلغاء خطوة الصور والتنفيذ اليدوي يقلل الأخطاء، ويجعل القرارات موثقة، ويمنع اختلاف التنفيذ من شخص لآخر.",
  },
  {
    title: "ضبط المخاطر قبل البحث عن العائد",
    body: "النظام المقترح يفضل التوقف والجلوس خارج السوق على الدخول في ظروف غير واضحة. هذه نقطة قوة وليست نقطة ضعف.",
  },
  {
    title: "قابلية التوسع",
    body: "بعد نجاح مرحلة الورقي والطيار المحدود، يمكن توسيع الخدمة على حسابات VIP بشكل منظم دون إعادة اختراع النظام من الصفر.",
  },
] as const;

const marketProfiles = [
  {
    title: "سوق صاعد منظم",
    body: "النظام يعمل بشكل انتقائي على صفقات شراء Spot صغيرة ومدروسة. هذا هو السيناريو الأفضل لتحقيق العائد المحافظ المستهدف.",
    tone: "emerald",
  },
  {
    title: "سوق عرضي أو غير واضح",
    body: "يفضل النظام تقليل النشاط أو عدم الدخول أصلًا. قلة الصفقات هنا تحمي رأس المال ولا تعتبر فشلًا للنظام.",
    tone: "amber",
  },
  {
    title: "سوق عالي التوتر أو هابط بقوة",
    body: "القرار الصحيح هو عدم فتح مخاطر جديدة والاحتفاظ بالسيولة. هذا جزء أساسي من حماية الحسابات وسمعة الأكاديمية.",
    tone: "rose",
  },
] as const;

const approvalChecklist = [
  "الموافقة على بناء MVP فقط دون استخدام أموال VIP الآن.",
  "الموافقة على أن مرحلة الورقي 8-12 أسبوع شرط إلزامي قبل أي إطلاق حي.",
  "الموافقة على أن الإطلاق الحي يحتاج مراجعة واعتمادًا ثانيًا بعد نتائج الورقي.",
  "الموافقة على أن CFD أو Margin أو Leverage أو أي فائدة ليلية تعني إيقاف المشروع فورًا.",
] as const;

const riskRows = [
  {
    risk: "تعطل API أو توقف منصة التنفيذ",
    control: "وضع Safe Mode تلقائي، إيقاف الصفقات الجديدة، وتنبيه فوري مع آلية مراجعة يدوية قبل العودة للعمل.",
  },
  {
    risk: "تعطل الـVPS أو الجهاز الرئيسي",
    control: "زر إيقاف يدوي مستقل، وخطة تشغيل احتياطية، وخطوات واضحة لتعطيل مفاتيح API إذا لزم الأمر.",
  },
  {
    risk: "الاعتماد على شخص واحد في التشغيل",
    control: "توثيق Runbook واضح وخطوات تشغيل وإيقاف مكتوبة بحيث لا تبقى المعرفة محصورة بشخص واحد.",
  },
  {
    risk: "أن تكون الأداة المتداولة ليست Spot حقيقية",
    control: "هذا سبب رفض مباشر. لا يعتمد القرار على اسم المنتج التسويقي، بل على المواصفات القانونية والفنية الفعلية.",
  },
] as const;

export default function VipTradingBotPlanArabic() {
  usePlanDocumentLanguage("ar", "rtl");

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)] text-slate-900" dir="rtl" translate="no">
      <style>{`@media print {
  body {
    margin: 2cm;
    font-size: 12pt;
    line-height: 1.4;
  }
  .no-print, button, nav, footer, .print-hide {
    display: none !important;
  }
  a {
    text-decoration: none;
    color: black;
  }
  h1, h2, h3 {
    page-break-after: avoid;
  }
  p, li, table {
    page-break-inside: avoid;
  }
}`}</style>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PlanTopBar navLinks={navLinks} homeLabel="العودة للرئيسية" />

        <div className="print-hide mb-4 flex justify-start">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            طباعة / حفظ PDF
          </Button>
        </div>

        <PlanHero
          eyebrow="نسخة مخصصة لمالك العمل"
          title="المشكلة والهدف الاستراتيجي"
          subtitle="الهدف من المشروع ليس بناء بوت تداول لمجرد الأتمتة، بل بناء خدمة VIP منخفضة المخاطر، منضبطة شرعياً، وقادرة على حماية رأس المال وسمعة الأكاديمية في الوقت نفسه. المشكلة الحالية أن سير العمل اليدوي لا يتوسع بسهولة، ولا يعطي نفس الجودة والانضباط في كل مرة."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {heroStats.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-500">{item.title}</div>
                    <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-black text-slate-900">{item.value}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
                </article>
              );
            })}
          </div>
        </PlanHero>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="الخلاصة التنفيذية"
            title="القرار المقترح: موافقة مشروطة"
            subtitle="التوصية الحالية هي الموافقة على بناء النسخة الأولى وبدء مرحلة الورقي فقط. أما الإطلاق الحي على أموال VIP فلا يتم اعتماده الآن، بل فقط بعد نجاح المعايير المحددة في هذه الوثيقة."
          />

          <div className="mb-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm leading-7 text-slate-700 md:text-base">
            <span className="font-black text-slate-900">الخلاصة المباشرة لمالك العمل:</span> التكلفة التشغيلية الشهرية 30-80 دولار فقط. الهدف المحافظ بعد التحقق 1-2% شهرياً. القرار المقترح: موافقة مشروطة على بناء النسخة الأولى وبدء التداول الورقي فقط.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-slate-900">لماذا القرار ليس رفضًا</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>تكلفة التشغيل الشهرية منخفضة مقارنة بأي خدمة VIP ناجحة.</li>
                <li>المشروع يبني أصلًا تقنيًا يمكن استخدامه لاحقًا على أكثر من حساب.</li>
                <li>المنهجية المقترحة محافظة وتضع حماية رأس المال قبل العائد.</li>
                <li>هناك مسار واضح للورقي ثم للطيار المحدود قبل التوسع.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="text-lg font-black text-slate-900">متى يصبح القرار رفضًا مباشرًا</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>إذا كان المنتج CFD أو Margin أو Leverage أو فيه فائدة ليلية.</li>
                <li>إذا لم يثبت النظام انضباطه في الورقي لمدة 8-12 أسبوعًا.</li>
                <li>إذا ظهرت مشاكل مطابقة بين مراكز البوت والمنصة.</li>
                <li>إذا كان الربح الظاهري يختفي بعد الرسوم والانزلاق.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="القيمة التجارية"
            title="لماذا هذا المشروع مفيد للأكاديمية أصلًا"
            subtitle="القيمة هنا ليست في كثرة الصفقات، بل في تقديم منتج VIP محافظ، قابل للشرح، ويعكس صورة احترافية ومنضبطة عن الأكاديمية."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {valueCards.map((card) => (
              <article key={card.title} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <h3 className="text-lg font-black text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="تعريف النسخة الأولى"
            title="ما الذي سيتم إطلاقه فعليًا في الـMVP"
            subtitle="النسخة الأولى يجب أن تبقى ضيقة جدًا ومحافظة جدًا حتى تقل احتمالات الخطأ أو الضرر على الحسابات."
          />

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <ul className="space-y-2 text-sm leading-7 text-slate-700 md:text-base">
              <li>التداول على BTC و ETH فقط في البداية.</li>
              <li>شراء Spot فقط بدون Short.</li>
              <li>فلتر اتجاه 4 ساعات مع توقيت دخول 15 دقيقة.</li>
              <li>وقف خسارة حتمي، جني أرباح جزئي، وزر إيقاف يدوي.</li>
              <li>حد خسارة يومي 1% وحد أقصى للتراجع 6%.</li>
              <li>عدم استخدام أكثر من 25% من رأس المال في السوق.</li>
              <li>عدم استخدام Grid أو Martingale أو Averaging Down في النسخة الأولى.</li>
            </ul>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="الجدوى المالية"
            title="قراءة مبسطة للتكلفة مقابل العائد المحافظ"
            subtitle="الأرقام التالية ليست وعدًا بالأرباح، بل سيناريوهات تخطيطية تساعد في فهم ما إذا كانت تكلفة التشغيل معقولة مقارنة بحجم الحسابات المستهدفة."
          />

          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full border-collapse text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-black text-slate-900">رأس المال التجريبي</th>
                  <th className="px-4 py-3 font-black text-slate-900">عائد محافظ 1%-2%</th>
                  <th className="px-4 py-3 font-black text-slate-900">تكلفة التشغيل</th>
                  <th className="px-4 py-3 font-black text-slate-900">صافي تقريبي قبل الرسوم</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-4 font-semibold text-slate-900">25,000$</td>
                  <td className="px-4 py-4 text-slate-700">250$ إلى 500$</td>
                  <td className="px-4 py-4 text-slate-700">30$ إلى 80$</td>
                  <td className="px-4 py-4 text-slate-700">170$ إلى 470$</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-4 font-semibold text-slate-900">50,000$</td>
                  <td className="px-4 py-4 text-slate-700">500$ إلى 1,000$</td>
                  <td className="px-4 py-4 text-slate-700">30$ إلى 80$</td>
                  <td className="px-4 py-4 text-slate-700">420$ إلى 970$</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-4 font-semibold text-slate-900">100,000$</td>
                  <td className="px-4 py-4 text-slate-700">1,000$ إلى 2,000$</td>
                  <td className="px-4 py-4 text-slate-700">30$ إلى 80$</td>
                  <td className="px-4 py-4 text-slate-700">920$ إلى 1,970$</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm leading-7 text-slate-700">
              ملاحظة مهمة: الربحية لا تُقاس من اليوم الأول. القرار الصحيح هو اعتبار أول 8-12 أسبوعًا مرحلة تحقق فقط. إذا أثبت النظام قدرة محافظة بحدود 1%-2% شهريًا بعد الرسوم والانزلاق، تصبح التكلفة التشغيلية منخفضة جدًا نسبيًا. أما إذا لم يثبت ذلك، فالتكلفة مهما كانت منخفضة لا تبرر الإطلاق.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="ملف المخاطر والعائد"
            title="كيف يتصرف النظام بحسب حالة السوق"
            subtitle="القيمة الحقيقية للنظام أنه لا يحاول الربح في كل ظرف. بل يختار متى يعمل ومتى يتوقف."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {marketProfiles.map((profile) => (
              <article
                key={profile.title}
                className={[
                  "rounded-3xl border p-5",
                  profile.tone === "emerald"
                    ? "border-emerald-100 bg-emerald-50"
                    : profile.tone === "amber"
                      ? "border-amber-200 bg-amber-50"
                      : "border-rose-200 bg-rose-50",
                ].join(" ")}
              >
                <h3 className="text-lg font-black text-slate-900">{profile.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{profile.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="مخاطر الأعمال وخطة الطوارئ"
            title="المخاطر ليست تقنية فقط، بل تشغيلية وإدارية أيضًا"
            subtitle="حتى لو كانت الاستراتيجية جيدة، يمكن أن يفشل المشروع بسبب التشغيل الضعيف أو الاعتماد على شخص واحد أو منصة غير موثوقة."
          />

          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full border-collapse text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-black text-slate-900">الخطر</th>
                  <th className="px-4 py-3 font-black text-slate-900">الإجراء الوقائي</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((row) => (
                  <tr key={row.risk} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.risk}</td>
                    <td className="px-4 py-4 leading-7 text-slate-700">{row.control}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-slate-900">آليات حماية السمعة</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700 md:text-base">
                <li>
                  <span className="font-black text-slate-900">حد أقصى لتخصيص رأس المال لعملاء VIP:</span> في البداية، لا يزيد عن 10-20% من محفظة العميل لهذا البوت فقط.
                </li>
                <li>
                  <span className="font-black text-slate-900">مراجعات حوكمة ربع سنوية:</span> تعرض أداء البوت على لجنة (مالك العمل + التقني) كل 3 أشهر. إذا انخفض الأداء عن معايير محددة، يتم إيقاف البوت أو تعديله.
                </li>
              </ul>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-lg font-black text-slate-900">ماذا يحدث إذا خسر البوت لمدة ثلاثة أشهر متتالية؟</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700 md:text-base">
                <li>مرحلة التداول الورقي (8-12 أسبوع) يجب أن تثبت سلوكاً مقبولاً قبل استخدام أي أموال حقيقية.</li>
                <li>بعد الإطلاق الحي، إذا تجاوز الأداء الشهري حداً معيناً (مثلاً خسارة أكبر من -2% في شهر واحد)، يتم إيقاف البوت تلقائياً وعقد مراجعة حوكمة.</li>
                <li>الهدف الأساسي هو الحفاظ على رأس المال، وليس مطاردة الأرباح. هذا يضمن عدم تعرض سمعة الأكاديمية للخطر.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="قواعد المنع القطعية"
            title="هذه ليست تفاصيل تفاوضية"
            subtitle="إذا اختل أي بند من البنود التالية، فالمشروع يتوقف ولا ينتقل إلى الحسابات الحية."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <CircleAlert className="h-5 w-5 text-rose-600" />
                ممنوعات واضحة
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>
                  <span className="font-black text-slate-900">شرط حاسم:</span> الحساب يجب أن يكون حساب <span className="font-black text-slate-900">تداول فوري (Spot)</span> حقيقي، وليس حساب عقود فروقات (CFD). بعض الوسطاء يقدمون "حسابات إسلامية" لكنها لا تزال تعتمد على عقود الفروقات. نرفض ذلك بشكل قاطع. يجب أن يكون العقد شراء وبيع فعلي للأصل مع تسليم فوري.
                </li>
                <li>CFD أو Futures أو Margin أو Leverage.</li>
                <li>أي فائدة ليلية أو Swap أو Lending أو Earn.</li>
                <li>أي أصل غير معتمد ضمن القائمة البيضاء.</li>
                <li>أي تنفيذ لا يثبت أنه Spot حقيقي.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                شروط الجاهزية التشغيلية
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>حد خسارة يومي 1% وإيقاف عند تراجع 6%.</li>
                <li>زر إيقاف يدوي فعال ومستقل.</li>
                <li>مطابقة المراكز مع المنصة كل 30-60 ثانية.</li>
                <li>نجاح الورقي 8-12 أسبوعًا دون مخالفات.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="خطة التنفيذ والاعتماد"
            title="القرار المطلوب الآن من مالك العمل"
            subtitle="المطلوب الآن ليس اعتماد الإطلاق الحي، بل اعتماد مرحلة البناء والورقي فقط، مع حجز قرار الإطلاق الحي إلى ما بعد نتائج القياس الفعلية."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-slate-900">الإجراء المقترح الآن</h3>
              <ol className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>1. اعتماد بناء MVP المحافظ.</li>
                <li>2. اعتماد مرحلة Paper Trading فقط.</li>
                <li>3. منع استخدام أموال VIP قبل مراجعة ثانية.</li>
                <li>4. اعتماد طيار صغير جدًا قبل أي توسع.</li>
              </ol>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-lg font-black text-slate-900">تذكير مهم</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                انخفاض التكلفة لا يكفي وحده. القرار يجب أن يُبنى على الانضباط، ثبات الأداء، وحدود المخاطر، لأن الضرر الأكبر ليس ماليًا فقط بل reputational أيضًا أمام عملاء VIP.
              </p>
            </article>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-lg font-black text-slate-900">قائمة الموافقة</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {approvalChecklist.map((item) => (
                <label key={item} className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <footer className="print-hide pb-4 pt-6 text-center text-sm text-slate-500">
          التوصية الحالية: نعم لبناء النسخة الأولى والمرحلة الورقية، ولا للإطلاق الحي قبل اعتماد ثانٍ مبني على نتائج فعلية.
        </footer>
      </div>
    </div>
  );
}