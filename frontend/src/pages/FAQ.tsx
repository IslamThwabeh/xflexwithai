import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

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
    <div className="border border-gray-200 rounded-xl overflow-hidden transition-all hover:border-gray-300">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 p-5 text-start bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-[15px] leading-relaxed">
          {isRtl ? item.qAr : item.qEn}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4 bg-gray-50/50">
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
    <div className="min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-700 to-purple-800 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {isRtl ? 'الرئيسية' : 'Home'}
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-3 mb-3">
            <HelpCircle className="w-8 h-8 text-indigo-300" />
            <h1 className="text-3xl md:text-4xl font-extrabold">
              {isRtl ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
            </h1>
          </div>
          <p className="text-indigo-200 text-lg max-w-lg mx-auto">
            {isRtl ? 'إجابات على أكثر الأسئلة شيوعًا حول التداول والأكاديمية' : 'Answers to the most common questions about trading and the Academy'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl -mt-6">
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

        {/* CTA */}
        <div className="mt-12 text-center bg-white rounded-xl border p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {isRtl ? 'لم تجد إجابة لسؤالك؟' : "Didn't find an answer to your question?"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {isRtl ? 'تواصل معنا وسنرد عليك في أقرب وقت' : "Contact us and we'll get back to you as soon as possible"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/contact">
              <Button>{isRtl ? 'تواصل معنا' : 'Contact Us'}</Button>
            </Link>
            <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">{isRtl ? 'واتساب' : 'WhatsApp'}</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
