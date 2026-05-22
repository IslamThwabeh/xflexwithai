import { useState } from 'react';
import { Link } from 'wouter';
import { HelpCircle, ChevronDown, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

interface FAQItem {
  qAr: string;
  qEn: string;
  aAr: string;
  aEn: string;
}

const faqItems: FAQItem[] = [
  {
    qAr: 'هل أكاديمية XFlex تضمن أرباح؟',
    qEn: 'Does XFlex Academy guarantee profits?',
    aAr: 'لا. لا توجد أي جهة في العالم تضمن أرباح في التداول. XFlex تقدم تعليم + أدوات تحليل + توصيات تعليمية، والنتائج تعتمد على التزامك وإدارتك للمخاطر.',
    aEn: 'No. No entity in the world guarantees profits in trading. XFlex provides education + analysis tools + educational recommendations, and results depend on your commitment and risk management.',
  },
  {
    qAr: 'هل التوصيات إجبارية التنفيذ؟',
    qEn: 'Are recommendations mandatory to follow?',
    aAr: 'لا. التوصيات اختيارية، والقرار النهائي دائمًا بيدك. نعلّمك كيف تختار الصفقة وتديرها، وليس فقط "ادخل واطلع".',
    aEn: 'No. Recommendations are optional, and the final decision is always yours. We teach you how to choose and manage a trade, not just "enter and exit".',
  },
  {
    qAr: 'هل التداول مناسب للمبتدئين؟',
    qEn: 'Is trading suitable for beginners?',
    aAr: 'نعم، بشرط الالتزام بالتعليم. المحتوى يبدأ من الأساسيات ويتدرج حتى الاحتراف، لكن التداول بدون تعلم أو صبر غير مناسب لأي شخص.',
    aEn: 'Yes, provided you commit to learning. Content starts from basics and progresses to professional levels, but trading without learning or patience is unsuitable for anyone.',
  },
  {
    qAr: 'هل أحتاج خبرة مسبقة؟',
    qEn: 'Do I need prior experience?',
    aAr: 'لا. لكن تحتاج عقلية متعلمة، التزام، وتطبيق تدريجي. من يدخل بهدف "الربح السريع" غالبًا يفشل.',
    aEn: 'No. But you need a learning mindset, commitment, and gradual application. Those who enter seeking "quick profits" usually fail.',
  },
  {
    qAr: 'ما الفرق بين التعليم والتوصيات؟',
    qEn: 'What\'s the difference between education and recommendations?',
    aAr: 'التعليم يعلّمك ليش الصفقة صحيحة. التوصيات تعطيك فرصة تطبيق عملي. النجاح الحقيقي = الاثنين معًا.',
    aEn: 'Education teaches you why a trade is right. Recommendations give you practical application opportunities. Real success = both together.',
  },
  {
    qAr: 'هل Lex AI يضمن نجاح الصفقات؟',
    qEn: 'Does Lex AI guarantee trade success?',
    aAr: 'لا، ولكن نسبة نجاحه عالية. Lex AI أداة تحليل ذكية مساعدة وليست نظام ربح آلي. تعطيك قراءة إضافية للسوق، وليس قرارًا نهائيًا.',
    aEn: 'No, but its success rate is high. Lex AI is an intelligent analysis tool, not an automatic profit system. It gives you additional market readings, not final decisions.',
  },
  {
    qAr: 'هل يمكنني الاعتماد على Lex AI وحده؟',
    qEn: 'Can I rely on Lex AI alone?',
    aAr: 'ممكن ولكن نفضل أن تتعلم بجانب تطبيقك للأداة. الأداة تُستخدم مع فهم الاتجاه، إدارة رأس المال، والالتزام بالخطة. أي استخدام عشوائي = مخاطرة.',
    aEn: 'Possible, but we prefer you learn alongside using the tool. It should be used with trend understanding, capital management, and plan adherence. Any random use = risk.',
  },
  {
    qAr: 'كم رأس المال المناسب للبدء؟',
    qEn: 'What\'s the appropriate starting capital?',
    aAr: 'نوصي بالبدء بمبلغ تستطيع تحمّل خسارته ولا يؤثر على حياتك. التداول ليس حلًا لمشكلة مالية.',
    aEn: 'We recommend starting with an amount you can afford to lose and that doesn\'t affect your life. Trading is not a solution to financial problems.',
  },
  {
    qAr: 'هل يمكنني التداول بمبلغ صغير؟',
    qEn: 'Can I trade with a small amount?',
    aAr: 'نعم. لكن الأرباح ستكون متناسبة مع رأس المال، ولا يوجد "سحر" يضاعف الحساب بسرعة بدون مخاطرة.',
    aEn: 'Yes. But profits will be proportional to capital, and there\'s no "magic" that doubles an account quickly without risk.',
  },
  {
    qAr: 'كم صفقة أحتاج يوميًا؟',
    qEn: 'How many trades do I need per day?',
    aAr: 'لا يوجد رقم ثابت. الأهم: جودة الصفقة، وضوح الفكرة، واحترام الخطة. صفقة واحدة صحيحة أفضل من خمس عشوائيات.',
    aEn: 'There\'s no fixed number. What matters is: trade quality, idea clarity, and respecting the plan. One correct trade is better than five random ones.',
  },
  {
    qAr: 'هل الخسارة تعني أني فشلت؟',
    qEn: 'Does a loss mean I failed?',
    aAr: 'لا. الخسارة جزء طبيعي من التداول. الفشل الحقيقي هو عدم الالتزام، مضاعفة اللوت، والانتقام من السوق.',
    aEn: 'No. Loss is a natural part of trading. Real failure is lack of discipline, lot doubling, and revenge trading.',
  },
  {
    qAr: 'هل يمكنني استرجاع الاشتراك إذا لم أربح؟',
    qEn: 'Can I get a refund if I don\'t profit?',
    aAr: 'لا. حسب سياسة الأكاديمية: الاشتراك غير قابل للاسترجاع. الخسارة لا تعني فشل الخدمة لأن التداول قرارك الشخصي.',
    aEn: 'No. Per Academy policy, subscriptions are non-refundable. Losses don\'t mean service failure because trading is your personal decision.',
  },
  {
    qAr: 'هل XFlex تدير حسابات؟',
    qEn: 'Does XFlex manage accounts?',
    aAr: 'لا. الأكاديمية تعليمية فقط ولا تدير أموال أو محافظ أو حسابات.',
    aEn: 'No. The Academy is educational only and does not manage funds, portfolios, or accounts.',
  },
  {
    qAr: 'هل أحتاج وسيط (Broker) معيّن؟',
    qEn: 'Do I need a specific broker?',
    aAr: 'لا نفرض وسيطًا محددًا. لكن نوجّهك ونقترح عليك لاختيار وسيط مرخص، بسبريد مناسب، وسحب وإيداع واضح.',
    aEn: 'We don\'t require a specific broker. But we guide and suggest choosing a licensed broker with suitable spreads and clear deposit/withdrawal methods.',
  },
  {
    qAr: 'هل التداول حلال أم حرام؟',
    qEn: 'Is trading halal or haram?',
    aAr: 'هذا سؤال فقهي وليس استثماري. نوصي بالرجوع لمرجع ديني مختص، مع العلم أن نوع الحساب والفوائد كلها عوامل مؤثرة شرعًا.',
    aEn: 'This is a religious jurisprudence question, not an investment one. We recommend consulting a qualified religious authority, noting that account type and interest are all relevant factors.',
  },
  {
    qAr: 'كم وقت أحتاج يوميًا؟',
    qEn: 'How much time do I need daily?',
    aAr: 'من 15 دقيقة إلى ساعتين حسب خبرتك، نوع التداول، واستراتيجيتك. التداول ليس "جلوس أمام الشاشة طوال اليوم".',
    aEn: 'From 15 minutes to 2 hours depending on your experience, trading type, and strategy. Trading isn\'t "sitting in front of a screen all day".',
  },
  {
    qAr: 'هل التداول سهل؟',
    qEn: 'Is trading easy?',
    aAr: 'محتاج متابعة واستمرارية بالتطبيق. مو صعب بس إنك تمشي على الخطة وتتابع مع الدعم الفني حيسهل عليك كتير.',
    aEn: 'It requires follow-up and consistency in application. It\'s not hard if you follow the plan and stay in touch with the support team — that makes it much easier.',
  },
  {
    qAr: 'هل أنجح من أول شهر؟',
    qEn: 'Will I succeed from the first month?',
    aAr: 'غير متوقع، ولكن المفروض مع التزامك وانضباطك تشوف الفرق من أول شهر إذا التزمت بالخطة التعليمية. الاستمرارية هي العامل الحاسم.',
    aEn: 'Not expected, but with commitment and discipline you should see a difference from the first month if you follow the educational plan. Consistency is the deciding factor.',
  },
];

function FAQAccordionItem({ item, isRtl, isOpen, toggle }: { item: FAQItem; isRtl: boolean; isOpen: boolean; toggle: () => void }) {
  return (
    <div className={`overflow-hidden rounded-[1.6rem] border transition-all duration-300 ${isOpen ? 'border-[#00C176]/24 bg-white/[0.07]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'}`}>
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-start transition-colors hover:bg-white/[0.03] md:p-6"
      >
        <span className="text-[15px] font-semibold leading-relaxed text-white md:text-base">
          {isRtl ? item.qAr : item.qEn}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/42 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#00C176]' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-white/8 px-5 pb-5 pt-4 text-sm leading-7 text-white/62 md:px-6 md:pb-6">
          {isRtl ? item.aAr : item.aEn}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <CinematicPublicLayout>
      <section className="relative overflow-hidden bg-[#050505] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_30%)]" />
        <div className="absolute left-[-4rem] top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
        <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />

        <div className="relative container mx-auto max-w-5xl px-4 text-center md:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
            {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <HelpCircle className="h-8 w-8 text-[#00C176] md:h-10 md:w-10" />
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] md:text-5xl">
              {isRtl ? 'أسئلة تتكرر كثيرًا قبل البدء' : 'Questions people keep asking before they start'}
            </h1>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/62 md:text-lg">
            {isRtl
              ? 'جمعنا هنا الإجابات التي تختصر التردد والالتباس: ما الذي تقدمه الأكاديمية، ما الذي لا تعد به، وكيف تدخل السوق بعقلية أوضح.'
              : 'This page collects the answers that remove hesitation and confusion: what the academy offers, what it does not promise, and how to enter the market with a clearer mindset.'}
          </p>
        </div>
      </section>

      <section className="bg-[#050505] pb-16">
        <div className="container mx-auto max-w-4xl px-4 md:px-8">
          <div className="space-y-3">
          {faqItems.map((item, i) => (
            <FAQAccordionItem
              key={i}
              item={item}
              isRtl={isRtl}
              isOpen={openIndex === i}
              toggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
          </div>

          <div className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm md:p-10">
            <h2 className="text-xl font-extrabold text-white md:text-2xl">
              {isRtl ? 'لم تجد إجابة لسؤالك؟' : "Didn't find your answer?"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/62">
              {isRtl
                ? 'إذا كان سؤالك متعلقًا بالباقات أو التسجيل أو الوصول، يمكنك مراسلتنا مباشرة أو الانتقال إلى صفحة التواصل.'
                : 'If your question is about packages, registration, or access, message us directly or continue to the contact page.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(0,193,118,0.28)] transition hover:translate-y-[-2px]"
              >
                WhatsApp
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <Link href="/contact">
                <a className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-[#00C176]/30 hover:bg-white/[0.08]">
                  {isRtl ? 'اذهب إلى صفحة التواصل' : 'Go to contact page'}
                </a>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </CinematicPublicLayout>
  );
}
